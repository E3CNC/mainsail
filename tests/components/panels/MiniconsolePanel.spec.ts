import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import MiniconsolePanel from '@/components/panels/MiniconsolePanel.vue'

const mocks = vi.hoisted(() => {
    return {
        scroll: vi.fn(),
        setGcode: vi.fn(),
    }
})

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

beforeAll(() => {
    const MockResizeObserver = class {
        observe = () => {}
        unobserve = () => {}
        disconnect = () => {}
    }
    if (!(globalThis as Record<string, unknown>).ResizeObserver) {
        ;(globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver
    }
})

beforeEach(() => {
    mocks.scroll.mockReset()
    mocks.setGcode.mockReset()
})

interface ConsoleOptions {
    direction?: string
    height?: number
    autoscroll?: boolean
    hideWaitTemperatures?: boolean
    hideTlCommands?: boolean
    rawOutput?: boolean
    customFilters?: Record<string, { name: string; bool: boolean }>
    components?: string[]
    socketConnected?: boolean
    klippyState?: string
    klippyConnected?: boolean
}

const createTestWrapper = (options: ConsoleOptions = {}) => {
    const {
        direction = 'table',
        height = 300,
        autoscroll = true,
        hideWaitTemperatures = false,
        hideTlCommands = false,
        rawOutput = false,
        customFilters = {},
        components = [],
        socketConnected = true,
        klippyState = 'ready',
        klippyConnected = true,
    } = options

    const vuetify = createVuetify()
    const dispatched: { action: string; payload: unknown }[] = []
    const consoleEvents = [{ message: 'ok', type: 'response' }]
    const getConsoleEvents = vi.fn((_isTable: unknown, _limit: unknown) => consoleEvents)

    const store = createStore({
        state: {
            socket: { isConnected: socketConnected, hostname: '127.0.0.1', port: 7125, initializationList: [] },
            server: { klippy_connected: klippyConnected, klippy_state: klippyState, components },
            printer: { print_stats: { state: 'standby' }, gcode: { commands: {} } },
            gui: {
                console: {
                    direction,
                    height,
                    autoscroll,
                    hideWaitTemperatures,
                    hideTlCommands,
                    consolefilters: customFilters,
                    rawOutput,
                },
                gcodehistory: { entries: [] },
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'socket/getHostUrl': () => 'http://127.0.0.1',
            'server/power/getDevices': () => [],
            'server/getConsoleEvents':
                () =>
                (isTable: boolean, limit: number): unknown[] => {
                    getConsoleEvents(isTable, limit)
                    return consoleEvents
                },
        },
        actions: {
            'gui/saveSetting': (_ctx: never, payload: never) => {
                dispatched.push({ action: 'gui/saveSetting', payload })
            },
            'gui/console/filterUpdate': (_ctx: never, payload: never) => {
                dispatched.push({ action: 'gui/console/filterUpdate', payload })
            },
            'gui/console/clear': () => {
                dispatched.push({ action: 'gui/console/clear', payload: undefined })
            },
        },
    })

    const wrapper = mount(MiniconsolePanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                Panel: {
                    props: ['icon', 'title'],
                    template:
                        '<div data-testid="panel"><div data-testid="toolbar"><slot name="buttons" /></div><slot /></div>',
                },
                ConsoleTable: {
                    props: ['events', 'isMini'],
                    template:
                        '<div data-testid="console-table" :data-count="events.length"><button data-testid="table-cmd" @click="$emit(\'command-click\', \'G28\')">cmd</button></div>',
                },
                ConsoleTextarea: {
                    template: '<div data-testid="console-input" />',
                    methods: {
                        setGcode: (...args: unknown[]) => mocks.setGcode(...(args as [])),
                    },
                },
                CommandHelpModal: {
                    template:
                        '<div data-testid="help"><button data-testid="help-cmd" @click="$emit(\'on-command\', \'M104 S200\')">help</button></div>',
                },
                OverlayScrollbarsComponent: {
                    template: '<div data-testid="scroller"><slot /></div>',
                    methods: {
                        osInstance: () => ({ scroll: (...args: unknown[]) => mocks.scroll(...(args as [])) }),
                    },
                },
                VMenu: { template: '<div data-testid="menu"><slot name="activator" :props="{}" /><slot /></div>' },
                VList: { template: '<div><slot /></div>' },
                VListItem: { template: '<div><slot /></div>' },
                VCheckbox: {
                    props: ['modelValue', 'label'],
                    emits: ['update:modelValue', 'change'],
                    template:
                        '<label data-testid="checkbox">{{ label }}<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked); $emit(\'change\', $event.target.checked)" /></label>',
                },
            },
        },
    })

    return { wrapper, store, dispatched, getConsoleEvents, consoleEvents }
}

describe('MiniconsolePanel', () => {
    it('renders the miniconsole when connected', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="console-table"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="console-input"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('hides the panel when the socket is disconnected', () => {
        const { wrapper } = createTestWrapper({ socketConnected: false })
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('hides the panel when klipper is disconnected', () => {
        const { wrapper } = createTestWrapper({ klippyState: 'disconnected', klippyConnected: false })
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('requests table events with a 250 limit', () => {
        const { wrapper, getConsoleEvents } = createTestWrapper({ direction: 'table' })
        expect(getConsoleEvents).toHaveBeenCalledWith(true, 250)
        expect(wrapper.find('[data-testid="console-table"]').attributes('data-count')).toBe('1')
        wrapper.unmount()
    })

    it('requests shell events when direction is shell', () => {
        const { wrapper, getConsoleEvents } = createTestWrapper({ direction: 'shell' })
        expect(getConsoleEvents).toHaveBeenCalledWith(false, 250)
        wrapper.unmount()
    })

    it('clears the console from the toolbar', async () => {
        const { wrapper, dispatched } = createTestWrapper()
        const buttons = wrapper.find('[data-testid="toolbar"]').findAll('button')
        expect(buttons.length).toBeGreaterThan(0)
        await buttons[0].trigger('click')
        expect(dispatched).toContainEqual({ action: 'gui/console/clear', payload: undefined })
        wrapper.unmount()
    })

    it('fills the input when the table emits command-click', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('[data-testid="table-cmd"]').trigger('click')
        expect(mocks.setGcode).toHaveBeenCalledWith('G28')
        wrapper.unmount()
    })

    it('fills the input when the help modal emits a command', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('[data-testid="help-cmd"]').trigger('click')
        expect(mocks.setGcode).toHaveBeenCalledWith('M104 S200')
        wrapper.unmount()
    })

    it('toggles autoscroll through the checkbox setter', async () => {
        const { wrapper, dispatched } = createTestWrapper({ direction: 'shell', autoscroll: true })
        await flushPromises()
        const boxes = wrapper.findAll('[data-testid="checkbox"]')
        expect(boxes.length).toBeGreaterThan(0)
        const input = boxes[0].find('input')
        await input.setValue(false)
        await nextTick()
        expect(dispatched).toContainEqual({
            action: 'gui/saveSetting',
            payload: { name: 'console.autoscroll', value: false },
        })
        wrapper.unmount()
    })

    it('shows timelapse filter only when the component exists', async () => {
        const without = createTestWrapper({ components: [] })
        expect(without.wrapper.text()).not.toContain('Panels.MiniconsolePanel.HideTimelapse')
        without.wrapper.unmount()

        const withTl = createTestWrapper({ components: ['timelapse'] })
        await flushPromises()
        expect(withTl.wrapper.text()).toContain('Panels.MiniconsolePanel.HideTimelapse')
        withTl.wrapper.unmount()
    })
})
