import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import CncStatusPanel from '@/components/panels/Cnc/CncStatusPanel.vue'
import { getDefaultState } from '@/store/printer/index'

const mocks = vi.hoisted(() => {
    return {
        emit: vi.fn(),
        getCncState: vi.fn(),
        loadCncMetadata: vi.fn(),
        showMachineHealth: { value: true },
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
        useCncProfile: () => ({ showMachineHealth: computed(() => mocks.showMachineHealth.value) }),
    }
})

vi.mock('@/store/files/cncMetadata', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/store/files/cncMetadata')>()
    return { ...actual, loadCncMetadata: mocks.loadCncMetadata }
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
    mocks.getCncState.mockReset()
    mocks.getCncState.mockResolvedValue({})
    mocks.loadCncMetadata.mockReset()
    mocks.loadCncMetadata.mockResolvedValue(null)
    mocks.showMachineHealth.value = true
})

interface WrapperOptions {
    klippyReady?: boolean
    socketConnected?: boolean
    showMachineHealth?: boolean
    fileExists?: boolean
    printer?: Record<string, unknown>
}

const defaultPrinterState = (): Record<string, unknown> => ({
    ...getDefaultState(),
    gcode_move: { absolute_coordinates: true, speed_factor: 1, speed: 0 },
    toolhead: { homed_axes: 'xyz', max_velocity: 0 },
    print_stats: { state: 'standby', filename: '' },
    idle_timeout: { state: 'Idle' },
    system_stats: { sysload: 0, memavail: 0 },
})

const metadataFixture = (): Record<string, unknown> => ({
    schema_version: 1,
    cam_tool: 'Fusion',
    tools: [{ id: 'T1', type: 'endmill', diameter_mm: 6 }],
    spindle_rpm: 12000,
    feeds_mm_per_min: { plunge: 100, cut: 500, rapid: 2000 },
})

const createTestWrapper = (options: WrapperOptions = {}) => {
    const {
        klippyReady = true,
        socketConnected = true,
        showMachineHealth = true,
        fileExists = false,
        printer = {},
    } = options
    mocks.showMachineHealth.value = showMachineHealth

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
            'files/getFile': () => (path: string) => (fileExists ? { filename: path } : null),
        },
        actions: {},
    })

    const wrapper = mount(CncStatusPanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot /></div>' },
                VContainer: { template: '<div><slot /></div>' },
                VChip: { props: ['color'], template: '<span :data-color="color"><slot /></span>' },
            },
        },
    })

    return { wrapper, store }
}

