import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import MdiPanel from '@/components/panels/Cnc/MdiPanel.vue'

const mocks = vi.hoisted(() => {
    return {
        emit: vi.fn(),
        // Minimal vue ref: the template unwraps via __v_isRef, so a plain
        // { value } object would stay truthy and v-if would never hide.
        showWorkCoords: { value: true, __v_isRef: true },
    }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('@/composables/useCncProfile', () => ({
    useCncProfile: () => ({ showWorkCoords: mocks.showWorkCoords }),
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
    mocks.emit.mockReset()
    mocks.showWorkCoords.value = true
})

interface WrapperOptions {
    klippyReady?: boolean
    showWorkCoords?: boolean
}

const createTestWrapper = (options: WrapperOptions = {}) => {
    const { klippyReady = true, showWorkCoords = true } = options
    mocks.showWorkCoords.value = showWorkCoords

    const vuetify = createVuetify()
    const addEvent = vi.fn()

    const store = createStore({
        state: {
            socket: {
                isConnected: klippyReady,
                hostname: '127.0.0.1',
                port: 7125,
                initializationList: [],
            },
            server: {
                klippy_connected: klippyReady,
                klippy_state: klippyReady ? 'ready' : 'disconnected',
            },
            printer: {
                print_stats: { state: 'standby' },
                toolhead: { homed_axes: 'xyz' },
                gcode: { commands: {} },
            },
            gui: {
                control: {},
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
        },
        actions: {
            'server/addEvent': (_context: never, payload: never) => {
                addEvent(payload)
            },
        },
    })

    const wrapper = mount(MdiPanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot /></div>' },
                ConsoleTextarea: { template: '<div data-testid="console-textarea" />' },
            },
        },
    })

    return { wrapper, addEvent }
}

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => {
    const buttons = wrapper.findAll('button')
    const found = buttons.find((b) => b.text().trim() === text)
    if (!found) throw new Error(`button with text "${text}" not found`)
    return found
}

describe('MdiPanel', () => {
    it('renders the panel with the MDI console input', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="console-textarea"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('renders all four quick commands', () => {
        const { wrapper } = createTestWrapper()
        for (const label of ['G20 mm', 'G21 inch', 'G90 abs', 'G91 rel']) {
            expect(findButtonByText(wrapper as never, label).exists()).toBe(true)
        }
        wrapper.unmount()
    })

    it('sends G20 with an echo event', async () => {
        const { wrapper, addEvent } = createTestWrapper()
        await findButtonByText(wrapper as never, 'G20 mm').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'G20' })
        expect(addEvent).toHaveBeenCalledWith({ message: 'G20', type: 'command' })
        wrapper.unmount()
    })

    it('sends G21 with an echo event', async () => {
        const { wrapper, addEvent } = createTestWrapper()
        await findButtonByText(wrapper as never, 'G21 inch').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'G21' })
        expect(addEvent).toHaveBeenCalledWith({ message: 'G21', type: 'command' })
        wrapper.unmount()
    })

    it('sends G90 with an echo event', async () => {
        const { wrapper, addEvent } = createTestWrapper()
        await findButtonByText(wrapper as never, 'G90 abs').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'G90' })
        expect(addEvent).toHaveBeenCalledWith({ message: 'G90', type: 'command' })
        wrapper.unmount()
    })

    it('sends G91 with an echo event', async () => {
        const { wrapper, addEvent } = createTestWrapper()
        await findButtonByText(wrapper as never, 'G91 rel').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'G91' })
        expect(addEvent).toHaveBeenCalledWith({ message: 'G91', type: 'command' })
        wrapper.unmount()
    })

    it('renders all six work coordinate systems when enabled', () => {
        const { wrapper } = createTestWrapper({ showWorkCoords: true })
        for (const wcs of ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']) {
            expect(findButtonByText(wrapper as never, wcs).exists()).toBe(true)
        }
        wrapper.unmount()
    })

    it('sends the WCS select command with an echo event', async () => {
        const { wrapper, addEvent } = createTestWrapper({ showWorkCoords: true })
        await findButtonByText(wrapper as never, 'G55').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'G55' })
        expect(addEvent).toHaveBeenCalledWith({ message: 'G55', type: 'command' })
        wrapper.unmount()
    })

    it('hides work coordinate systems when the profile disables them', () => {
        const { wrapper } = createTestWrapper({ showWorkCoords: false })
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        for (const wcs of ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']) {
            const buttons = wrapper.findAll('button')
            expect(buttons.find((b) => b.text().trim() === wcs)).toBeUndefined()
        }
        wrapper.unmount()
    })

    it('hides the panel when klipper is not ready', () => {
        const { wrapper } = createTestWrapper({ klippyReady: false })
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        expect(mocks.emit).not.toHaveBeenCalled()
        wrapper.unmount()
    })
})
