import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import GcodefilesPanelHeader from '@/components/panels/Gcodefiles/GcodefilesPanelHeader.vue'

const mocks = vi.hoisted(() => {
    return { emit: vi.fn(), toastSuccess: vi.fn() }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('vue-toast-notification', () => ({
    useToast: () => ({ success: mocks.toastSuccess, error: vi.fn() }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}:${Object.values(params).join(',')}` : key,
    }),
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
    mocks.toastSuccess.mockReset()
})

interface HeaderVm {
    gcodeInputFileAccept: string[]
    selectedFilePaths: string[]
    deleteSelectedText: string
    downloadSelectedFiles: () => void
    uploadFile: () => Promise<void>
    clickUploadButton: () => void
    refreshFileList: () => void
    deleteSelectedFiles: () => void
    fileUpload: HTMLInputElement | null
}

const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as unknown as HeaderVm

const createTestWrapper = (
    options: {
        selectedFiles?: unknown[]
        currentPath?: string
        uploadResult?: string | false
        gcodeFiles?: { filename: string }[]
    } = {}
) => {
    const { selectedFiles = [], currentPath = '', uploadResult = 'ok.gcode', gcodeFiles = [] } = options
    const vuetify = createVuetify()
    const dispatched: { name: string; payload: unknown }[] = []
    const uploadFileAction = vi.fn().mockResolvedValue(uploadResult)
    const store = createStore({
        state: {
            socket: { isConnected: true, hostname: '127.0.0.1', port: 7125, initializationList: [] },
            server: { klippy_connected: true, klippy_state: 'ready', components: [] },
            printer: { print_stats: { state: 'standby' } },
            gui: {
                general: { timeFormat: '24hours', dateFormat: 'iso' },
                view: {
                    gcodefiles: {
                        search: '',
                        currentPath,
                        showHiddenFiles: false,
                        showCompletedFiles: true,
                        hideMetadataColumns: [],
                        orderMetadataColumns: [],
                        selectedFiles: [...selectedFiles],
                    },
                },
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'files/getGcodeFiles': () => () => gcodeFiles,
        },
        actions: {
            'gui/saveSetting': (_ctx: never, payload: { name: string; value: unknown }) => {
                dispatched.push({ name: 'gui/saveSetting', payload })
                if (payload.name === 'view.gcodefiles.selectedFiles') {
                    ;(
                        _ctx as unknown as { state: { gui: { view: { gcodefiles: { selectedFiles: unknown[] } } } } }
                    ).state.gui.view.gcodefiles.selectedFiles = payload.value as unknown[]
                }
            },
            'socket/addLoading': () => {},
            'socket/removeLoading': () => {},
            'files/uploadSetCurrentNumber': () => {},
            'files/uploadSetMaxNumber': () => {},
            'files/uploadIncrementCurrentNumber': () => {},
            'files/uploadFile': (_ctx: never, payload: never) => uploadFileAction(payload),
        },
    })

    const wrapper = mount(GcodefilesPanelHeader, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                ConfirmationDialog: {
                    props: ['modelValue', 'title', 'text'],
                    template:
                        '<div data-testid="confirm"><span data-testid="confirm-text">{{ text }}</span>' +
                        '<button data-testid="confirm-action" @click="$emit(\'action\')">ok</button></div>',
                },
                GcodefilesCreateDirectoryDialog: { template: '<div data-testid="mkdir-dialog" />' },
                GcodefilesPanelHeaderSettings: { template: '<div data-testid="header-settings" />' },
            },
        },
    })
    return { wrapper, dispatched, uploadFileAction }
}

describe('GcodefilesPanelHeader', () => {
    it('renders search, upload, mkdir and refresh controls', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('input[type="file"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="header-settings"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="mkdir-dialog"]').exists()).toBe(true)
        expect(getVm(wrapper).gcodeInputFileAccept).toContain('.gcode')
        wrapper.unmount()
    })

    it('keeps only non-empty string selections', () => {
        const { wrapper } = createTestWrapper({
            selectedFiles: ['gcodes/a.gcode', '', 42, null],
        })
        expect(getVm(wrapper).selectedFilePaths).toEqual(['gcodes/a.gcode'])
        wrapper.unmount()
    })

    it('describes a single-file delete with the basename', () => {
        const { wrapper } = createTestWrapper({ selectedFiles: ['gcodes/sub/benchy.gcode'] })
        expect(getVm(wrapper).deleteSelectedText).toContain('benchy.gcode')
        wrapper.unmount()
    })

    it('describes a multi-file delete with the count', () => {
        const { wrapper } = createTestWrapper({ selectedFiles: ['gcodes/a.gcode', 'gcodes/b.gcode'] })
        expect(getVm(wrapper).deleteSelectedText).toContain('2')
        wrapper.unmount()
    })

    it('downloads a single selection directly and clears it', async () => {
        vi.spyOn(window, 'open').mockImplementation(() => null)
        const { wrapper, dispatched } = createTestWrapper({ selectedFiles: ['gcodes/sub/benchy.gcode'] })
        getVm(wrapper).downloadSelectedFiles()
        expect(window.open).toHaveBeenCalledWith(
            expect.stringContaining('/server/files/gcodes/sub/benchy.gcode') as never
        )
        expect(dispatched.map((d) => (d.payload as { name: string }).name)).toContain('view.gcodefiles.selectedFiles')
        wrapper.unmount()
    })

    it('zips multiple selections through the socket', () => {
        const { wrapper } = createTestWrapper({ selectedFiles: ['gcodes/a.gcode', 'gcodes/b.gcode'] })
        getVm(wrapper).downloadSelectedFiles()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.zip',
            expect.objectContaining({ items: ['gcodes/a.gcode', 'gcodes/b.gcode'] }) as never,
            expect.objectContaining({ action: 'files/downloadZip' }) as never
        )
        wrapper.unmount()
    })

    it('ignores uploads without files', async () => {
        const { wrapper, uploadFileAction } = createTestWrapper()
        await getVm(wrapper).uploadFile()
        expect(uploadFileAction).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('uploads each chosen file with progress dispatches and a toast', async () => {
        const { wrapper, uploadFileAction } = createTestWrapper({ currentPath: '/sub' })
        const input = wrapper.find('input[type="file"]')
        const file = new File(['gcode'], 'benchy.gcode')
        Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
        await getVm(wrapper).uploadFile()
        await flushPromises()
        expect(uploadFileAction).toHaveBeenCalledWith(expect.objectContaining({ path: 'sub', root: 'gcodes' }) as never)
        expect(mocks.toastSuccess).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('skips the toast when the upload result is false', async () => {
        const { wrapper } = createTestWrapper({ uploadResult: false })
        const input = wrapper.find('input[type="file"]')
        const file = new File(['gcode'], 'benchy.gcode')
        Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
        await getVm(wrapper).uploadFile()
        expect(mocks.toastSuccess).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('forwards the upload click to the hidden file input', () => {
        const { wrapper } = createTestWrapper()
        const spy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
        getVm(wrapper).clickUploadButton()
        expect(spy).toHaveBeenCalled()
        spy.mockRestore()
        wrapper.unmount()
    })

    it('refreshes the current directory through the socket', () => {
        const { wrapper } = createTestWrapper({ currentPath: '/sub' })
        getVm(wrapper).refreshFileList()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'gcodes/sub' },
            { action: 'files/getDirectory' }
        )
        wrapper.unmount()
    })

    it('deletes every selected path then clears the selection', () => {
        const { wrapper } = createTestWrapper({ selectedFiles: ['gcodes/a.gcode', 'gcodes/b.gcode'] })
        getVm(wrapper).deleteSelectedFiles()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.delete_file',
            { path: 'gcodes/a.gcode' },
            { action: 'files/getDeleteFile' }
        )
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.delete_file',
            { path: 'gcodes/b.gcode' },
            { action: 'files/getDeleteFile' }
        )
        wrapper.unmount()
    })

    it('shows download and delete actions only with a selection', async () => {
        const empty = createTestWrapper({ selectedFiles: [] })
        expect(empty.wrapper.html()).not.toContain('Files.Download')
        empty.wrapper.unmount()

        const filled = createTestWrapper({ selectedFiles: ['gcodes/a.gcode'] })
        await flushPromises()
        expect(filled.wrapper.html()).toContain('Files.Download')
        filled.wrapper.unmount()
    })
})
