import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore, type Store } from 'vuex'
import { createVuetify } from 'vuetify'
import TimelapseFilesPanel from '@/components/panels/Timelapse/TimelapseFilesPanel.vue'

const mocks = vi.hoisted(() => {
    return { emit: vi.fn() }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

// The 820-line SFC compile + full VDataTable mount exceeds the default 5 s
// timeout on first render; later mounts reuse the transform cache.
vi.setConfig({ testTimeout: 60_000 })

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
    vi.spyOn(window, 'open').mockImplementation(() => null)
})

interface TimelapseItem {
    isDirectory: boolean
    filename: string
    modified: Date
    permissions: string
    size?: number
    childrens?: TimelapseItem[]
}

interface TimelapseVm {
    search: string
    selectedFiles: TimelapseItem[]
    displayFiles: TimelapseItem[]
    currentPathForNavigation: string
    deleteSelectedDialogText: string
    v3SortBy: { key: string; order: string }[]
    dialogCreateDirectory: { show: boolean; name: string }
    dialogRenameFile: { show: boolean; newName: string; item: TimelapseItem }
    dialogRenameDirectory: { show: boolean; newName: string; item: TimelapseItem }
    dialogDeleteDirectory: { show: boolean; item: TimelapseItem }
    contextMenu: { shown: boolean; x: number; y: number; item: TimelapseItem }
    deleteDialog: boolean
    deleteSelectedDialog: boolean
    boolVideoDialog: boolean
    videoDialogFilename: string
    advancedSearch: (value: string | number, searchText: string) => boolean
    getThumbnail: (item: TimelapseItem) => string
    clickRow: (item: TimelapseItem, force?: boolean) => void
    clickRowGoBack: () => void
    clickPathNavGoToDirectory: (segment: { location: string }) => void
    showContextMenu: (e: unknown, item: TimelapseItem) => void
    downloadFile: (filename: string) => void
    downloadSelectedFiles: () => Promise<void>
    createDirectory: () => void
    createDirectoryAction: () => void
    refreshFileList: () => void
    renameFile: (item: TimelapseItem) => void
    renameFileAction: () => void
    renameDirectory: (item: TimelapseItem) => void
    renameDirectoryAction: () => void
    removeFile: () => void
    deleteDirectory: (item: TimelapseItem) => void
    deleteDirectoryAction: () => void
    deleteSelectedFiles: () => void
    setSortBy: (val: { key: string; order?: 'asc' | 'desc' }[]) => void
    setCountPerPage: (val: number) => void
    setCurrentPath?: (val: string) => void
}

const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as unknown as TimelapseVm

const file = (filename: string, extra: Partial<TimelapseItem> = {}): TimelapseItem => ({
    isDirectory: false,
    filename,
    modified: new Date('2024-01-02T03:04:05Z'),
    permissions: 'rw',
    size: 1000,
    ...extra,
})

const baseChildren = (): TimelapseItem[] => [
    { isDirectory: true, filename: 'clips', modified: new Date('2024-01-01T00:00:00Z'), permissions: 'rw' },
    file('vid1.mp4'),
    file('vid1.jpg', { size: 50 }),
    file('vid2.mp4', { size: 2000 }),
    file('archive.zip', { size: 500 }),
    file('notes.txt', { size: 10 }),
]

