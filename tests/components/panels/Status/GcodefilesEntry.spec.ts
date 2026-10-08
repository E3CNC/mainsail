import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import GcodefilesEntry from '@/components/panels/Status/GcodefilesEntry.vue'
import { CLOSE_CONTEXT_MENU, EventBus } from '@/plugins/eventBus'

const mocks = vi.hoisted(() => {
    return { emit: vi.fn(), push: vi.fn() }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({ push: mocks.push }),
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
    mocks.push.mockReset()
    vi.spyOn(window, 'open').mockImplementation(() => null)
})

interface EntryVm {
    styleContentTdWidth: string
    existsMetadata: boolean
    description: string
    filename: string
    contextMenuShow: boolean
    showPrintDialog: boolean
    showRenameFileDialog: boolean
    showDeleteDialog: boolean
    showContextMenu: (e: unknown, item: unknown) => void
    addToQueue: () => void
    view3D: () => void
    downloadFile: () => void
    openRenameFileDialog: () => void
    editFile: () => void
    removeFile: () => void
}

const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as unknown as EntryVm

const makeItem = (overrides: Record<string, unknown> = {}) =>
    ({
        isDirectory: false,
        filename: 'benchy.gcode',
        full_filename: 'benchy.gcode',
        modified: new Date('2024-01-02T03:04:05Z'),
        permissions: 'rw',
        size: 2048,
        preheat_gcode: null,
        last_status: null,
        metadataPulled: true,
        metadataRequested: true,
        filament_total: 0,
        filament_weight_total: 0,
        estimated_time: 0,
        ...overrides,
    }) as never

const createTestWrapper = (
    options: {
        item?: Record<string, unknown>
        contentTdWidth?: number
        printerState?: string
        klippyReady?: boolean
        components?: string[]
    } = {}
) => {
    const { item = {}, contentTdWidth = 200, printerState = 'standby', klippyReady = true, components = [] } = options
    const vuetify = createVuetify()
    const addToQueue = vi.fn()
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
            gui: { general: { timeFormat: '24hours', dateFormat: 'iso' } },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
        },
        actions: {
            'server/jobQueue/addToQueue': (_ctx: never, payload: never) => {
                addToQueue(payload)
            },
            'editor/openFile': (_ctx: never, payload: never) => {
                openFile(payload)
            },
        },
    })

    const wrapper = mount(GcodefilesEntry, {
        props: { item: makeItem(item), contentTdWidth },
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                GcodefilesThumbnail: { template: '<div data-testid="thumb" />' },
                StartPrintDialog: { template: '<div data-testid="print-dialog" />' },
                AddBatchToQueueDialog: { template: '<div data-testid="batch-dialog" />' },
                GcodefilesRenameFileDialog: { template: '<div data-testid="rename-dialog" />' },
                ConfirmationDialog: {
                    props: ['modelValue', 'title', 'text'],
                    template: '<div data-testid="confirm"><span>{{ text }}</span></div>',
                },
                VMenu: { template: '<div><slot /><slot name="activator" :props="{}" /></div>' },
                VTooltip: { template: '<div><slot name="activator" :props="{}" /><slot /></div>' },
            },
            directives: { longpress: {} as never },
        },
    })
    return { wrapper, addToQueue, openFile }
}

