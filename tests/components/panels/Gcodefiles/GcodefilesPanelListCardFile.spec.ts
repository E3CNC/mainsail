import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import GcodefilesPanelListCardFile from '@/components/panels/Gcodefiles/GcodefilesPanelListCardFile.vue'
import { CLOSE_CONTEXT_MENU, EventBus } from '@/plugins/eventBus'

const mocks = vi.hoisted(() => {
    return { emit: vi.fn(), push: vi.fn(), loadCncMetadata: vi.fn(), doSend: vi.fn() }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({ push: mocks.push }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/store/files/cncMetadata', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/store/files/cncMetadata')>()
    return { ...actual, loadCncMetadata: mocks.loadCncMetadata }
})

vi.mock('@/composables/useControl', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/composables/useControl')>()
    return {
        ...actual,
        useControl: () => ({ doSend: mocks.doSend }),
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
    mocks.push.mockReset()
    mocks.doSend.mockReset()
    mocks.loadCncMetadata.mockReset()
    mocks.loadCncMetadata.mockResolvedValue(null)
    vi.spyOn(window, 'open').mockImplementation(() => null)
})

interface CardVm {
    isGcodeFile: boolean
    canStart: boolean
    canPreheat: boolean
    formattedSize: string
    showContextMenu: boolean
    showContextMenuAction: (e: unknown) => void
    addToQueue: () => void
    view3D: () => void
    scanMeta: () => void
    downloadFile: () => void
    editFile: () => void
    deleteFile: () => void
}

const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as unknown as CardVm

const makeItem = (overrides: Record<string, unknown> = {}) =>
    ({
        isDirectory: false,
        filename: 'benchy.gcode',
        full_filename: 'benchy.gcode',
        modified: new Date('2024-01-02T03:04:05Z'),
        permissions: 'rw',
        size: 2048,
        slicer: 'Orca',
        count_printed: 2,
        last_status: 'completed',
        preheat_gcode: 'M104 S200',
        metadataPulled: true,
        metadataRequested: true,
        ...overrides,
    }) as never

const createTestWrapper = (
    options: {
        item?: Record<string, unknown>
        isSelected?: boolean
        printerState?: string
        klippyReady?: boolean
        components?: string[]
        currentPath?: string
    } = {}
) => {
    const {
        item = {},
        isSelected = false,
        printerState = 'standby',
        klippyReady = true,
        components = [],
        currentPath = '',
    } = options
    const vuetify = createVuetify()
    const select = vi.fn()
    const addToQueue = vi.fn()
    const scanMetadata = vi.fn()
    const openFile = vi.fn()
    const store = createStore({
        state: {
            socket: { isConnected: true, hostname: '127.0.0.1', port: 7125, initializationList: [] },
            server: {
                klippy_connected: klippyReady,
                klippy_state: klippyReady ? 'ready' : 'disconnected',
                components,
            },
            printer: { print_stats: { state: printerState } },
            gui: {
                control: {},
                general: { timeFormat: '24hours', dateFormat: 'iso' },
                view: {
                    gcodefiles: {
                        search: '',
                        currentPath,
                        showHiddenFiles: false,
                        showCompletedFiles: true,
                        hideMetadataColumns: [],
                        orderMetadataColumns: [],
                        selectedFiles: [],
                    },
                },
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'files/getGcodeFiles': () => () => [],
            'printer/existsQGL': () => false,
            'printer/existsDeltaCalibrate': () => false,
            'printer/existsFirmwareRetraction': () => false,
            'gui/getDefaultControlActionButton': () => 'extra',
        },
        actions: {
            'server/jobQueue/addToQueue': (_ctx: never, payload: never) => {
                addToQueue(payload)
            },
            'files/scanMetadata': (_ctx: never, payload: never) => {
                scanMetadata(payload)
            },
            'editor/openFile': (_ctx: never, payload: never) => {
                openFile(payload)
            },
        },
    })

    const wrapper = mount(GcodefilesPanelListCardFile, {
        props: { item: makeItem(item), isSelected, select: select as never },
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                GcodefilesThumbnail: { template: '<div data-testid="thumb" />' },
                StartPrintDialog: { template: '<div data-testid="print-dialog" />' },
                AddBatchToQueueDialog: { template: '<div data-testid="batch-dialog" />' },
                GcodefilesRenameFileDialog: { template: '<div data-testid="rename-dialog" />' },
                GcodefilesDuplicateFileDialog: { template: '<div data-testid="dup-dialog" />' },
                ConfirmationDialog: { template: '<div data-testid="confirm" />' },
                VMenu: { template: '<div><slot /><slot name="activator" :props="{}" /></div>' },
                VTooltip: { template: '<div><slot name="activator" :props="{}" /><slot /></div>' },
            },
            directives: { longpress: {} as never },
        },
    })
    return { wrapper, select, addToQueue, scanMetadata, openFile }
}

