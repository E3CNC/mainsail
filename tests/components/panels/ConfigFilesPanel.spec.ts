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
        isDirectory: false,
        filename: 'photo.png',
        modified: new Date('2024-03-04T05:06:07Z'),
        permissions: 'rw',
        size: 5120,
    },
    {
        isDirectory: false,
        filename: 'vector.svg',
        modified: new Date('2024-03-05T06:07:08Z'),
        permissions: 'rw',
        size: 300,
    },
    {
        isDirectory: false,
        filename: '.hidden.cfg',
        modified: new Date('2024-01-01T00:00:00Z'),
        permissions: 'rw',
        size: 100,
    },
    {
        isDirectory: false,
        filename: 'printer-20240101_120000.cfg',
        modified: new Date('2024-01-01T12:00:00Z'),
        permissions: 'rw',
        size: 2000,
    },
    {
        isDirectory: false,
        filename: 'old.bak',
        modified: new Date('2024-01-01T12:00:00Z'),
        permissions: 'rw',
        size: 200,
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

const fileRows = (wrapper: TestWrapper) => wrapper.findAll('tr[data-name]')

const rowNames = (wrapper: TestWrapper) => fileRows(wrapper).map((row) => row.attributes('data-name') as string)

const findDivByText = (wrapper: TestWrapper, text: string) => {
    const found = wrapper.findAll('.vlistitem-stub').find((item) => item.text().includes(text))
    if (!found) throw new Error(`menu item with text "${text}" not found`)
    return found
}

const findButtonByText = (wrapper: TestWrapper, text: string) => {
    const found = wrapper.findAll('button').find((button) => button.text().trim() === text)
    if (!found) throw new Error(`button with text "${text}" not found`)
    return found
}

describe('ConfigFilesPanel rendering and filtering', () => {
    it('renders the panel with file rows and headers', () => {
        const { wrapper } = createTestWrapper()
        expect(mainPanel(wrapper).exists()).toBe(true)
        const names = rowNames(wrapper)
        expect(names).toContain('printer.cfg')
        expect(names).toContain('moonraker.conf')
        expect(names).toContain('myfolder')
        const text = wrapper.text()
        expect(text).toContain('printer.cfg')
        // 2048 bytes formats to kB via the real formatFilesize helper
        expect(text).toContain('2.0 kB')
        wrapper.unmount()
    })

    it('shows the empty message when the directory has no children', () => {
        const { wrapper } = createTestWrapper({ children: [] })
        expect(fileRows(wrapper)).toHaveLength(0)
        expect(wrapper.text()).toContain('Machine.ConfigFilesPanel.Empty')
        wrapper.unmount()
    })

    it('shows the missing-config warning and hides the table without a config root', () => {
        const { wrapper } = createTestWrapper({ registeredDirectories: ['logs', 'gcodes'] })
        expect(wrapper.text()).toContain('Machine.ConfigFilesPanel.ConfigRootDirectoryDoesntExists')
        expect(fileRows(wrapper)).toHaveLength(0)
        expect(wrapper.text()).not.toContain('Machine.ConfigFilesPanel.Empty')
        wrapper.unmount()
    })

    it('hides dotfiles by default and shows them when enabled', () => {
        const { wrapper } = createTestWrapper()
        expect(rowNames(wrapper)).not.toContain('.hidden.cfg')
        wrapper.unmount()

        const enabled = createTestWrapper({ showHiddenFiles: true })
        expect(rowNames(enabled.wrapper)).toContain('.hidden.cfg')
        enabled.wrapper.unmount()
    })

    it('toggles the hidden-files setting through the settings checkbox', async () => {
        const { wrapper } = createTestWrapper()
        expect(rowNames(wrapper)).not.toContain('.hidden.cfg')
        const checkboxes = wrapper.findAll('input.vcheckbox-stub')
        await checkboxes[0].setValue(true)
        await flushPromises()
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.configfiles.showHiddenFiles',
            value: true,
        })
        expect(rowNames(wrapper)).toContain('.hidden.cfg')
        wrapper.unmount()
    })

    it('hides backup files when the backup filter is enabled', () => {
        const { wrapper } = createTestWrapper({ hideBackupFiles: true })
        const names = rowNames(wrapper)
        expect(names).not.toContain('printer-20240101_120000.cfg')
        expect(names).not.toContain('old.bak')
        expect(names).toContain('printer.cfg')
        expect(names).toContain('myfolder')
        expect(fileRows(wrapper)).toHaveLength(5)
        wrapper.unmount()
    })

    it('shows free disk space from the directory disk usage', () => {
        const { wrapper } = createTestWrapper()
        // 524288000 bytes = 500.0 MB through the real formatFilesize helper
        expect(wrapper.text()).toContain('500.0 MB')
        wrapper.unmount()
    })

    it('falls back to a config root item when config is not registered', () => {
        const { wrapper } = createTestWrapper({ registeredDirectories: ['logs'] })
        const selects = wrapper.findAll('select.vselect-stub')
        expect(selects.length).toBeGreaterThan(0)
        const items = selects[0].element as unknown as HTMLSelectElement
        const values = Array.from(items.options).map((option) => option.value)
        expect(values).toContain('config')
        wrapper.unmount()
    })

    it('hides write-only toolbar buttons for read-only directories', () => {
        const { wrapper } = createTestWrapper({ permissions: 'r' })
        // only refresh + the settings cog remain
        expect(mainPanel(wrapper).findAll('button.machine-configfiles-panel__tool-btn')).toHaveLength(2)
        wrapper.unmount()
    })

    it('shows all toolbar buttons for writable directories without selection', () => {
        const { wrapper } = createTestWrapper({ permissions: 'rw' })
        // upload, create file, create directory, refresh + settings cog
        expect(mainPanel(wrapper).findAll('button.machine-configfiles-panel__tool-btn')).toHaveLength(5)
        wrapper.unmount()
    })

    it('renders the page range in the footer', () => {
        const { wrapper } = createTestWrapper()
        // 7 visible files with 10 per page
        expect(wrapper.text()).toContain('1-7 of 7')
        wrapper.unmount()
    })

    it('renders the total item count when all files are shown on one page', () => {
        const { wrapper } = createTestWrapper({ countPerPage: -1 })
        expect(wrapper.text()).toContain('7 items')
        wrapper.unmount()
    })
})

