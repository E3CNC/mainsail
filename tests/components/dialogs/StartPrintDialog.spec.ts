import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import StartPrintDialog from '@/components/dialogs/StartPrintDialog.vue'

const mocks = vi.hoisted(() => {
    return {
        emit: vi.fn(),
        toastError: vi.fn(),
        refreshWcs: vi.fn(),
        setActiveWcs: vi.fn(),
        activeWcsRef: null as unknown as { value: string },
        wcsOffsetsRef: null as unknown as { value: Record<string, { X: number; Y: number; Z: number }> },
    }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('vue-toast-notification', () => ({
    useToast: () => ({ error: mocks.toastError, success: vi.fn() }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key}:${Object.values(params).join(',')}` : key,
    }),
}))

vi.mock('@/composables/useCncOffsets', async () => {
    const { ref } = await import('vue')
    const activeWcs = ref('G54')
    const wcsOffsets = ref<Record<string, { X: number; Y: number; Z: number }>>({
        G54: { X: 0, Y: 0, Z: 0 },
        G55: { X: 10, Y: 20, Z: -5 },
        G56: { X: 0, Y: 0, Z: 0 },
        G57: { X: 0, Y: 0, Z: 0 },
        G58: { X: 0, Y: 0, Z: 0 },
        G59: { X: 0, Y: 0, Z: 0 },
    })
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
    mocks.toastError.mockReset()
    mocks.refreshWcs.mockReset()
    mocks.refreshWcs.mockResolvedValue(undefined)
    mocks.setActiveWcs.mockReset()
    mocks.setActiveWcs.mockResolvedValue(undefined)
    mocks.activeWcsRef.value = 'G54'
    mocks.wcsOffsetsRef.value = {
        G54: { X: 0, Y: 0, Z: 0 },
        G55: { X: 10, Y: 20, Z: -5 },
        G56: { X: 0, Y: 0, Z: 0 },
        G57: { X: 0, Y: 0, Z: 0 },
        G58: { X: 0, Y: 0, Z: 0 },
        G59: { X: 0, Y: 0, Z: 0 },
    }
    vi.spyOn(window.console, 'error').mockImplementation(() => {})
})

interface StartPrintVm {
    startWcsMode: 'current' | 'slot'
    selectedWcsSlot: string
    startingPrint: boolean
    showDivider: boolean
    question: string
    wcsModeItems: { title: string; value: string }[]
    wcsSlotItems: { title: string; value: string }[]
    startPrint: (filename?: string) => Promise<void>
    closeDialog: () => void
}

const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as unknown as StartPrintVm

const makeFile = (overrides: Record<string, unknown> = {}) =>
    ({
        filename: 'benchy.gcode',
        full_filename: 'benchy.gcode',
        metadataPulled: false,
        metadataRequested: false,
        size: 1000,
        modified: new Date('2024-01-02T03:04:05Z'),
        permissions: 'rw',
        ...overrides,
    }) as never

const createTestWrapper = (
    options: {
        modelValue?: boolean
        currentPath?: string
        file?: Record<string, unknown>
        printerState?: string
        klippyReady?: boolean
        components?: string[]
    } = {}
) => {
    const {
        modelValue = true,
        currentPath = '',
        file = {},
        printerState = 'standby',
        klippyReady = true,
        components = [],
    } = options
    const vuetify = createVuetify()
    const requestMetadata = vi.fn()
    const store = createStore({
        state: {
            socket: { isConnected: true, hostname: '127.0.0.1', port: 7125, initializationList: [] },
            server: {
                klippy_connected: klippyReady,
                klippy_state: klippyReady ? 'ready' : 'disconnected',
                components,
            },
            printer: { print_stats: { state: printerState } },
            gui: { general: { timeFormat: '24hours', dateFormat: 'iso' } },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
        },
        actions: {
            'files/requestMetadata': (_ctx: never, payload: never) => {
                requestMetadata(payload)
            },
        },
    })

    const wrapper = mount(StartPrintDialog, {
        props: { modelValue, currentPath, file: makeFile(file) },
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                VDialog: { template: '<div><slot /></div>' },
                StartPrintDialogThumbnail: { template: '<div data-testid="print-thumb" />' },
            },
        },
    })
    return { wrapper, requestMetadata }
}

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => {
    const found = wrapper.findAll('button').find((b) => b.text().includes(text))
    if (!found) throw new Error(`button with text "${text}" not found`)
    return found
}

describe('StartPrintDialog', () => {
    it('renders the headline and the filename question', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(wrapper.text()).toContain('Dialogs.StartPrint.Headline')
        expect(getVm(wrapper).question).toContain('benchy.gcode')
        expect(wrapper.find('[data-testid="print-thumb"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('pulls metadata on open when the file has none yet', async () => {
        const { wrapper, requestMetadata } = createTestWrapper()
        await flushPromises()
        expect(requestMetadata).toHaveBeenCalledWith([{ filename: 'gcodes/benchy.gcode' }])
        wrapper.unmount()
    })

    it('prefixes the current path when requesting metadata', async () => {
        const { wrapper, requestMetadata } = createTestWrapper({ currentPath: '/sub' })
        await flushPromises()
        expect(requestMetadata).toHaveBeenCalledWith([{ filename: 'gcodes/sub/benchy.gcode' }])
        wrapper.unmount()
    })

    it('skips the metadata request when metadata is already present', async () => {
        const { wrapper, requestMetadata } = createTestWrapper({
            file: { metadataPulled: true },
        })
        await flushPromises()
        expect(requestMetadata).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('refreshes WCS on open and syncs the slot selector', async () => {
        mocks.activeWcsRef.value = 'G55'
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(mocks.refreshWcs).toHaveBeenCalled()
        expect(getVm(wrapper).selectedWcsSlot).toBe('G55')
        expect(getVm(wrapper).startWcsMode).toBe('slot')
        wrapper.unmount()
    })

    it('tolerates a WCS refresh failure', async () => {
        mocks.refreshWcs.mockRejectedValueOnce(new Error('wcs down'))
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(window.console.error).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('exposes current and slot WCS mode items', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        const vm = getVm(wrapper)
        expect(vm.wcsModeItems).toHaveLength(2)
        expect(vm.wcsModeItems.map((i) => i.value)).toEqual(['current', 'slot'])
        expect(vm.wcsSlotItems).toHaveLength(6)
        expect(vm.wcsSlotItems.map((i) => i.value)).toEqual(['G54', 'G55', 'G56', 'G57', 'G58', 'G59'])
        expect(vm.wcsModeItems[0].title).toContain('G54')
        wrapper.unmount()
    })

    it('starts the print in slot mode after switching WCS', async () => {
        const { wrapper } = createTestWrapper({ currentPath: '' })
        await flushPromises()
        getVm(wrapper).selectedWcsSlot = 'G55'
        await findButtonByText(wrapper as never, 'Dialogs.StartPrint.Print').trigger('click')
        await flushPromises()
        expect(mocks.setActiveWcs).toHaveBeenCalledWith('G55')
        expect(mocks.emit).toHaveBeenCalledWith(
            'printer.print.start',
            { filename: 'benchy.gcode' },
            { action: 'switchToDashboard' }
        )
        expect(wrapper.emitted('update:modelValue')!.flat()).toContain(false)
        expect(getVm(wrapper).startingPrint).toBe(false)
        wrapper.unmount()
    })

    it('strips a leading slash and keeps the subdirectory in the payload', async () => {
        const { wrapper } = createTestWrapper({ currentPath: '/sub' })
        await flushPromises()
        await findButtonByText(wrapper as never, 'Dialogs.StartPrint.Print').trigger('click')
        await flushPromises()
        expect(mocks.emit).toHaveBeenCalledWith(
            'printer.print.start',
            { filename: 'sub/benchy.gcode' },
            { action: 'switchToDashboard' }
        )
        wrapper.unmount()
    })

    it('skips the WCS switch in current mode', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        getVm(wrapper).startWcsMode = 'current'
        await findButtonByText(wrapper as never, 'Dialogs.StartPrint.Print').trigger('click')
        await flushPromises()
        expect(mocks.setActiveWcs).not.toHaveBeenCalled()
        expect(mocks.emit).toHaveBeenCalledWith(
            'printer.print.start',
            expect.objectContaining({ filename: 'benchy.gcode' }),
            expect.anything() as never
        )
        wrapper.unmount()
    })

    it('toasts when the WCS switch fails and does not emit print start', async () => {
        mocks.setActiveWcs.mockRejectedValueOnce(new Error('switch failed'))
        const { wrapper } = createTestWrapper()
        await flushPromises()
        await findButtonByText(wrapper as never, 'Dialogs.StartPrint.Print').trigger('click')
        await flushPromises()
        expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('Dialogs.StartPrint.WcsSwitchFailed'))
        expect(mocks.emit).not.toHaveBeenCalled()
        expect(getVm(wrapper).startingPrint).toBe(false)
        wrapper.unmount()
    })

    it('disables print while the printer is busy', async () => {
        const { wrapper } = createTestWrapper({ printerState: 'printing' })
        await flushPromises()
        expect(
            (findButtonByText(wrapper as never, 'Dialogs.StartPrint.Print').element as HTMLButtonElement).disabled
        ).toBe(true)
        wrapper.unmount()
    })

    it('disables print while klipper is not ready', async () => {
        const { wrapper } = createTestWrapper({ klippyReady: false })
        await flushPromises()
        expect(
            (findButtonByText(wrapper as never, 'Dialogs.StartPrint.Print').element as HTMLButtonElement).disabled
        ).toBe(true)
        wrapper.unmount()
    })

    it('shows the timelapse divider only when the component exists', async () => {
        const withTl = createTestWrapper({ components: ['timelapse'] })
        await flushPromises()
        expect(getVm(withTl.wrapper).showDivider).toBe(true)
        withTl.wrapper.unmount()

        const withoutTl = createTestWrapper({ components: [] })
        await flushPromises()
        expect(getVm(withoutTl.wrapper).showDivider).toBe(false)
        withoutTl.wrapper.unmount()
    })

    it('cancels by emitting update:modelValue false', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        await findButtonByText(wrapper as never, 'Buttons.Cancel').trigger('click')
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
        wrapper.unmount()
    })
})
