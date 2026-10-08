import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import DroPanel from '@/components/panels/Cnc/DroPanel.vue'
import { getDefaultState } from '@/store/printer/index'

const mocks = vi.hoisted(() => {
    return {
        emit: vi.fn(),
        showMachineCoords: { value: true },
    }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('@/composables/useCncProfile', async () => {
    // The template reads the flag directly (v-if), so it must be a real
    // ref: a plain { value } object would always be truthy.
    const { computed } = await import('vue')
    return {
        useCncProfile: () => ({ showMachineCoords: computed(() => mocks.showMachineCoords.value) }),
    }
})

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
    mocks.showMachineCoords.value = true
})

interface WrapperOptions {
    klippyReady?: boolean
    socketConnected?: boolean
    showMachineCoords?: boolean
    printer?: Record<string, unknown>
}

const defaultPrinterState = (): Record<string, unknown> => ({
    ...getDefaultState(),
    motion_report: { live_position: [10.126, 20.5, 5.0, 0], live_velocity: 25.346 },
    gcode_move: { gcode_position: [8.0, 18.25, 4.5, 0], absolute_coordinates: true },
    toolhead: { homed_axes: 'xyz', axis_minimum: [0, 0, 0], axis_maximum: [200, 150, 100] },
    print_stats: { state: 'standby' },
})

const createTestWrapper = (options: WrapperOptions = {}) => {
    const { klippyReady = true, socketConnected = true, showMachineCoords = true, printer = {} } = options
    mocks.showMachineCoords.value = showMachineCoords

    const vuetify = createVuetify()

    const store = createStore({
        state: {
            socket: {
                isConnected: socketConnected,
                hostname: '127.0.0.1',
                port: 7125,
                initializationList: [],
            },
            server: {
                klippy_connected: klippyReady,
                klippy_state: klippyReady ? 'ready' : 'disconnected',
            },
            printer: {
                ...defaultPrinterState(),
                ...printer,
            },
            gui: {
                control: {},
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
        },
        actions: {},
    })

    const wrapper = mount(DroPanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot /></div>' },
                VContainer: { template: '<div><slot /></div>' },
                VChip: { template: '<span><slot /></span>' },
            },
        },
    })

    return { wrapper, store }
}