describe('ConfigFilesPanel navigation and sorting', () => {
    it('navigates into a directory on row click and clears the selection', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="myfolder"]').trigger('click')
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.configfiles.selectedFiles',
            value: [],
        })
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.configfiles.currentPath',
            value: '/myfolder',
        })
        wrapper.unmount()
    })

    it('navigates back to the parent directory through the .. row', async () => {
        const { wrapper } = createTestWrapper({ currentPath: '/myfolder' })
        const backRow = wrapper.findAll('tr').find((row) => row.text().includes('..'))
        expect(backRow).toBeDefined()
        await backRow?.trigger('click')
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.configfiles.currentPath',
            value: '',
        })
        wrapper.unmount()
    })

    it('navigates through the path navigation segment control', async () => {
        const { wrapper } = createTestWrapper({ currentPath: '/myfolder' })
        await wrapper.find('[data-testid="pathnav-root"]').trigger('click')
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.configfiles.currentPath',
            value: '',
        })
        wrapper.unmount()
    })

    it('toggles sort direction when clicking the active header', async () => {
        const { wrapper } = createTestWrapper()
        const nameHeader = wrapper.findAll('span.cursor-pointer').find((span) => span.text().includes('Name'))
        expect(nameHeader).toBeDefined()
        await nameHeader?.trigger('click')
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.configfiles.sortDesc',
            value: true,
        })
        wrapper.unmount()
    })

    it('switches the sort key when clicking another header', async () => {
        const { wrapper } = createTestWrapper()
        const sizeHeader = wrapper.findAll('span.cursor-pointer').find((span) => span.text().includes('Filesize'))
        expect(sizeHeader).toBeDefined()
        await sizeHeader?.trigger('click')
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.configfiles.sortBy',
            value: 'size',
        })
        expect(mocks.saveSetting).toHaveBeenCalledWith({
            name: 'view.configfiles.sortDesc',
            value: false,
        })
        wrapper.unmount()
    })
})

