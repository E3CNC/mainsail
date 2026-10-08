import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import ConfigFilesPanel from '@/components/panels/Machine/ConfigFilesPanel.vue'
import type { FileStateFile } from '@/store/files/types'

const mocks = vi.hoisted(() => {
    return {
        socketEmit: vi.fn(),
        toastSuccess: vi.fn(),
        axiosPost: vi.fn(),
        saveSetting: vi.fn(),
        openFile: vi.fn(),
        uploadFile: vi.fn(),
        openMock: vi.fn(),
        uploadResult: 'uploaded.cfg' as string | false,
    }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.socketEmit }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('vue-toast-notification', () => ({
    useToast: () => ({ success: mocks.toastSuccess, error: vi.fn() }),
}))

vi.mock('axios', () => ({
    default: { post: (...args: unknown[]) => mocks.axiosPost(...args) },
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
    window.open = mocks.openMock as never
})

beforeEach(() => {
    mocks.socketEmit.mockReset()
    mocks.toastSuccess.mockReset()
    mocks.axiosPost.mockReset()
    mocks.axiosPost.mockResolvedValue({})
    mocks.saveSetting.mockReset()
    mocks.openFile.mockReset()
    mocks.uploadFile.mockReset()
    mocks.openMock.mockReset()
    mocks.openMock.mockReturnValue(null)
    mocks.uploadResult = 'uploaded.cfg'
    globalThis.fetch = vi.fn().mockResolvedValue({
        text: () => Promise.resolve('<svg></svg>'),
    }) as never
})

const baseFiles = (): FileStateFile[] => [
    {
        isDirectory: false,
        filename: 'printer.cfg',
        modified: new Date('2024-01-02T03:04:05Z'),
        permissions: 'rw',
        size: 2048,
    },
    {
        isDirectory: false,
        filename: 'moonraker.conf',
        modified: new Date('2024-02-03T04:05:06Z'),
        permissions: 'rw',
        size: 1024,
    },
    {
        isDirectory: true,
        filename: 'myfolder',
        modified: new Date('2024-01-10T00:00:00Z'),
        permissions: 'rw',
        childrens: [
            {
                isDirectory: false,
                filename: 'nested.cfg',
                modified: new Date('2024-01-11T00:00:00Z'),
                permissions: 'rw',
                size: 512,
            },
        ],
    },
]

const PanelStub = {
    props: ['title', 'cardClass', 'icon', 'collapsible', 'marginBottom'],
    template: '<div data-testid="panel" :data-title="title"><slot name="buttons" /><slot /></div>',
}

const PathNavigationStub = {
    props: ['path', 'baseDirectoryLabel', 'onSegmentClick'],
    template:
        '<div data-testid="path-nav"><button data-testid="pathnav-root" type="button" @click="onSegmentClick({ location: \'\' })">root</button></div>',
}

const ConfirmationDialogStub = {
    props: ['modelValue', 'title', 'text', 'actionButtonText'],
    emits: ['action', 'update:modelValue'],
    template:
        '<div class="confirm-stub" :data-title="title"><button data-testid="confirm-action" type="button" @click="$emit(\'action\')">{{ actionButtonText }}</button></div>',
}

const VDialogStub = {
    props: ['modelValue'],
    template: '<div class="vdialog-stub"><slot /></div>',
}

const VMenuStub = {
    props: ['modelValue'],
    template: '<div class="vmenu-stub"><slot /><slot name="activator" /></div>',
}

const VTooltipStub = {
    template: '<div class="vtooltip-stub"><slot /><slot name="activator" /></div>',
}

const VListStub = {
    template: '<div class="vlist-stub"><slot /></div>',
}

const VListItemStub = {
    template: '<div class="vlistitem-stub" @click="$emit(\'click\', $event)"><slot /></div>',
}

const VDataTableStub = {
    props: ['modelValue', 'page', 'itemsPerPage', 'items'],
    emits: ['update:modelValue', 'update:page', 'update:itemsPerPage'],
    template: `<div data-testid="datatable">
        <slot name="header.filename" /><slot name="header.size" /><slot name="header.modified" /><slot name="header.filetype" />
        <slot name="body.prepend" />
        <template v-if="!(items ?? []).length"><slot name="no-data" /></template>
        <template v-for="(item, index) in (items ?? [])" :key="index">
            <slot name="item" :index="index" :item="item" />
        </template>
        <slot name="bottom" />
    </div>`,
}

const VSelectStub = {
    props: ['modelValue', 'items', 'label'],
    emits: ['update:modelValue', 'change'],
    template: `<select class="vselect-stub" :value="String(modelValue ?? '')"
        @change="$emit('update:modelValue', $event.target.value); $emit('change', $event)">
        <option v-for="(o, i) in (items ?? [])" :key="i" :value="typeof o === 'object' ? o.value : o">{{ typeof o === 'object' ? o.title : o }}</option>
    </select>`,
}

const VTextFieldStub = {
    props: ['modelValue', 'label', 'rules'],
    emits: ['update:modelValue', 'update:error'],
    methods: {
        focus() {},
    },
    template:
        '<input class="vtextfield-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'update:error\', false)" />',
}

const VCheckboxStub = {
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
    template:
        '<input type="checkbox" class="vcheckbox-stub" :checked="!!modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
}

const DivStub = {
    template: '<div><slot /></div>',
}

interface WrapperOptions {
    registeredDirectories?: string[]
    children?: FileStateFile[]
    permissions?: string
    currentPath?: string
    rootPath?: string
    selectedFiles?: FileStateFile[]
    showHiddenFiles?: boolean
    hideBackupFiles?: boolean
    sortBy?: string
    sortDesc?: boolean
    countPerPage?: number
}

const createTestWrapper = (options: WrapperOptions = {}) => {
    const {
        registeredDirectories = ['config', 'logs'],
        children = baseFiles(),
        permissions = 'rw',
        currentPath = '',
        rootPath = 'config',
        selectedFiles = [],
        showHiddenFiles = false,
        hideBackupFiles = false,
        sortBy = 'filename',
        sortDesc = false,
        countPerPage = 10,
    } = options

    const vuetify = createVuetify()

    const guiState = {
        general: { timeFormat: '24hours', dateFormat: 'iso' },
        uiSettings: { mode: 'dark' },
        view: {
            blockFileUpload: false,
            configfiles: {
                countPerPage,
                sortBy,
                sortDesc,
                showHiddenFiles,
                hideBackupFiles,
                currentPath,
                rootPath,
                selectedFiles: [...selectedFiles],
            },
        },
    }

    const store = createStore({
        state: {
            socket: {
                isConnected: true,
                hostname: '127.0.0.1',
                port: 7125,
                initializationList: [],
                loadings: [],
            },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                registered_directories: registeredDirectories,
                components: [],
                config: {},
            },
            printer: { print_stats: { state: 'standby' } },
            gui: guiState,
            files: { filetree: [] },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'socket/getHostUrl': () => 'http://127.0.0.1:7125',
            'files/getDirectory': () => (requestedPath: string) => {
                let path = requestedPath
                if (path.startsWith('/')) path = path.substring(1)
                if (path.split('/')[0] !== rootPath) return null
                return {
                    isDirectory: true,
                    filename: rootPath,
                    modified: new Date(),
                    permissions,
                    disk_usage: { free: 524288000, used: 104857600, total: 629145600 },
                    childrens: children,
                }
            },
        },
        actions: {
            'gui/saveSetting': (context: never, payload: never) => {
                const { name, value } = payload as unknown as { name: string; value: unknown }
                mocks.saveSetting({ name, value })
                // walk from the reactive store state so dependents re-render
                const rootState = (context as unknown as { state: Record<string, unknown> }).state
                const parts = name.split('.')
                let target = rootState.gui as unknown as Record<string, unknown>
                for (let i = 0; i < parts.length - 1; i++) {
                    target = target[parts[i]] as Record<string, unknown>
                }
                target[parts[parts.length - 1]] = value
            },
            'editor/openFile': (_context: never, payload: never) => {
                mocks.openFile(payload)
            },
            'socket/addLoading': () => {},
            'socket/removeLoading': () => {},
            'files/uploadSetCurrentNumber': () => {},
            'files/uploadSetMaxNumber': () => {},
            'files/uploadIncrementCurrentNumber': () => {},
            'files/uploadFile': (_context: never, payload: never) => {
                mocks.uploadFile(payload)
                return Promise.resolve(mocks.uploadResult)
            },
        },
    })

    const wrapper = mount(ConfigFilesPanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (key: string) => key },
            stubs: {
                Panel: PanelStub,
                PathNavigation: PathNavigationStub,
                ConfirmationDialog: ConfirmationDialogStub,
                VDialog: VDialogStub,
                VMenu: VMenuStub,
                VTooltip: VTooltipStub,
                VList: VListStub,
                VListItem: VListItemStub,
                VDataTable: VDataTableStub,
                VSelect: VSelectStub,
                VTextField: VTextFieldStub,
                VCheckbox: VCheckboxStub,
                VIcon: DivStub,
                VCardText: DivStub,
                VCardActions: DivStub,
                VRow: DivStub,
                VCol: DivStub,
                VSpacer: DivStub,
                VDivider: DivStub,
                VAlert: DivStub,
                VSnackbar: DivStub,
                VProgressLinear: DivStub,
            },
            directives: { longpress: {} },
        },
    })

    return { wrapper, store }
}

