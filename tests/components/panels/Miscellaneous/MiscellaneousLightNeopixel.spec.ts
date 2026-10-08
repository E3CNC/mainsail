import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import MiscellaneousLightNeopixel from '@/components/panels/Miscellaneous/MiscellaneousLightNeopixel.vue'

const mocks = vi.hoisted(() => {
    return {
        emit: vi.fn(),
    }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
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
})

interface WrapperOptions {
    type?: string
    name?: string
    entries?: Record<string, unknown>
    settings?: Record<string, unknown>
    printerObjects?: Record<string, unknown>
}

const createTestWrapper = (options: WrapperOptions = {}) => {
    const { type = 'led', name = 'my_led', entries = {}, settings = {}, printerObjects = {} } = options

    const vuetify = createVuetify()
    const dispatch = vi.fn()

    const store = createStore({
        state: {
            socket: { isConnected: true, hostname: '127.0.0.1', port: 7125, initializationList: [] },
            server: { klippy_connected: true, klippy_state: 'ready', components: [] },
            printer: {
                print_stats: { state: 'standby' },
                configfile: { settings },
                ...printerObjects,
            },
            gui: {
                miscellaneous: { entries },
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'socket/getHostUrl': () => 'http://127.0.0.1',
            'server/power/getDevices': () => [],
        },
        actions: {
            'server/addEvent': (_ctx: never, payload: never) => dispatch(payload),
        },
    })

    const wrapper = mount(MiscellaneousLightNeopixel, {
        props: { type: type as never, name: name as never },
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                MiscellaneousLightNeopixelGroup: {
                    props: ['type', 'name', 'group'],
                    template: '<div data-testid="group">{{ group.name }}</div>',
                },
                MiscellaneousLightNeopixelDialog: {
                    props: ['modelValue', 'type', 'name'],
                    emits: ['update:modelValue', 'update-color'],
                    template:
                        '<div v-if="modelValue" data-testid="dialog"><button data-testid="dlg-white" @click="$emit(\'update-color\', 0, 0, 0, 1)">white</button></div>',
                },
                MiscellaneousLightNeopixelState: {
                    props: ['type', 'name', 'index'],
                    emits: ['click-button'],
                    template: '<button data-testid="state-btn" @click="$emit(\'click-button\')">state</button>',
                },
            },
        },
    })

    return { wrapper, dispatch }
}

describe('MiscellaneousLightNeopixel', () => {
    it('renders the humanized output name', () => {
        const { wrapper } = createTestWrapper({ name: 'my_led' })
        expect(wrapper.text()).toContain('My Led')
        wrapper.unmount()
    })

    it('toggles an RGB strip on with full white', async () => {
        const { wrapper, dispatch } = createTestWrapper({
            type: 'led',
            name: 'strip',
            settings: { 'led strip': { red_pin: 'x', green_pin: 'y', blue_pin: 'z' } },
            printerObjects: { 'led strip': { color_data: [[0, 0, 0, 0]] } },
        })
        await wrapper.find('.v-icon').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', {
            script: 'SET_LED LED="strip" RED=1 GREEN=1 BLUE=1 SYNC=0 TRANSMIT=1',
        })
        expect(dispatch).toHaveBeenCalledWith({
            message: 'SET_LED LED="strip" RED=1 GREEN=1 BLUE=1 SYNC=0 TRANSMIT=1',
            type: 'command',
        })
        wrapper.unmount()
    })

    it('toggles an RGBW strip on with white only', async () => {
        const { wrapper } = createTestWrapper({
            type: 'led',
            name: 'strip',
            settings: { 'led strip': { red_pin: 'x', green_pin: 'y', blue_pin: 'z', white_pin: 'w' } },
            printerObjects: { 'led strip': { color_data: [[0, 0, 0, 0]] } },
        })
        await wrapper.find('.v-icon').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', {
            script: 'SET_LED LED="strip" RED=0 GREEN=0 BLUE=0 WHITE=1 SYNC=0 TRANSMIT=1',
        })
        wrapper.unmount()
    })

    it('toggles an active strip off', async () => {
        const { wrapper } = createTestWrapper({
            type: 'led',
            name: 'strip',
            settings: { 'led strip': { red_pin: 'x', green_pin: 'y', blue_pin: 'z' } },
            printerObjects: { 'led strip': { color_data: [[1, 0.5, 0.2, 0]] } },
        })
        await wrapper.find('.v-icon').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', {
            script: 'SET_LED LED="strip" RED=0 GREEN=0 BLUE=0 SYNC=0 TRANSMIT=1',
        })
        wrapper.unmount()
    })

    it('respects neopixel color_order settings', async () => {
        const { wrapper } = createTestWrapper({
            type: 'neopixel',
            name: 'fancy',
            settings: { 'neopixel fancy': { color_order: ['GRBW'] } },
            printerObjects: { 'neopixel fancy': { color_data: [[0, 0, 0, 0]] } },
        })
        await wrapper.find('.v-icon').trigger('click')
        // GRBW includes W, so off -> on uses white only
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', {
            script: 'SET_LED LED="fancy" RED=0 GREEN=0 BLUE=0 WHITE=1 SYNC=0 TRANSMIT=1',
        })
        wrapper.unmount()
    })

    it('sends a bare command when no color channels are known', async () => {
        const { wrapper } = createTestWrapper({
            type: 'led',
            name: 'unknown',
            settings: {},
            printerObjects: {},
        })
        await wrapper.find('.v-icon').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', {
            script: 'SET_LED LED="unknown" SYNC=0 TRANSMIT=1',
        })
        wrapper.unmount()
    })

    it('renders light groups instead of the toggle when configured', async () => {
        const { wrapper } = createTestWrapper({
            type: 'led',
            name: 'strip',
            entries: {
                e1: {
                    type: 'led',
                    name: 'strip',
                    lightgroups: { g1: { name: 'left', start: 1, end: 10 } },
                    presets: {},
                },
            },
            settings: { 'led strip': { red_pin: 'x' } },
        })
        await flushPromises()
        expect(wrapper.findAll('[data-testid="group"]')).toHaveLength(1)
        expect(wrapper.text()).toContain('left')
        // toggle icon and state button hide when groups exist
        expect(wrapper.find('[data-testid="state-btn"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('opens the dialog from the state button and sends dialog colors', async () => {
        const { wrapper, dispatch } = createTestWrapper({
            type: 'led',
            name: 'strip',
            settings: { 'led strip': { red_pin: 'x', green_pin: 'y', blue_pin: 'z', white_pin: 'w' } },
            printerObjects: { 'led strip': { color_data: [[0, 0, 0, 0]] } },
        })
        expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(false)
        await wrapper.find('[data-testid="state-btn"]').trigger('click')
        await nextTick()
        expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(true)
        await wrapper.find('[data-testid="dlg-white"]').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', {
            script: 'SET_LED LED="strip" RED=0 GREEN=0 BLUE=0 WHITE=1 SYNC=0 TRANSMIT=1',
        })
        expect(dispatch).toHaveBeenCalled()
        wrapper.unmount()
    })
})
