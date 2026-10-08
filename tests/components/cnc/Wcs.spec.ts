import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import Wcs from '@/components/panels/Cnc/Wcs.vue'
import { offsetNames } from '@/composables/useCncOffsets'
import { getCursorTooltipPosition, previewCursorStyle } from '@/components/panels/Cnc/wcsPreview'

const mocks = vi.hoisted(() => {
    return {
        socketEmit: vi.fn(),
        setCncZero: vi.fn(),
        refreshWcs: vi.fn(),
        setActiveWcs: vi.fn(),
        toastError: vi.fn(),
        // Real ref instances are created inside the async mock factories
        // below (plain `{ value }` objects are NOT unwrapped by the
        // template compiler, so `v-if` gates and `=== activeWcs`
        // comparisons would always see them as truthy/unequal).
        klipperReadyRef: null as unknown as { value: boolean },
        showWorkCoordsRef: null as unknown as { value: boolean },
        requireConfirmRef: null as unknown as { value: boolean },
        requireHomingRef: null as unknown as { value: boolean },
        reverseYRef: null as unknown as { value: boolean },
        activeWcsRef: null as unknown as { value: string },
        wcsOffsetsRef: null as unknown as { value: Record<string, { X: number; Y: number; Z: number }> },
    }
})

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.socketEmit }),
}))

vi.mock('@/store/files/cncApi', () => ({
    setCncZero: mocks.setCncZero,
}))

vi.mock('vue-toast-notification', () => ({
    useToast: () => ({ error: mocks.toastError }),
}))

vi.mock('@/composables/useBase', async () => {
    const { ref } = await import('vue')
    const klipperReadyForGui = ref(true)
    mocks.klipperReadyRef = klipperReadyForGui
    return { useBase: () => ({ klipperReadyForGui }) }
})

vi.mock('@/composables/useCncProfile', async () => {
    const { ref } = await import('vue')
    const showWorkCoords = ref(true)
    const requireConfirmForZeroReset = ref(false)
    const requireHomingBeforeOffsets = ref(false)
    const reverseYPreview = ref(false)
    mocks.showWorkCoordsRef = showWorkCoords
    mocks.requireConfirmRef = requireConfirmForZeroReset
    mocks.requireHomingRef = requireHomingBeforeOffsets
    mocks.reverseYRef = reverseYPreview
    return {
        useCncProfile: () => ({
            showWorkCoords,
            requireConfirmForZeroReset,
            requireHomingBeforeOffsets,
            reverseYPreview,
        }),
    }
})

vi.mock('@/composables/useCncOffsets', async () => {
    const { ref } = await import('vue')
    const activeWcs = ref('G54')
    const wcsOffsets = ref<Record<string, { X: number; Y: number; Z: number }>>(defaultOffsets())
    mocks.activeWcsRef = activeWcs
    mocks.wcsOffsetsRef = wcsOffsets
    return {
        offsetNames: ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'],
        useCncOffsets: () => ({
            activeWcs,
            wcsOffsets,
            refreshWcs: mocks.refreshWcs,
            setActiveWcs: mocks.setActiveWcs,
        }),
    }
})

function defaultOffsets() {
    return {
        G54: { X: 0, Y: 0, Z: 0 },
        G55: { X: 10, Y: 20, Z: -5 },
        G56: { X: 1.5, Y: 2.5, Z: 0.5 },
        G57: { X: 0, Y: 0, Z: 0 },
        G58: { X: 0, Y: 0, Z: 0 },
        G59: { X: 0, Y: 0, Z: 0 },
    }
}

beforeAll(() => {
    const MockResizeObserver = class {
        observe = () => {}
        unobserve = () => {}
        disconnect = () => {}
    }
    if (!(globalThis as Record<string, unknown>).ResizeObserver) {
        ;(globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver
    }
    // jsdom runs with an opaque origin here, so window.localStorage is
    // undefined. The panel reads/writes grid, visibility and stock prefs
    // through it, so provide a small in-memory stand-in.
    const storage = new Map<string, string>()
    const localStorageMock = {
        getItem: (key: string) => (storage.has(key) ? (storage.get(key) as string) : null),
        setItem: (key: string, value: string) => {
            storage.set(String(key), String(value))
        },
        removeItem: (key: string) => {
            storage.delete(key)
        },
        clear: () => {
            storage.clear()
        },
        get length() {
            return storage.size
        },
        key: (index: number) => [...storage.keys()][index] ?? null,
    }
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
    Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })
    // Deterministic viewport so the SVG plot geometry is stable across tests.
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true, writable: true })
    // jsdom has no layout; give the preview SVG a fixed box so cursor math is stable.
    const rect = {
        width: 260,
        height: 320,
        left: 0,
        top: 0,
        right: 260,
        bottom: 320,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    }
    Object.defineProperty(window.SVGElement.prototype, 'getBoundingClientRect', {
        value: () => rect,
        configurable: true,
    })
})