type TestWrapper = ReturnType<typeof createTestWrapper>['wrapper']

const mainPanel = (wrapper: TestWrapper) => wrapper.find('[data-title="Machine.ConfigFilesPanel.ConfigFiles"]')

const toolButtons = (wrapper: TestWrapper) => mainPanel(wrapper).findAll('button.machine-configfiles-panel__tool-btn')

const dialogPanel = (wrapper: TestWrapper, title: string) => {
    const panel = wrapper.find(`[data-title="${title}"]`)
    if (!panel.exists()) throw new Error(`dialog panel "${title}" not found`)
    return panel
}

const dialogInput = (wrapper: TestWrapper, title: string) => dialogPanel(wrapper, title).find('input')

const dialogActionButton = (wrapper: TestWrapper, title: string, text: string) => {
    const found = dialogPanel(wrapper, title)
        .findAll('button')
        .find((button) => button.text().trim() === text)
    if (!found) throw new Error(`button "${text}" not found in dialog "${title}"`)
    return found
}

const findDivByText = (wrapper: TestWrapper, text: string) => {
    const found = wrapper.findAll('.vlistitem-stub').find((item) => item.text().includes(text))
    if (!found) throw new Error(`menu item with text "${text}" not found`)
    return found
}

const confirmStubs = (wrapper: TestWrapper) => wrapper.findAll('.confirm-stub')