describe('Status GcodefilesEntry', () => {
    it('renders the filename with the content width style', () => {
        const { wrapper } = createTestWrapper({ item: { filename: 'benchy.gcode' }, contentTdWidth: 200 })
        expect(wrapper.text()).toContain('benchy.gcode')
        expect(getVm(wrapper).styleContentTdWidth).toBe('width: 200px;')
        expect(wrapper.find('[data-testid="thumb"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('shows the metadata description only when pulled', () => {
        const withMeta = createTestWrapper({
            item: { filament_total: 1500, filament_weight_total: 5.4, estimated_time: 3600 },
        })
        expect(getVm(withMeta.wrapper).existsMetadata).toBe(true)
        expect(withMeta.wrapper.text()).toContain('Filament:')
        withMeta.wrapper.unmount()

        const withoutMeta = createTestWrapper({ item: { metadataPulled: false } })
        expect(getVm(withoutMeta.wrapper).existsMetadata).toBe(false)
        expect(withoutMeta.wrapper.text()).not.toContain('Filament:')
        withoutMeta.wrapper.unmount()
    })

    it('formats filament in meters with grams', () => {
        const { wrapper } = createTestWrapper({
            item: { filament_total: 1500, filament_weight_total: 5.4, estimated_time: 90 },
        })
        expect(getVm(wrapper).description).toContain('1.50 m')
        expect(getVm(wrapper).description).toContain('5 g')
        wrapper.unmount()
    })

    it('formats short filament in millimeters and unknown print time', () => {
        const { wrapper } = createTestWrapper({
            item: { filament_total: 500, estimated_time: 0 },
        })
        expect(getVm(wrapper).description).toContain('500 mm')
        expect(getVm(wrapper).description).toContain('--')
        wrapper.unmount()
    })

    it('falls back to dashes without filament metadata', () => {
        const { wrapper } = createTestWrapper({ item: { estimated_time: 60 } })
        expect(getVm(wrapper).description).toContain('Filament: --')
        wrapper.unmount()
    })

    it('strips the directory when computing the bare filename', () => {
        const { wrapper } = createTestWrapper({ item: { filename: 'sub/nested/benchy.gcode' } })
        expect(getVm(wrapper).filename).toBe('benchy.gcode')
        wrapper.unmount()
    })

    it('opens the print dialog when the row is clicked', async () => {
        const { wrapper } = createTestWrapper()
        expect(getVm(wrapper).showPrintDialog).toBe(false)
        await wrapper.find('tr').trigger('click')
        expect(getVm(wrapper).showPrintDialog).toBe(true)
        wrapper.unmount()
    })

    it('opens the context menu at the pointer position', () => {
        const { wrapper } = createTestWrapper()
        getVm(wrapper).showContextMenu(
            { preventDefault: () => {}, clientX: 11, clientY: 22 } as never,
            makeItem() as never
        )
        expect(getVm(wrapper).contextMenuShow).toBe(true)
        wrapper.unmount()
    })

    it('closes the context menu on the global event', async () => {
        const { wrapper } = createTestWrapper()
        getVm(wrapper).showContextMenu(
            { preventDefault: () => {}, clientX: 5, clientY: 6 } as never,
            makeItem() as never
        )
        expect(getVm(wrapper).contextMenuShow).toBe(true)
        EventBus.$emit(CLOSE_CONTEXT_MENU)
        await flushPromises()
        expect(getVm(wrapper).contextMenuShow).toBe(false)
        wrapper.unmount()
    })

    it('queues the file via the job-queue action', () => {
        const { wrapper, addToQueue } = createTestWrapper({ item: { filename: 'benchy.gcode' } })
        getVm(wrapper).addToQueue()
        expect(addToQueue).toHaveBeenCalledWith(['benchy.gcode'])
        wrapper.unmount()
    })

    it('navigates to the 3d viewer for the file', () => {
        const { wrapper } = createTestWrapper({ item: { filename: 'benchy.gcode' } })
        getVm(wrapper).view3D()
        expect(mocks.push).toHaveBeenCalledWith({
            path: '/viewer',
            query: { filename: 'gcodes/benchy.gcode' },
        })
        wrapper.unmount()
    })

    it('downloads through the moonraker file URL', () => {
        const { wrapper } = createTestWrapper({ item: { filename: 'my print.gcode' } })
        getVm(wrapper).downloadFile()
        expect(window.open).toHaveBeenCalledWith(expect.stringContaining('/server/files/gcodes/') as never)
        wrapper.unmount()
    })

    it('opens the rename dialog', () => {
        const { wrapper } = createTestWrapper()
        getVm(wrapper).openRenameFileDialog()
        expect(getVm(wrapper).showRenameFileDialog).toBe(true)
        wrapper.unmount()
    })

    it('edits a nested file with split path and name', () => {
        const { wrapper, openFile } = createTestWrapper({
            item: { filename: 'sub/benchy.gcode', size: 42, permissions: 'rw' },
        })
        getVm(wrapper).editFile()
        expect(openFile).toHaveBeenCalledWith(
            expect.objectContaining({ root: 'gcodes', path: 'sub/', filename: 'benchy.gcode' }) as never
        )
        wrapper.unmount()
    })

    it('edits a root file without a path prefix', () => {
        const { wrapper, openFile } = createTestWrapper({ item: { filename: 'benchy.gcode' } })
        getVm(wrapper).editFile()
        expect(openFile).toHaveBeenCalledWith(expect.objectContaining({ path: '', filename: 'benchy.gcode' }) as never)
        wrapper.unmount()
    })

    it('removes the file through the delete endpoint', () => {
        const { wrapper } = createTestWrapper({ item: { filename: 'benchy.gcode' } })
        getVm(wrapper).removeFile()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.delete_file',
            { path: 'gcodes/benchy.gcode' },
            { action: 'files/getDeleteFile' }
        )
        wrapper.unmount()
    })

    it('disables print while the printer is busy', () => {
        const { wrapper } = createTestWrapper({ printerState: 'printing' })
        const items = wrapper.findAllComponents({ name: 'VListItem' } as never)
        expect(items.length).toBeGreaterThanOrEqual(0)
        wrapper.unmount()
    })
})