const createTestWrapper = (
    options: {
        children?: TimelapseItem[]
        currentPath?: string
        selectedFiles?: TimelapseItem[]
        sortBy?: string
        sortDesc?: boolean
        countPerPage?: number
        permissions?: string
    } = {}
) => {
    const {
        children = baseChildren(),
        currentPath = 'timelapse',
        selectedFiles = [],
        sortBy = 'modified',
        sortDesc = true,
        countPerPage = 10,
        permissions = 'rw',
    } = options
    const vuetify = createVuetify()
    const dispatched: { name: string; value: unknown }[] = []
    const directory = {
        permissions,
        disk_usage: { used: 100, free: 900, total: 1000 },
        childrens: children,
    }
    const store = createStore({
        state: {
            socket: { isConnected: true, hostname: '127.0.0.1', port: 7125, loadings: [] },
            server: { klippy_connected: true, klippy_state: 'ready' },
            printer: { print_stats: { state: 'standby' } },
            gui: {
                general: { timeFormat: '24hours', dateFormat: 'iso' },
                view: {
                    timelapse: { sortBy, sortDesc, countPerPage, currentPath, selectedFiles: [...selectedFiles] },
                },
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'files/getDirectory': () => (path: string) => {
                if (path === 'timelapse') return directory
                if (path === 'timelapse/clips')
                    return { permissions: 'rw', disk_usage: { used: 10, free: 90, total: 100 }, childrens: [] }
                return null
            },
        },
        actions: {
            'gui/saveSetting': (
                ctx: { state: { gui: { view: { timelapse: Record<string, unknown> } } } },
                payload: { name: string; value: unknown }
            ) => {
                dispatched.push({ name: payload.name, value: payload.value })
                const key = payload.name.replace('view.timelapse.', '')
                ctx.state.gui.view.timelapse[key] = payload.value
            },
        },
    })

    const wrapper = mount(TimelapseFilesPanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                Panel: {
                    props: ['title'],
                    template: '<div data-testid="panel"><span>{{ title }}</span><slot name="buttons" /><slot /></div>',
                },
                PathNavigation: {
                    props: ['path', 'baseDirectoryLabel'],
                    template: '<div data-testid="path-nav">{{ path }}</div>',
                },
                ConfirmationDialog: {
                    props: ['modelValue', 'title', 'text'],
                    template:
                        '<div data-testid="confirm"><span>{{ text }}</span>' +
                        '<button data-testid="confirm-action" @click="$emit(\'action\')">ok</button></div>',
                },
                VDialog: { template: '<div><slot /></div>' },
                VMenu: { template: '<div><slot /><slot name="activator" :props="{}" /></div>' },
                VTooltip: { template: '<div><slot name="activator" :props="{}" /><slot /></div>' },
                VueLoadImage: { template: '<div><slot name="image" /></div>' },
            },
            directives: { longpress: {} as never },
        },
    })
    return {
        wrapper,
        store: store as Store<unknown> & { state: { gui: { view: { timelapse: Record<string, unknown> } } } },
        dispatched,
    }
}