describe('ConfigFilesPanel toolbar actions', () => {
    it('refreshes the file list through the toolbar button', async () => {
        const { wrapper } = createTestWrapper()
        const buttons = toolButtons(wrapper)
        // upload, create file, create directory, refresh + settings cog
        await buttons[3].trigger('click')
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'config' },
            { action: 'files/getDirectory' }
        )
        wrapper.unmount()
    })

    it('triggers the hidden file input through the upload button', async () => {
        const { wrapper } = createTestWrapper()
        const input = wrapper.find('#config-files-upload')
        const clickSpy = vi.spyOn(input.element as HTMLElement, 'click').mockImplementation(() => {})
        await toolButtons(wrapper)[0].trigger('click')
        expect(clickSpy).toHaveBeenCalled()
        clickSpy.mockRestore()
        wrapper.unmount()
    })

    it('downloads a single selected file and clears the selection', async () => {
        const files = baseFiles()
        const { wrapper } = createTestWrapper({ selectedFiles: [files[0]] })
        // download is the first toolbar button when files are selected
        await toolButtons(wrapper)[0].trigger('click')
        expect(mocks.openMock).toHaveBeenCalled()
        const href = mocks.openMock.mock.calls[0][0] as string
        expect(href).toContain('printer.cfg')
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.configfiles.selectedFiles',
            value: [],
        })
        wrapper.unmount()
    })

    it('zips multiple selected files including nested directory children', async () => {
        const files = baseFiles()
        const { wrapper } = createTestWrapper({ selectedFiles: [files[0], files[2]] })
        await toolButtons(wrapper)[0].trigger('click')
        expect(mocks.openMock).not.toHaveBeenCalled()
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'server.files.zip',
            {
                items: ['/config/printer.cfg', '/config/myfolder/nested.cfg'],
                dest: expect.stringContaining('config/config-'),
            },
            { action: 'files/downloadZip', loading: 'configDownloadZip' }
        )
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.configfiles.selectedFiles',
            value: [],
        })
        wrapper.unmount()
    })

    it('opens the delete confirmation for selected files from the toolbar', async () => {
        const files = baseFiles()
        const { wrapper } = createTestWrapper({ selectedFiles: [files[0]] })
        // delete is the second toolbar button when files are selected
        await toolButtons(wrapper)[1].trigger('click')
        expect(mocks.socketEmit).not.toHaveBeenCalled()
        wrapper.unmount()
    })
})