beforeEach(() => {
    mocks.socketEmit.mockReset()
    mocks.setCncZero.mockReset()
    mocks.setCncZero.mockResolvedValue({})
    mocks.refreshWcs.mockReset()
    mocks.refreshWcs.mockResolvedValue(undefined)
    mocks.setActiveWcs.mockReset()
    mocks.setActiveWcs.mockImplementation(async (wcs: string) => {
        mocks.activeWcsRef.value = wcs
    })
    mocks.toastError.mockReset()
    mocks.klipperReadyRef.value = true
    mocks.showWorkCoordsRef.value = true
    mocks.requireConfirmRef.value = false
    mocks.requireHomingRef.value = false
    mocks.reverseYRef.value = false
    mocks.activeWcsRef.value = 'G54'
    mocks.wcsOffsetsRef.value = defaultOffsets()
    localStorage.clear()
    document.body.querySelectorAll('.offset-preview-tooltip').forEach((el) => el.remove())
})

interface WrapperOptions {
    ready?: boolean
    showWorkCoords?: boolean
    requireConfirm?: boolean
    requireHoming?: boolean
    reverseY?: boolean
    homedAxes?: string
    activeWcs?: string
}

const createTestWrapper = (options: WrapperOptions = {}) => {
    const {
        ready = true,
        showWorkCoords = true,
        requireConfirm = false,
        requireHoming = false,
        reverseY = false,
        homedAxes = 'xyz',
        activeWcs = 'G54',
    } = options
    mocks.klipperReadyRef.value = ready
    mocks.showWorkCoordsRef.value = showWorkCoords
    mocks.requireConfirmRef.value = requireConfirm
    mocks.requireHomingRef.value = requireHoming
    mocks.reverseYRef.value = reverseY
    mocks.activeWcsRef.value = activeWcs

    const vuetify = createVuetify()
    const store = createStore({
        state: {
            socket: {
                isConnected: true,
                hostname: '127.0.0.1',
                port: 7125,
                initializationList: [],
            },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
            },
            printer: {
                print_stats: { state: 'standby' },
                toolhead: {
                    axis_minimum: [0, 0, 0],
                    axis_maximum: [165, 300, 100],
                    position: [10, 20, 5, 0],
                    homed_axes: homedAxes,
                },
                gcode_move: { gcode_position: [1, 2, 3, 0] },
            },
            gui: {
                control: {},
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
        },
    })

    const wrapper = mount(Wcs, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot name="buttons" /><slot /></div>' },
                ConfirmationDialog: {
                    props: ['modelValue', 'title', 'text'],
                    template:
                        '<div data-testid="zero-confirm">' +
                        '<span data-testid="zero-title">{{ title }}</span>' +
                        '<span data-testid="zero-text">{{ text }}</span>' +
                        '<button data-testid="zero-confirm-action" @click="$emit(\'action\')">confirm</button>' +
                        '</div>',
                },
                VDialog: { props: ['modelValue'], template: '<div><slot v-if="modelValue" /></div>' },
                VMenu: { template: '<div><slot name="activator" :props="{}" /><slot /></div>' },
            },
        },
    })

    return wrapper
}

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => {
    const buttons = wrapper.findAll('button')
    const found = buttons.find((b) => b.text().includes(text))
    if (!found) throw new Error(`button with text "${text}" not found`)
    return found
}

const legendCards = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('.offset-preview-legend__card')