describe('TimelapseFilesPanel', () => {
    it('renders the panel with path navigation and disk usage', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="path-nav"]').exists()).toBe(true)
        expect(wrapper.text()).toContain('Timelapse.CurrentPath')
        expect(wrapper.text()).toContain('Timelapse.FreeDisk')
        wrapper.unmount()
    })

    it('lists directories, mp4 and zip files but hides other files', () => {
        const { wrapper } = createTestWrapper()
        const names = getVm(wrapper).displayFiles.map((f) => f.filename)
        expect(names).toContain('clips')
        expect(names).toContain('vid1.mp4')
        expect(names).toContain('vid2.mp4')
        expect(names).toContain('archive.zip')
        expect(names).not.toContain('vid1.jpg')
        expect(names).not.toContain('notes.txt')
        expect(wrapper.text()).toContain('vid1.mp4')
        expect(wrapper.text()).not.toContain('notes.txt')
        wrapper.unmount()
    })

    it('renders the empty state without files', () => {
        const { wrapper } = createTestWrapper({ children: [] })
        expect(wrapper.text()).toContain('Timelapse.Empty')
        wrapper.unmount()
    })

    it('maps the root path to empty navigation', () => {
        const { wrapper } = createTestWrapper({ currentPath: 'timelapse' })
        expect(getVm(wrapper).currentPathForNavigation).toBe('')
        wrapper.unmount()
    })

    it('maps a nested path to its suffix', () => {
        const { wrapper } = createTestWrapper({ currentPath: 'timelapse/clips' })
        expect(getVm(wrapper).currentPathForNavigation).toBe('/clips')
        wrapper.unmount()
    })

    it('resolves thumbnails for videos with a jpg sidecar', () => {
        const { wrapper } = createTestWrapper()
        const vm = getVm(wrapper)
        expect(vm.getThumbnail(file('vid1.mp4'))).toContain('vid1.jpg')
        expect(vm.getThumbnail(file('vid2.mp4'))).toBe('')
        expect(vm.getThumbnail(file('archive.zip'))).toBe('')
        wrapper.unmount()
    })

    it('matches the advanced search case-insensitively', () => {
        const { wrapper } = createTestWrapper()
        const vm = getVm(wrapper)
        expect(vm.advancedSearch('Vid1.MP4', 'vid1')).toBe(true)
        expect(vm.advancedSearch('vid1.mp4', 'zzz')).toBe(false)
        expect(vm.advancedSearch(42 as never, 'vid')).toBe(false)
        wrapper.unmount()
    })

    it('navigates into a directory on row click and clears the selection', () => {
        const { wrapper, store } = createTestWrapper({
            selectedFiles: [file('vid1.mp4')],
        })
        getVm(wrapper).clickRow({ isDirectory: true, filename: 'clips', modified: new Date(), permissions: 'rw' })
        expect(store.state.gui.view.timelapse.currentPath).toBe('timelapse/clips')
        expect(store.state.gui.view.timelapse.selectedFiles).toEqual([])
        wrapper.unmount()
    })

    it('downloads a zip on row click', () => {
        const { wrapper } = createTestWrapper()
        getVm(wrapper).clickRow(file('archive.zip'))
        expect(window.open).toHaveBeenCalledWith(expect.stringContaining('archive.zip') as never)
        wrapper.unmount()
    })

    it('opens the video dialog for mp4 files', () => {
        const { wrapper } = createTestWrapper()
        getVm(wrapper).clickRow(file('vid1.mp4'))
        expect(getVm(wrapper).boolVideoDialog).toBe(true)
        expect(getVm(wrapper).videoDialogFilename).toContain('vid1.mp4')
        wrapper.unmount()
    })

    it('ignores row clicks while the context menu is open unless forced', () => {
        const { wrapper } = createTestWrapper()
        const vm = getVm(wrapper)
        vm.showContextMenu({ preventDefault: () => {}, clientX: 1, clientY: 2 } as never, file('vid1.mp4'))
        expect(vm.contextMenu.shown).toBe(true)
        vm.clickRow(file('vid2.mp4'))
        expect(vm.boolVideoDialog).toBe(false)
        vm.clickRow(file('vid2.mp4'), true)
        expect(vm.contextMenu.shown).toBe(false)
        expect(vm.boolVideoDialog).toBe(true)
        wrapper.unmount()
    })

    it('goes back one directory', () => {
        const { wrapper, store } = createTestWrapper({ currentPath: 'timelapse/clips' })
        getVm(wrapper).clickRowGoBack()
        expect(store.state.gui.view.timelapse.currentPath).toBe('timelapse')
        wrapper.unmount()
    })

    it('jumps through the path navigation', () => {
        const { wrapper, store } = createTestWrapper({ currentPath: 'timelapse/clips' })
        getVm(wrapper).clickPathNavGoToDirectory({ location: '' })
        expect(store.state.gui.view.timelapse.currentPath).toBe('timelapse')
        wrapper.unmount()
    })

    it('refreshes the file list through the socket', () => {
        const { wrapper } = createTestWrapper()
        getVm(wrapper).refreshFileList()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'timelapse' },
            { action: 'files/getDirectory' }
        )
        wrapper.unmount()
    })

    it('creates a directory through the socket', () => {
        const { wrapper } = createTestWrapper()
        const vm = getVm(wrapper)
        vm.createDirectory()
        expect(vm.dialogCreateDirectory.show).toBe(true)
        vm.dialogCreateDirectory.name = 'fresh'
        vm.createDirectoryAction()
        expect(vm.dialogCreateDirectory.show).toBe(false)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.post_directory',
            { path: 'timelapse/fresh' },
            { action: 'files/getCreateDir' }
        )
        wrapper.unmount()
    })

    it('persists sort and page-size settings', () => {
        const { wrapper, dispatched } = createTestWrapper()
        const vm = getVm(wrapper)
        expect(vm.v3SortBy).toEqual([{ key: 'modified', order: 'desc' }])
        vm.setSortBy([{ key: 'filename', order: 'asc' }])
        expect(dispatched).toContainEqual({ name: 'view.timelapse.sortBy', value: 'filename' })
        expect(dispatched).toContainEqual({ name: 'view.timelapse.sortDesc', value: false })
        vm.setSortBy([])
        vm.setCountPerPage(25)
        expect(dispatched).toContainEqual({ name: 'view.timelapse.countPerPage', value: 25 })
        wrapper.unmount()
    })

    it('describes single and multi delete selections', () => {
        const single = createTestWrapper({ selectedFiles: [file('vid1.mp4')] })
        expect(getVm(single.wrapper).deleteSelectedDialogText).toContain('vid1.mp4')
        single.wrapper.unmount()

        const multi = createTestWrapper({ selectedFiles: [file('a.mp4'), file('b.mp4')] })
        expect(getVm(multi.wrapper).deleteSelectedDialogText).toContain('2')
        multi.wrapper.unmount()
    })

    it('renames a file and its jpg sidecar for mp4', () => {
        const { wrapper } = createTestWrapper()
        const vm = getVm(wrapper)
        vm.renameFile(file('vid1.mp4'))
        expect(vm.dialogRenameFile.newName).toBe('vid1')
        vm.dialogRenameFile.newName = 'renamed'
        vm.renameFileAction()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.move',
            { source: 'timelapse/vid1.mp4', dest: 'timelapse/renamed.mp4' },
            { action: 'files/getMove' }
        )
        expect(mocks.emit).toHaveBeenCalledWith('server.files.move', {
            source: 'timelapse/vid1.jpg',
            dest: 'timelapse/renamed.jpg',
        })
        wrapper.unmount()
    })

    it('renames a zip without a sidecar move', () => {
        const { wrapper } = createTestWrapper()
        const vm = getVm(wrapper)
        vm.dialogRenameFile.item = file('archive.zip')
        vm.dialogRenameFile.newName = 'renamed'
        vm.renameFileAction()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.move',
            { source: 'timelapse/archive.zip', dest: 'timelapse/renamed.zip' },
            { action: 'files/getMove' }
        )
        expect(mocks.emit).toHaveBeenCalledTimes(1)
        wrapper.unmount()
    })

    it('renames a directory through the socket', () => {
        const { wrapper } = createTestWrapper()
        const vm = getVm(wrapper)
        const dir = { isDirectory: true, filename: 'clips', modified: new Date(), permissions: 'rw' }
        vm.renameDirectory(dir)
        expect(vm.dialogRenameDirectory.newName).toBe('clips')
        vm.dialogRenameDirectory.newName = 'fresh'
        vm.renameDirectoryAction()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.move',
            { source: 'timelapse/clips', dest: 'timelapse/fresh' },
            { action: 'files/getMove' }
        )
        wrapper.unmount()
    })

    it('removes a single mp4 with its preview', () => {
        const { wrapper } = createTestWrapper()
        const vm = getVm(wrapper)
        vm.showContextMenu({ preventDefault: () => {}, clientX: 1, clientY: 1 } as never, file('vid1.mp4'))
        vm.removeFile()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.delete_file',
            { path: 'timelapse/vid1.mp4' },
            { action: 'files/getDeleteFile' }
        )
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.delete_file',
            { path: 'timelapse/vid1.jpg' },
            { action: 'files/getDeleteFile' }
        )
        wrapper.unmount()
    })

    it('removes a zip with a single delete', () => {
        const { wrapper } = createTestWrapper()
        const vm = getVm(wrapper)
        vm.showContextMenu({ preventDefault: () => {}, clientX: 1, clientY: 1 } as never, file('archive.zip'))
        vm.removeFile()
        expect(mocks.emit).toHaveBeenCalledTimes(1)
        wrapper.unmount()
    })

    it('deletes a directory through the confirmation flow', () => {
        const { wrapper } = createTestWrapper()
        const vm = getVm(wrapper)
        const dir = { isDirectory: true, filename: 'clips', modified: new Date(), permissions: 'rw' }
        vm.showContextMenu({ preventDefault: () => {}, clientX: 1, clientY: 1 } as never, dir)
        vm.deleteDirectory(dir)
        expect(vm.dialogDeleteDirectory.show).toBe(true)
        vm.deleteDirectoryAction()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.delete_directory',
            { path: 'timelapse/clips', force: true },
            { action: 'files/getDeleteDir' }
        )
        wrapper.unmount()
    })

    it('deletes mixed selections and clears them', () => {
        const { wrapper, store } = createTestWrapper({
            selectedFiles: [
                { isDirectory: true, filename: 'clips', modified: new Date(), permissions: 'rw' },
                file('vid1.mp4'),
                file('archive.zip'),
            ],
        })
        getVm(wrapper).deleteSelectedFiles()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.delete_directory',
            { path: 'timelapse/clips', force: true },
            { action: 'files/getDeleteDir' }
        )
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.delete_file',
            { path: 'timelapse/vid1.mp4' },
            { action: 'files/getDeleteFile' }
        )
        expect(store.state.gui.view.timelapse.selectedFiles).toEqual([])
        wrapper.unmount()
    })

    it('zips the selection with mp4 sidecars then clears it', async () => {
        const { wrapper, store } = createTestWrapper({
            selectedFiles: [file('vid1.mp4'), file('vid2.mp4')],
        })
        await getVm(wrapper).downloadSelectedFiles()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.zip',
            expect.objectContaining({
                items: expect.arrayContaining([
                    'timelapse/vid1.mp4',
                    'timelapse/vid1.jpg',
                    'timelapse/vid2.mp4',
                ]) as never,
            }) as never,
            expect.objectContaining({ action: 'files/downloadZip' }) as never
        )
        const dest = (mocks.emit.mock.calls[0][1] as { dest: string }).dest
        expect(dest.startsWith('timelapse/timelapse-')).toBe(true)
        expect(store.state.gui.view.timelapse.selectedFiles).toEqual([])
        wrapper.unmount()
    })

    it('downloads one file through the file URL', () => {
        const { wrapper } = createTestWrapper()
        getVm(wrapper).downloadFile('vid1.mp4')
        expect(window.open).toHaveBeenCalledWith(expect.stringContaining('vid1.mp4') as never)
        wrapper.unmount()
    })
})