describe('ConfigFilesPanel create, rename and duplicate flows', () => {
    it('creates a file through the create dialog via axios upload', async () => {
        const { wrapper } = createTestWrapper()
        await toolButtons(wrapper)[1].trigger('click')
        await dialogInput(wrapper, 'Machine.ConfigFilesPanel.CreateFile').setValue('new.cfg')
        await dialogActionButton(
            wrapper,
            'Machine.ConfigFilesPanel.CreateFile',
            'Machine.ConfigFilesPanel.Create'
        ).trigger('click')
        await Promise.resolve()
        expect(mocks.axiosPost).toHaveBeenCalled()
        const [url, formData] = mocks.axiosPost.mock.calls[0] as [string, FormData, unknown]
        expect(url).toBe('http://127.0.0.1:7125/server/files/upload')
        expect(formData.get('root')).toBe('config')
        expect(mocks.toastSuccess).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('logs an error without toast when file creation fails', async () => {
        mocks.axiosPost.mockRejectedValue(new Error('disk full'))
        const errorSpy = vi.spyOn(window.console, 'error').mockImplementation(() => {})
        const { wrapper } = createTestWrapper()
        await toolButtons(wrapper)[1].trigger('click')
        await dialogInput(wrapper, 'Machine.ConfigFilesPanel.CreateFile').setValue('new.cfg')
        await dialogActionButton(
            wrapper,
            'Machine.ConfigFilesPanel.CreateFile',
            'Machine.ConfigFilesPanel.Create'
        ).trigger('click')
        await Promise.resolve()
        expect(errorSpy).toHaveBeenCalledWith('Error create file: new.cfg')
        expect(mocks.toastSuccess).not.toHaveBeenCalled()
        errorSpy.mockRestore()
        wrapper.unmount()
    })

    it('creates a directory through the create directory dialog', async () => {
        const { wrapper } = createTestWrapper()
        await toolButtons(wrapper)[2].trigger('click')
        await dialogInput(wrapper, 'Machine.ConfigFilesPanel.CreateDirectory').setValue('newdir')
        await dialogActionButton(
            wrapper,
            'Machine.ConfigFilesPanel.CreateDirectory',
            'Machine.ConfigFilesPanel.Create'
        ).trigger('click')
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'server.files.post_directory',
            { path: 'config/newdir' },
            { action: 'files/getCreateDir' }
        )
        wrapper.unmount()
    })

    it('renames a file through the context menu rename dialog', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="printer.cfg"]').trigger('contextmenu')
        await findDivByText(wrapper, 'Machine.ConfigFilesPanel.Rename').trigger('click')
        await dialogInput(wrapper, 'Machine.ConfigFilesPanel.RenameFile').setValue('renamed.cfg')
        await dialogActionButton(
            wrapper,
            'Machine.ConfigFilesPanel.RenameFile',
            'Machine.ConfigFilesPanel.Rename'
        ).trigger('click')
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'server.files.move',
            { source: 'config/printer.cfg', dest: 'config/renamed.cfg' },
            { action: 'files/getMove' }
        )
        wrapper.unmount()
    })

    it('duplicates a file through the context menu duplicate dialog', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="printer.cfg"]').trigger('contextmenu')
        await findDivByText(wrapper, 'Machine.ConfigFilesPanel.Duplicate').trigger('click')
        await dialogInput(wrapper, 'Machine.ConfigFilesPanel.DuplicateFile').setValue('copy.cfg')
        await dialogActionButton(
            wrapper,
            'Machine.ConfigFilesPanel.DuplicateFile',
            'Machine.ConfigFilesPanel.Duplicate'
        ).trigger('click')
        expect(mocks.socketEmit).toHaveBeenCalledWith('server.files.copy', {
            source: 'config/printer.cfg',
            dest: 'config/copy.cfg',
        })
        wrapper.unmount()
    })

    it('renames a directory through the context menu', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="myfolder"]').trigger('contextmenu')
        await findDivByText(wrapper, 'Machine.ConfigFilesPanel.Rename').trigger('click')
        await dialogInput(wrapper, 'Machine.ConfigFilesPanel.RenameDirectory').setValue('newfolder')
        await dialogActionButton(
            wrapper,
            'Machine.ConfigFilesPanel.RenameDirectory',
            'Machine.ConfigFilesPanel.Rename'
        ).trigger('click')
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'server.files.move',
            { source: 'config/myfolder', dest: 'config/newfolder' },
            { action: 'files/getMove' }
        )
        wrapper.unmount()
    })
})