describe('Wcs panel', () => {
    it('renders the panel with one legend card per G54-G59 offset', async () => {
        const wrapper = createTestWrapper()
        await flushPromises()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        const cards = legendCards(wrapper as never)
        expect(cards).toHaveLength(offsetNames.length)
        for (const name of offsetNames) {
            expect(cards.some((c) => c.text().includes(name))).toBe(true)
        }
        expect(mocks.refreshWcs).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('hides the panel when klipper is not ready', () => {
        const wrapper = createTestWrapper({ ready: false })
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('hides the panel when the profile disables work coords', () => {
        const wrapper = createTestWrapper({ showWorkCoords: false })
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('selecting another WCS applies it via setActiveWcs', async () => {
        const wrapper = createTestWrapper()
        await flushPromises()
        const cards = legendCards(wrapper as never)
        await cards[1].trigger('click')
        await flushPromises()
        expect(mocks.setActiveWcs).toHaveBeenCalledWith('G55')
        expect(mocks.activeWcsRef.value).toBe('G55')
        wrapper.unmount()
    })

    it('clicking the active WCS is a no-op', async () => {
        const wrapper = createTestWrapper({ activeWcs: 'G54' })
        await flushPromises()
        const cards = legendCards(wrapper as never)
        await cards[0].trigger('click')
        await flushPromises()
        expect(mocks.setActiveWcs).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('surfaces a toast when WCS selection fails', async () => {
        mocks.setActiveWcs.mockRejectedValueOnce(new Error('nope'))
        const wrapper = createTestWrapper()
        await flushPromises()
        const cards = legendCards(wrapper as never)
        await cards[1].trigger('click')
        await flushPromises()
        expect(mocks.toastError).toHaveBeenCalledWith('nope')
        wrapper.unmount()
    })

    it('highlights the active WCS card and shows its origin offsets', async () => {
        const wrapper = createTestWrapper({ activeWcs: 'G55' })
        await flushPromises()
        const cards = legendCards(wrapper as never)
        expect(cards[1].classes()).toContain('offset-preview-legend__card--active')
        expect(cards[0].classes()).not.toContain('offset-preview-legend__card--active')
        // Origin Offset (machine) summary for G55 = X 10 / Y 20 / Z -5
        expect(wrapper.text()).toContain('10.000')
        expect(wrapper.text()).toContain('20.000')
        expect(wrapper.text()).toContain('-5.000')
        // Work Position summary from gcode_position [1, 2, 3]
        expect(wrapper.text()).toContain('1.000')
        expect(wrapper.text()).toContain('2.000')
        expect(wrapper.text()).toContain('3.000')
        wrapper.unmount()
    })

    it('formats integer offsets without decimals and fractional ones with one decimal', async () => {
        const wrapper = createTestWrapper()
        await flushPromises()
        const cards = legendCards(wrapper as never)
        // G55 X=10 renders as "10", G56 X=1.5 renders as "1.5"
        expect(cards[1].text()).toContain('10')
        expect(cards[2].text()).toContain('1.5')
        wrapper.unmount()
    })

    it('defaults missing offsets to zero but still renders all six cards', async () => {
        mocks.wcsOffsetsRef.value = { G54: { X: 1, Y: 2, Z: 3 } } as never
        const wrapper = createTestWrapper()
        await flushPromises()
        const cards = legendCards(wrapper as never)
        expect(cards).toHaveLength(6)
        expect(cards[1].text()).toContain('0')
        wrapper.unmount()
    })

    it('Set Y posts the axis and refreshes offsets', async () => {
        const wrapper = createTestWrapper()
        await flushPromises()
        await findButtonByText(wrapper as never, 'Set Y').trigger('click')
        await flushPromises()
        expect(mocks.setCncZero).toHaveBeenCalledWith('http://127.0.0.1:7125', { axes: ['Y'] })
        expect(mocks.refreshWcs).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('Set All posts X, Y and Z', async () => {
        const wrapper = createTestWrapper()
        await flushPromises()
        await findButtonByText(wrapper as never, 'Set All').trigger('click')
        await flushPromises()
        expect(mocks.setCncZero).toHaveBeenCalledWith('http://127.0.0.1:7125', { axes: ['X', 'Y', 'Z'] })
        wrapper.unmount()
    })

    it('asks for confirmation before zeroing when the profile requires it', async () => {
        const wrapper = createTestWrapper({ requireConfirm: true })
        await flushPromises()
        await findButtonByText(wrapper as never, 'Set X').trigger('click')
        await nextTick()
        // No direct post: the confirmation dialog opens first.
        expect(mocks.setCncZero).not.toHaveBeenCalled()
        expect(wrapper.find('[data-testid="zero-title"]').text()).toBe('Set Work Zero')
        expect(wrapper.find('[data-testid="zero-text"]').text()).toContain('Set X zero')
        await wrapper.find('[data-testid="zero-confirm-action"]').trigger('click')
        await flushPromises()
        expect(mocks.setCncZero).toHaveBeenCalledWith('http://127.0.0.1:7125', { axes: ['X'] })
        expect(mocks.refreshWcs).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('surfaces a toast when set-zero fails', async () => {
        mocks.setCncZero.mockRejectedValueOnce(new Error('zero fail'))
        const wrapper = createTestWrapper()
        await flushPromises()
        await findButtonByText(wrapper as never, 'Set Y').trigger('click')
        await flushPromises()
        expect(mocks.toastError).toHaveBeenCalledWith('zero fail')
        wrapper.unmount()
    })

    it('Reset clears the manual offset inputs', async () => {
        const wrapper = createTestWrapper()
        await flushPromises()
        const inputs = wrapper.findAll('input')
        await inputs[0].setValue('5')
        expect((inputs[0].element as HTMLInputElement).value).toBe('5')
        await findButtonByText(wrapper as never, 'Reset').trigger('click')
        await nextTick()
        expect((wrapper.findAll('input')[0].element as HTMLInputElement).value).toBe('0')
        wrapper.unmount()
    })

    it('disables offset actions when homing is required but axes are unhomed', async () => {
        const wrapper = createTestWrapper({ requireHoming: true, homedAxes: '' })
        await flushPromises()
        expect((findButtonByText(wrapper as never, 'Set X').element as HTMLButtonElement).disabled).toBe(true)
        expect((findButtonByText(wrapper as never, 'Reset').element as HTMLButtonElement).disabled).toBe(true)
        wrapper.unmount()
    })

    it('shows the tool dot only when X and Y are homed', async () => {
        const homed = createTestWrapper({ homedAxes: 'xyz' })
        await flushPromises()
        expect(homed.find('.tool-dot-group').exists()).toBe(true)
        // Tool legend entry shows machine coords (10.0, 20.0)
        expect(homed.text()).toContain('(10.0, 20.0)')
        homed.unmount()

        const unhomed = createTestWrapper({ homedAxes: '' })
        await flushPromises()
        expect(unhomed.find('.tool-dot-group').exists()).toBe(false)
        unhomed.unmount()
    })

    it('toggles offset visibility via the eye icon and persists it', async () => {
        const wrapper = createTestWrapper()
        await flushPromises()
        const eyes = wrapper.findAll('.offset-preview-legend__card-eye')
        await eyes[0].trigger('click')
        await nextTick()
        const stored = localStorage.getItem('cncPreviewHiddenOffsets') ?? ''
        expect(stored).toContain('G54')
        // sortedOffsets renders the active WCS last, so locate the hidden
        // group by its display:none style instead of by index.
        const groups = wrapper.findAll('.offset-rect-group')
        const hidden = groups.filter((g) => (g.attributes('style') ?? '').includes('none'))
        expect(hidden).toHaveLength(1)
        wrapper.unmount()
    })

    it('rejects a stock size larger than the machine', async () => {
        const wrapper = createTestWrapper()
        await flushPromises()
        await wrapper.find('[aria-label="Edit stock size for G54"]').trigger('click')
        await nextTick()
        expect(wrapper.text()).toContain('Stock')
        const inputs = wrapper.findAll('input')
        // Manual X/Y/Z inputs come first; stock fields are name/width/height/depth.
        await inputs[4].setValue('999')
        await nextTick()
        expect(wrapper.text()).toContain('exceeds machine')
        expect((findButtonByText(wrapper as never, 'Save').element as HTMLButtonElement).disabled).toBe(true)
        wrapper.unmount()
    })

    it('saves a valid stock size and clears it when dims are zero', async () => {
        const wrapper = createTestWrapper()
        await flushPromises()
        await wrapper.find('[aria-label="Edit stock size for G54"]').trigger('click')
        await nextTick()
        const inputs = wrapper.findAll('input')
        await inputs[3].setValue('Plate')
        await inputs[4].setValue('50')
        await inputs[5].setValue('40')
        await findButtonByText(wrapper as never, 'Save').trigger('click')
        await nextTick()
        expect(legendCards(wrapper as never)[0].text()).toContain('Plate')
        expect(localStorage.getItem('cncPreviewStockSizes')).toContain('Plate')

        // Zero dims delete the entry again.
        await wrapper.find('[aria-label="Edit stock size for G54"]').trigger('click')
        await nextTick()
        const reopened = wrapper.findAll('input')
        await reopened[4].setValue('0')
        await findButtonByText(wrapper as never, 'Save').trigger('click')
        await nextTick()
        expect(legendCards(wrapper as never)[0].text()).not.toContain('Plate')
        wrapper.unmount()
    })

    it('emits a G53 move when the homed preview is clicked', async () => {
        const wrapper = createTestWrapper({ homedAxes: 'xyz' })
        await flushPromises()
        const svg = wrapper.find('svg.offset-preview-svg')
        await svg.trigger('mousemove', { clientX: 130, clientY: 160 })
        await nextTick()
        await svg.trigger('click')
        await nextTick()
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'printer.gcode.script',
            expect.objectContaining({ script: expect.stringContaining('G53') })
        )
        const script = mocks.socketEmit.mock.calls[0][1].script as string
        expect(script).toMatch(/X\d+\.\d{4} Y\d+\.\d{4}/)
        wrapper.unmount()
    })

    it('shows the cursor tooltip while hovering the preview', async () => {
        const wrapper = createTestWrapper({ homedAxes: 'xyz' })
        await flushPromises()
        await wrapper.find('svg.offset-preview-svg').trigger('mousemove', { clientX: 130, clientY: 160 })
        await nextTick()
        const tooltip = document.body.querySelector('.offset-preview-tooltip')
        expect(tooltip?.textContent).toContain('X 77.4')
        expect(tooltip?.textContent).toContain('Y 154.0')
        wrapper.unmount()
    })

    it('asks to home before moving when the machine is unhomed', async () => {
        const wrapper = createTestWrapper({ homedAxes: '' })
        await flushPromises()
        const svg = wrapper.find('svg.offset-preview-svg')
        await svg.trigger('mousemove', { clientX: 130, clientY: 160 })
        await nextTick()
        await svg.trigger('click')
        await nextTick()
        expect(mocks.socketEmit).not.toHaveBeenCalled()
        expect(wrapper.text()).toContain('Machine Not Homed')
        // Pin fake timers around the confirm: confirmHome() schedules the
        // follow-up move with setTimeout(500), which must not leak into the
        // next test after this wrapper is unmounted.
        vi.useFakeTimers()
        try {
            await findButtonByText(wrapper as never, 'Buttons.Yes').trigger('click')
            await nextTick()
            expect(mocks.socketEmit).toHaveBeenCalledWith(
                'printer.gcode.script',
                { script: 'G28' },
                { loading: 'homeAll' }
            )
        } finally {
            vi.useRealTimers()
        }
        wrapper.unmount()
    })

    it('cancels the pending move when the home dialog is dismissed', async () => {
        const wrapper = createTestWrapper({ homedAxes: '' })
        await flushPromises()
        const svg = wrapper.find('svg.offset-preview-svg')
        await svg.trigger('mousemove', { clientX: 130, clientY: 160 })
        await nextTick()
        await svg.trigger('click')
        await nextTick()
        expect(wrapper.text()).toContain('Machine Not Homed')
        await findButtonByText(wrapper as never, 'Buttons.Cancel').trigger('click')
        await nextTick()
        expect(mocks.socketEmit).not.toHaveBeenCalled()
        expect(wrapper.text()).not.toContain('Machine Not Homed')
        wrapper.unmount()
    })

    it('persists grid step and snap-to-grid choices', async () => {
        const wrapper = createTestWrapper()
        await flushPromises()
        const step25 = wrapper.findAll('.v-list-item').find((item) => item.text().includes('25mm'))
        if (!step25) throw new Error('grid step option "25mm" not found')
        await step25.trigger('click')
        await nextTick()
        expect(localStorage.getItem('cncPreviewGridStep')).toBe('25')

        const panelButtons = wrapper.find('[data-testid="panel"]').findAll('button')
        await panelButtons[0].trigger('click')
        await nextTick()
        expect(localStorage.getItem('cncPreviewSnapToGrid')).toBe('true')
        wrapper.unmount()
    })

    it('renders with reversed Y preview and seeded stock sizes', async () => {
        localStorage.setItem(
            'cncPreviewStockSizes',
            JSON.stringify({ G54: { name: 'Plate', width: 50, height: 40, depth: 0 } })
        )
        const wrapper = createTestWrapper({ reverseY: true })
        await flushPromises()
        expect(legendCards(wrapper as never)[0].text()).toContain('Plate')
        wrapper.unmount()
    })

    it('surfaces a toast when the initial WCS refresh fails', async () => {
        mocks.refreshWcs.mockRejectedValueOnce(new Error('boom'))
        const wrapper = createTestWrapper()
        await flushPromises()
        expect(mocks.toastError).toHaveBeenCalledWith('boom')
        wrapper.unmount()
    })

    it('tolerates corrupt localStorage payloads', async () => {
        localStorage.setItem('cncPreviewHiddenOffsets', 'not-json')
        localStorage.setItem('cncPreviewStockSizes', 'not-json')
        const wrapper = createTestWrapper()
        await flushPromises()
        expect(legendCards(wrapper as never)).toHaveLength(6)
        wrapper.unmount()
    })
})

describe('wcsPreview', () => {
    it('offsets the cursor tooltip from the pointer', () => {
        expect(getCursorTooltipPosition(100, 200)).toEqual({ left: 118, top: 166 })
    })

    it('hides the native cursor over the preview', () => {
        expect(previewCursorStyle).toEqual({ cursor: 'none' })
    })
})