describe('CncStatusPanel', () => {
    it('renders the status panel when klipper is ready', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(wrapper.text()).toContain('Active File')
        expect(wrapper.text()).toContain('Feed Override')
        wrapper.unmount()
    })

    it('hides the panel when klipper is not ready', async () => {
        const { wrapper } = createTestWrapper({ klippyReady: false })
        await flushPromises()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        expect(mocks.emit).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('hides the panel when the socket is disconnected', async () => {
        const { wrapper } = createTestWrapper({ socketConnected: false })
        await flushPromises()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it.each([
        { state: 'printing', label: 'PRINTING', color: 'success' },
        { state: 'paused', label: 'PAUSED', color: 'warning' },
        { state: 'complete', label: 'COMPLETE', color: 'info' },
        { state: 'error', label: 'ERROR', color: 'error' },
        { state: 'shutdown', label: 'SHUTDOWN', color: 'error' },
        { state: 'standby', label: 'STANDBY', color: 'primary' },
    ])('maps printer state $state to label $label with color $color', async ({ state, label, color }) => {
        const { wrapper } = createTestWrapper({
            printer: { print_stats: { state, filename: '' } },
        })
        await flushPromises()
        expect(wrapper.text()).toContain(label)
        const stateChip = wrapper.find('.cnc-status-panel__chips [data-color]')
        expect(stateChip.exists()).toBe(true)
        expect(stateChip.attributes('data-color')).toBe(color)
        wrapper.unmount()
    })

    it('labels a missing printer state as UNKNOWN', async () => {
        const { wrapper } = createTestWrapper({
            printer: { print_stats: undefined, idle_timeout: undefined },
        })
        await flushPromises()
        expect(wrapper.text()).toContain('UNKNOWN')
        wrapper.unmount()
    })

    it('shows the absolute coordinate mode by default', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(wrapper.text()).toContain('Absolute (G90)')
        wrapper.unmount()
    })

    it('shows the relative coordinate mode when absolute_coordinates is false', async () => {
        const { wrapper } = createTestWrapper({
            printer: { gcode_move: { absolute_coordinates: false, speed_factor: 1, speed: 0 } },
        })
        await flushPromises()
        expect(wrapper.text()).toContain('Relative (G91)')
        wrapper.unmount()
    })

    it('lists homed axes in uppercase', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(wrapper.text()).toContain('Homed: XYZ')
        wrapper.unmount()
    })

    it('reports Homed: none when no axis is homed', async () => {
        const { wrapper } = createTestWrapper({
            printer: { toolhead: { homed_axes: '', max_velocity: 0 } },
        })
        await flushPromises()
        expect(wrapper.text()).toContain('Homed: none')
        wrapper.unmount()
    })

    it('shows the active filename when a file is loaded', async () => {
        const { wrapper } = createTestWrapper({
            printer: { print_stats: { state: 'printing', filename: 'bracket.gcode' } },
        })
        await flushPromises()
        expect(wrapper.text()).toContain('bracket.gcode')
        expect(wrapper.text()).not.toContain('No active file')
        wrapper.unmount()
    })

    it('shows a placeholder when no file is active', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(wrapper.text()).toContain('No active file')
        wrapper.unmount()
    })

    it('renders feed, velocity, load and memory values', async () => {
        const { wrapper } = createTestWrapper({
            printer: {
                gcode_move: { absolute_coordinates: true, speed_factor: 0.5, speed: 1500.4 },
                toolhead: { homed_axes: 'xyz', max_velocity: 3000.4 },
                system_stats: { sysload: 0.456, memavail: 204800 },
            },
        })
        await flushPromises()
        const text = wrapper.text()
        expect(text).toContain('50%')
        expect(text).toContain('1500 mm/min')
        expect(text).toContain('3000 mm/min')
        expect(text).toContain('0.46')
        expect(text).toContain('200 MB')
        wrapper.unmount()
    })

    it('falls back to defaults when telemetry is missing', async () => {
        const { wrapper } = createTestWrapper({
            printer: {
                gcode_move: undefined,
                toolhead: undefined,
                print_stats: undefined,
                idle_timeout: undefined,
                system_stats: undefined,
            },
        })
        await flushPromises()
        const text = wrapper.text()
        expect(text).toContain('100%')
        expect(text).toContain('0 mm/min')
        expect(text).toContain('0.00')
        expect(text).toContain('0 MB')
        expect(text).toContain('No active file')
        wrapper.unmount()
    })

    it('skips the metadata fetch when no file is active', async () => {
        const { wrapper } = createTestWrapper({ fileExists: true })
        await flushPromises()
        expect(mocks.loadCncMetadata).not.toHaveBeenCalled()
        expect(wrapper.text()).not.toContain('CNC Metadata')
        wrapper.unmount()
    })

    it('skips the metadata fetch when the sidecar file is missing', async () => {
        const { wrapper } = createTestWrapper({
            fileExists: false,
            printer: { print_stats: { state: 'printing', filename: 'bracket.gcode' } },
        })
        await flushPromises()
        expect(mocks.loadCncMetadata).not.toHaveBeenCalled()
        expect(wrapper.text()).not.toContain('CNC Metadata')
        wrapper.unmount()
    })

    it('renders the metadata view model once the sidecar loads', async () => {
        mocks.loadCncMetadata.mockResolvedValue(metadataFixture())
        const { wrapper } = createTestWrapper({
            fileExists: true,
            printer: { print_stats: { state: 'printing', filename: 'bracket.gcode' } },
        })
        await flushPromises()
        await nextTick()
        expect(mocks.loadCncMetadata).toHaveBeenCalledWith('http://127.0.0.1:7125', 'bracket.gcode')
        const text = wrapper.text()
        expect(text).toContain('CNC Metadata')
        expect(text).toContain('Loaded')
        expect(text).toContain('Fusion')
        expect(text).toContain('T1 · endmill · 6 mm')
        expect(text).toContain('12000 RPM')
        expect(text).toContain('Plunge 100 · Cut 500 · Rapid 2000 mm/min')
        wrapper.unmount()
    })

    it('shows a loading indicator while refetching metadata for a new file', async () => {
        mocks.loadCncMetadata.mockResolvedValue(metadataFixture())
        const { wrapper, store } = createTestWrapper({
            fileExists: true,
            printer: { print_stats: { state: 'printing', filename: 'first.gcode' } },
        })
        await flushPromises()
        await nextTick()
        expect(wrapper.text()).toContain('Loaded')

        let resolveLoad: (value: unknown) => void = () => {}
        mocks.loadCncMetadata.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveLoad = resolve
                })
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = store.state as any
        state.printer.print_stats.filename = 'second.gcode'
        await nextTick()
        expect(wrapper.text()).toContain('CNC Metadata')
        expect(wrapper.text()).toContain('Loading')
        resolveLoad(metadataFixture())
        await flushPromises()
        await nextTick()
        expect(wrapper.text()).toContain('Loaded')
        expect(mocks.loadCncMetadata).toHaveBeenLastCalledWith('http://127.0.0.1:7125', 'second.gcode')
        wrapper.unmount()
    })

    it('clears the metadata view when the fetch returns nothing', async () => {
        mocks.loadCncMetadata.mockResolvedValue(null)
        const { wrapper } = createTestWrapper({
            fileExists: true,
            printer: { print_stats: { state: 'printing', filename: 'bracket.gcode' } },
        })
        await flushPromises()
        await nextTick()
        expect(wrapper.text()).not.toContain('CNC Metadata')
        wrapper.unmount()
    })

    it('hides the metadata section when the profile disables machine health', async () => {
        mocks.loadCncMetadata.mockResolvedValue(metadataFixture())
        const { wrapper } = createTestWrapper({
            showMachineHealth: false,
            fileExists: true,
            printer: { print_stats: { state: 'printing', filename: 'bracket.gcode' } },
        })
        await flushPromises()
        await nextTick()
        expect(wrapper.text()).not.toContain('CNC Metadata')
        wrapper.unmount()
    })

    it('refreshes metadata when the active file changes', async () => {
        mocks.loadCncMetadata.mockResolvedValue(metadataFixture())
        const { wrapper, store } = createTestWrapper({
            fileExists: true,
            printer: { print_stats: { state: 'printing', filename: 'first.gcode' } },
        })
        await flushPromises()
        expect(mocks.loadCncMetadata).toHaveBeenCalledTimes(1)
        expect(mocks.loadCncMetadata).toHaveBeenLastCalledWith('http://127.0.0.1:7125', 'first.gcode')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = store.state as any
        state.printer.print_stats.filename = 'second.gcode'
        await nextTick()
        await flushPromises()
        expect(mocks.loadCncMetadata).toHaveBeenCalledTimes(2)
        expect(mocks.loadCncMetadata).toHaveBeenLastCalledWith('http://127.0.0.1:7125', 'second.gcode')
        wrapper.unmount()
    })

    it('emits no socket commands because it is display-only', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(mocks.emit).not.toHaveBeenCalled()
        wrapper.unmount()
    })
})