describe('ConfigFilesPanel file open flows', () => {
    it('dispatches editor/openFile when clicking a config file', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="printer.cfg"]').trigger('click')
        expect(mocks.openFile).toHaveBeenCalledWith({
            root: 'config',
            path: '',
            filename: 'printer.cfg',
            size: 2048,
            permissions: 'rw',
        })
        wrapper.unmount()
    })

    it('opens the image viewer without the editor for png files', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="photo.png"]').trigger('click')
        expect(mocks.openFile).not.toHaveBeenCalled()
        const image = wrapper.find('img')
        expect(image.exists()).toBe(true)
        expect(image.attributes('src')).toContain('photo.png')
        wrapper.unmount()
    })

    it('closes the image viewer through its close button', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="photo.png"]').trigger('click')
        expect(wrapper.find('img').exists()).toBe(true)
        const viewer = wrapper.find('[data-title="photo.png"]')
        expect(viewer.exists()).toBe(true)
        await viewer.find('button').trigger('click')
        expect(wrapper.find('img').exists()).toBe(false)
        wrapper.unmount()
    })

    it('fetches and renders svg files in the image viewer', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="vector.svg"]').trigger('click')
        await flushPromises()
        expect(mocks.openFile).not.toHaveBeenCalled()
        expect(globalThis.fetch).toHaveBeenCalled()
        const fetchUrl = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as string
        expect(fetchUrl).toContain('vector.svg')
        expect(wrapper.html()).toContain('<svg></svg>')
        wrapper.unmount()
    })

    it('ignores plain row clicks while the context menu is open', async () => {
        const { wrapper } = createTestWrapper()
        const row = wrapper.find('tr[data-name="printer.cfg"]')
        await row.trigger('contextmenu')
        await row.trigger('click')
        expect(mocks.openFile).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('opens the file from the context menu edit entry', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="printer.cfg"]').trigger('contextmenu')
        await findDivByText(wrapper, 'Machine.ConfigFilesPanel.EditFile').trigger('click')
        expect(mocks.openFile).toHaveBeenCalledWith({
            root: 'config',
            path: '',
            filename: 'printer.cfg',
            size: 2048,
            permissions: 'rw',
        })
        wrapper.unmount()
    })

    it('downloads the file from the context menu', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="printer.cfg"]').trigger('contextmenu')
        await findDivByText(wrapper, 'Machine.ConfigFilesPanel.Download').trigger('click')
        expect(mocks.openMock).toHaveBeenCalled()
        const href = mocks.openMock.mock.calls[0][0] as string
        expect(href).toContain('printer.cfg')
        wrapper.unmount()
    })

    it('exposes the duplicate entry reaching the duplicate dialog flow', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('tr[data-name="printer.cfg"]').trigger('contextmenu')
        await findDivByText(wrapper, 'Machine.ConfigFilesPanel.Duplicate').trigger('click')
        const inputs = wrapper.findAll('input.vtextfield-stub')
        expect(inputs.length).toBeGreaterThan(2)
        wrapper.unmount()
    })

    it('finds dialog action buttons by scoped panel titles', () => {
        const { wrapper } = createTestWrapper()
        expect(findButtonByText(wrapper, 'Machine.ConfigFilesPanel.Create').exists()).toBe(true)
        wrapper.unmount()
    })
})