describe('GcodefilesPanelListCardFile', () => {
    it('renders filename, size, slicer and run count', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(wrapper.text()).toContain('benchy.gcode')
        expect(wrapper.text()).toContain('Orca')
        expect(wrapper.text()).toContain('2')
        expect(wrapper.find('[data-testid="thumb"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('marks the card selected', () => {
        const { wrapper } = createTestWrapper({ isSelected: true })
        expect(wrapper.classes()).toContain('gcode-card--selected')
        wrapper.unmount()
    })

    it('forwards checkbox toggles to select', async () => {
        const { wrapper, select } = createTestWrapper({ isSelected: false })
        await wrapper.find('.gcode-card__checkbox').trigger('click')
        expect(select).toHaveBeenCalledWith(true)
        wrapper.unmount()
    })

    it('treats gcode extensions as printable and txt as not', () => {
        const gcode = createTestWrapper({ item: { filename: 'part.nc' } })
        expect(getVm(gcode.wrapper).isGcodeFile).toBe(true)
        gcode.wrapper.unmount()

        const txt = createTestWrapper({ item: { filename: 'notes.txt' } })
        expect(getVm(txt.wrapper).isGcodeFile).toBe(false)
        txt.wrapper.unmount()
    })

    it('disables start while printing, paused or on error', () => {
        for (const state of ['printing', 'paused', 'error']) {
            const { wrapper } = createTestWrapper({ printerState: state })
            expect(getVm(wrapper).canStart).toBe(false)
            expect(getVm(wrapper).canPreheat).toBe(false)
            wrapper.unmount()
        }
        const { wrapper } = createTestWrapper({ printerState: 'standby' })
        expect(getVm(wrapper).canStart).toBe(true)
        wrapper.unmount()
    })

    it('disables start while klipper is not ready', () => {
        const { wrapper } = createTestWrapper({ klippyReady: false })
        expect(getVm(wrapper).canStart).toBe(false)
        wrapper.unmount()
    })

    it('formats the size and falls back without one', () => {
        const { wrapper } = createTestWrapper({ item: { size: 2048 } })
        expect(getVm(wrapper).formattedSize).not.toBe('--')
        wrapper.unmount()

        const missing = createTestWrapper({ item: { size: undefined } })
        expect(getVm(missing.wrapper).formattedSize).toBe('--')
        missing.wrapper.unmount()
    })

    it('skips metadata loads for non-gcode files', async () => {
        const { wrapper } = createTestWrapper({ item: { filename: 'notes.txt' } })
        await flushPromises()
        expect(mocks.loadCncMetadata).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('loads and renders CNC metadata for gcode files', async () => {
        mocks.loadCncMetadata.mockResolvedValue({
            schema_version: 1,
            cam_tool: 'Fusion',
            tools: [{ id: 'T1', type: 'flat', diameter_mm: 3.175 }],
            spindle_rpm: 12000,
            feeds_mm_per_min: { plunge: 100, cut: 500, rapid: 2000 },
            stock: { x: { size: 100 }, y: { size: 80 }, z: { size: 10 } },
        })
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(mocks.loadCncMetadata).toHaveBeenCalledWith('http://127.0.0.1:7125', 'benchy.gcode')
        expect(wrapper.text()).toContain('Fusion')
        wrapper.unmount()
    })

    it('opens and closes the context menu including the bus event', async () => {
        const { wrapper } = createTestWrapper()
        getVm(wrapper).showContextMenuAction({ preventDefault: () => {}, clientX: 3, clientY: 4 } as never)
        expect(getVm(wrapper).showContextMenu).toBe(true)
        EventBus.$emit(CLOSE_CONTEXT_MENU)
        await flushPromises()
        expect(getVm(wrapper).showContextMenu).toBe(false)
        wrapper.unmount()
    })

    it('queues with the current path and strips a leading slash', () => {
        const { wrapper, addToQueue } = createTestWrapper({ currentPath: '/sub' })
        getVm(wrapper).addToQueue()
        expect(addToQueue).toHaveBeenCalledWith(['/sub/benchy.gcode'.replace(/^\//, '')])
        wrapper.unmount()
    })

    it('navigates to the viewer for the file', () => {
        const { wrapper } = createTestWrapper({ currentPath: '/sub' })
        getVm(wrapper).view3D()
        expect(mocks.push).toHaveBeenCalledWith({
            path: '/viewer',
            query: { filename: 'gcodes/sub/benchy.gcode' },
        })
        wrapper.unmount()
    })

    it('scans metadata then refreshes CNC data', async () => {
        vi.useFakeTimers()
        try {
            const { wrapper, scanMetadata } = createTestWrapper({ currentPath: '' })
            await flushPromises()
            mocks.loadCncMetadata.mockClear()
            getVm(wrapper).scanMeta()
            expect(scanMetadata).toHaveBeenCalledWith({ filename: 'gcodes/benchy.gcode' })
            await vi.advanceTimersByTimeAsync(600)
            await flushPromises()
            expect(mocks.loadCncMetadata).toHaveBeenCalled()
        } finally {
            vi.useRealTimers()
        }
    })

    it('downloads through the gcodes file URL', () => {
        const { wrapper } = createTestWrapper({ currentPath: '' })
        getVm(wrapper).downloadFile()
        expect(window.open).toHaveBeenCalledWith(expect.stringContaining('/server/files/gcodes') as never)
        wrapper.unmount()
    })

    it('opens the editor for the file', () => {
        const { wrapper, openFile } = createTestWrapper({ currentPath: '/sub' })
        getVm(wrapper).editFile()
        expect(openFile).toHaveBeenCalledWith(
            expect.objectContaining({ root: 'gcodes', path: '/sub', filename: 'benchy.gcode' }) as never
        )
        wrapper.unmount()
    })

    it('deletes through the delete endpoint', () => {
        const { wrapper } = createTestWrapper({ currentPath: '' })
        getVm(wrapper).deleteFile()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.delete_file',
            { path: 'gcodes/benchy.gcode' },
            { action: 'files/getDeleteFile' }
        )
        wrapper.unmount()
    })
})