describe('DroPanel', () => {
    it('renders the DRO panel with three axis cards when klipper is ready', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(wrapper.findAll('.dro-panel__axis-card')).toHaveLength(3)
        const text = wrapper.text()
        for (const axis of ['X', 'Y', 'Z']) expect(text).toContain(axis)
        wrapper.unmount()
    })

    it('hides the panel when klipper is not ready', () => {
        const { wrapper } = createTestWrapper({ klippyReady: false })
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        expect(mocks.emit).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('hides the panel when the socket is disconnected', () => {
        const { wrapper } = createTestWrapper({ socketConnected: false })
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('shows the absolute coordinate mode by default', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.text()).toContain('Absolute (G90)')
        wrapper.unmount()
    })

    it('shows the relative coordinate mode when absolute_coordinates is false', () => {
        const { wrapper } = createTestWrapper({
            printer: { gcode_move: { gcode_position: [8, 18.25, 4.5, 0], absolute_coordinates: false } },
        })
        expect(wrapper.text()).toContain('Relative (G91)')
        wrapper.unmount()
    })

    it('reports Homed with per-axis OK chips when all axes are homed', () => {
        const { wrapper } = createTestWrapper()
        const text = wrapper.text()
        expect(text).toContain('Homed')
        expect(text).toContain('X OK')
        expect(text).toContain('Y OK')
        expect(text).toContain('Z OK')
        expect(text).not.toContain('Not Homed')
        wrapper.unmount()
    })

    it('reports Not Homed with per-axis flags for a partially homed machine', () => {
        const { wrapper } = createTestWrapper({
            printer: {
                motion_report: { live_position: [0, 0, 0, 0], live_velocity: 0 },
                gcode_move: { gcode_position: [0, 0, 0, 0], absolute_coordinates: true },
                toolhead: { homed_axes: 'x', axis_minimum: [0, 0, 0], axis_maximum: [200, 150, 100] },
            },
        })
        const text = wrapper.text()
        expect(text).toContain('Not Homed')
        expect(text).toContain('X OK')
        expect(text).toContain('Y --')
        expect(text).toContain('Z --')
        expect(text).toContain('HOMED')
        expect(text).toContain('OPEN')
        wrapper.unmount()
    })

    it('marks every axis OPEN when nothing is homed', () => {
        const { wrapper } = createTestWrapper({
            printer: {
                motion_report: { live_position: [0, 0, 0, 0], live_velocity: 0 },
                gcode_move: { gcode_position: [0, 0, 0, 0], absolute_coordinates: true },
                toolhead: { homed_axes: '', axis_minimum: [0, 0, 0], axis_maximum: [200, 150, 100] },
            },
        })
        const text = wrapper.text()
        expect(text).toContain('Not Homed')
        expect(text).not.toContain('HOMED')
        expect(text.match(/OPEN/g)?.length).toBe(3)
        wrapper.unmount()
    })

    it('renders machine, work and signed offset values trimmed to two decimals', () => {
        const { wrapper } = createTestWrapper()
        const cards = wrapper.findAll('.dro-panel__axis-card')
        expect(cards).toHaveLength(3)
        // machine 10.126 -> '10.13', work 8 -> '8', offset +2.126 -> '+2.13'
        expect(cards[0].text()).toContain('10.13')
        expect(cards[0].text()).toContain('+2.13')
        // machine 20.5 stays '20.5', offset +2.25 keeps the sign
        expect(cards[1].text()).toContain('20.5')
        expect(cards[1].text()).toContain('18.25')
        expect(cards[1].text()).toContain('+2.25')
        // machine 5 -> '5', offset +0.5
        expect(cards[2].text()).toContain('+0.5')
        wrapper.unmount()
    })

    it('renders negative offsets without a plus sign', () => {
        const { wrapper } = createTestWrapper({
            printer: {
                motion_report: { live_position: [5, 20.5, 4.5, 0], live_velocity: 0 },
                gcode_move: { gcode_position: [8, 18.25, 4.5, 0], absolute_coordinates: true },
                toolhead: { homed_axes: 'xyz', axis_minimum: [0, 0, 0], axis_maximum: [200, 150, 100] },
            },
        })
        const cards = wrapper.findAll('.dro-panel__axis-card')
        expect(cards[0].text()).toContain('-3')
        expect(cards[0].text()).not.toContain('+-3')
        // zero offset renders as plain '0'
        expect(cards[2].text()).toContain('0')
        wrapper.unmount()
    })

    it('renders the live velocity with two decimals', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.text()).toContain('Vel 25.35 mm/s')
        wrapper.unmount()
    })

    it('renders axis minimum and maximum limits', () => {
        const { wrapper } = createTestWrapper()
        const text = wrapper.text()
        expect(text).toContain('Min 0')
        expect(text).toContain('Max 200')
        expect(text).toContain('Max 150')
        expect(text).toContain('Max 100')
        wrapper.unmount()
    })

    it('shows machine coordinate sections when the profile enables them', () => {
        const { wrapper } = createTestWrapper({ showMachineCoords: true })
        expect(wrapper.text()).toContain('Machine')
        // machine + work + offset sections per axis
        expect(wrapper.findAll('.dro-panel__axis-section')).toHaveLength(9)
        wrapper.unmount()
    })

    it('hides machine coordinate sections when the profile disables them', () => {
        const { wrapper } = createTestWrapper({ showMachineCoords: false })
        expect(wrapper.text()).not.toContain('Machine')
        expect(wrapper.text()).toContain('Work')
        // work + offset sections per axis only
        expect(wrapper.findAll('.dro-panel__axis-section')).toHaveLength(6)
        wrapper.unmount()
    })

    it('falls back to zeros when printer motion state is missing', () => {
        const { wrapper } = createTestWrapper({
            printer: { motion_report: undefined, gcode_move: undefined, toolhead: undefined },
        })
        const text = wrapper.text()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(text).toContain('Absolute (G90)')
        expect(text).toContain('Not Homed')
        expect(text).toContain('Vel 0.00 mm/s')
        wrapper.unmount()
    })

    it('emits no socket commands because it is display-only', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(mocks.emit).not.toHaveBeenCalled()
        wrapper.unmount()
    })
})