describe('ConfigFilesPanel delete flows', () => {
    it('deletes a single file after context menu delete confirmation', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="printer.cfg"]').trigger('contextmenu')
        await findDivByText(wrapper, 'Buttons.Delete').trigger('click')
        // second confirmation dialog is the single-file delete
        await confirmStubs(wrapper)[1].find('button').trigger('click')
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'server.files.delete_file',
            { path: '/config/printer.cfg' },
            { action: 'files/getDeleteFile' }
        )
        wrapper.unmount()
    })

    it('deletes a directory after confirmation', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="myfolder"]').trigger('contextmenu')
        await findDivByText(wrapper, 'Buttons.Delete').trigger('click')
        await confirmStubs(wrapper)[0].find('button').trigger('click')
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'server.files.delete_directory',
            { path: '/config/myfolder', force: true },
            { action: 'files/getDeleteDir' }
        )
        wrapper.unmount()
    })

    it('deletes selected files and directories in one pass', async () => {
        const files = baseFiles()
        const { wrapper } = createTestWrapper({ selectedFiles: [files[0], files[2]] })
        // third confirmation dialog handles the multi selection
        await confirmStubs(wrapper)[2].find('button').trigger('click')
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'server.files.delete_file',
            { path: '/config/printer.cfg' },
            { action: 'files/getDeleteFile' }
        )
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'server.files.delete_directory',
            { path: '/config/myfolder', force: true },
            { action: 'files/getDeleteDir' }
        )
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.configfiles.selectedFiles',
            value: [],
        })
        wrapper.unmount()
    })
})

describe('ConfigFilesPanel upload flow', () => {
    it('uploads chosen files and toasts each success', async () => {
        const { wrapper } = createTestWrapper()
        const input = wrapper.find('#config-files-upload')
        Object.defineProperty(input.element, 'files', {
            value: [new File(['a'], 'a.cfg'), new File(['b'], 'b.cfg')],
            configurable: true,
        })
        await input.trigger('change')
        await flushPromises()
        expect(mocks.uploadFile).toHaveBeenCalledTimes(2)
        expect(mocks.uploadFile).toHaveBeenCalledWith({
            file: expect.any(File),
            path: '',
            root: 'config',
        })
        expect(mocks.toastSuccess).toHaveBeenCalledTimes(2)
        wrapper.unmount()
    })

    it('skips the upload sequence when no file was chosen', async () => {
        const { wrapper } = createTestWrapper()
        const input = wrapper.find('#config-files-upload')
        Object.defineProperty(input.element, 'files', { value: [], configurable: true })
        await input.trigger('change')
        expect(mocks.uploadFile).not.toHaveBeenCalled()
        expect(mocks.toastSuccess).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('skips the success toast when an upload reports failure', async () => {
        mocks.uploadResult = false
        const { wrapper } = createTestWrapper()
        const input = wrapper.find('#config-files-upload')
        Object.defineProperty(input.element, 'files', {
            value: [new File(['a'], 'a.cfg')],
            configurable: true,
        })
        await input.trigger('change')
        await flushPromises()
        expect(mocks.uploadFile).toHaveBeenCalledTimes(1)
        expect(mocks.toastSuccess).not.toHaveBeenCalled()
        wrapper.unmount()
    })
})

describe('ConfigFilesPanel drag and drop', () => {
    it('flags the upload block while dragging and releases it on drag end', async () => {
        const { wrapper } = createTestWrapper()
        const row = wrapper.find('tr[data-name="printer.cfg"]')
        await row.trigger('drag')
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.blockFileUpload',
            value: true,
        })
        await row.trigger('dragend')
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.blockFileUpload',
            value: false,
        })
        wrapper.unmount()
    })

    it('moves a dragged file into the drop directory', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="printer.cfg"]').trigger('drag')
        const target = wrapper.find('tr[data-name="myfolder"]')
        await target.trigger('dragover')
        await target.trigger('drop')
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'server.files.move',
            { source: 'config/printer.cfg', dest: '/config/myfolder/printer.cfg' },
            { action: 'files/getMove' }
        )
        wrapper.unmount()
    })

    it('moves a dragged file up one level when dropped on the parent row', async () => {
        const { wrapper } = createTestWrapper({ currentPath: '/myfolder' })
        await wrapper.find('tr[data-name="printer.cfg"]').trigger('drag')
        const backRow = wrapper.findAll('tr').find((row) => row.text().includes('..'))
        expect(backRow).toBeDefined()
        await backRow?.trigger('drop')
        expect(mocks.socketEmit).toHaveBeenCalledWith(
            'server.files.move',
            { source: 'config/myfolder/printer.cfg', dest: 'config/printer.cfg' },
            { action: 'files/getMove' }
        )
        wrapper.unmount()
    })
})
