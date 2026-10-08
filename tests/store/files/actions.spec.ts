import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
    emitBatch: vi.fn(),
    emitAndWait: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    axiosPost: vi.fn(),
    cancelSource: { token: 'cancel-token', cancel: vi.fn() },
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitBatch: mocks.emitBatch, emitAndWait: mocks.emitAndWait }),
    $toast: {
        error: (...args: unknown[]) => mocks.toastError(...args),
        success: (...args: unknown[]) => mocks.toastSuccess(...args),
    },
}))

vi.mock('@/plugins/i18n', () => ({
    default: { global: { t: (key: string) => key } },
}))

vi.mock('axios', () => {
    const mocked = {
        CancelToken: { source: () => mocks.cancelSource },
        post: (...args: unknown[]) => mocks.axiosPost(...args),
    }
    return { default: mocked, ...mocked }
})

import { actions } from '@/store/files/actions'

function ctx(overrides: Record<string, unknown> = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: {},
        rootState: {},
        rootGetters: {},
        getters: {},
        ...overrides,
    }
}

describe('files/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitBatch.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
        mocks.toastSuccess.mockReset()
        mocks.axiosPost.mockReset()
        vi.spyOn(window.console, 'error').mockImplementation(() => {})
        vi.spyOn(window, 'open').mockImplementation(() => null)
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('initRootDirs creates unknown roots and skips known ones', () => {
        const c = ctx({ state: { filetree: [{ filename: 'gcodes' }] } })
        actions.initRootDirs(c as never, ['gcodes', 'config'] as never)
        expect(c.commit).toHaveBeenCalledTimes(1)
        expect(c.commit).toHaveBeenCalledWith('createRootDir', { name: 'config', permissions: 'r' })
        expect(mocks.emit).toHaveBeenCalledTimes(1)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'config' },
            { action: 'files/getDirectory' }
        )
    })

    it('getDirectory deletes stale entries missing from the payload', () => {
        const directory = {
            childrens: [
                { isDirectory: true, filename: 'old' },
                { isDirectory: false, filename: 'gone.gcode' },
                { isDirectory: true, filename: 'kept' },
                { isDirectory: false, filename: 'kept.gcode' },
            ],
        }
        const c = ctx({ getters: { getDirectory: () => directory } })
        actions.getDirectory(
            c as never,
            {
                requestParams: { path: 'gcodes/sub' },
                dirs: [{ dirname: 'kept', permissions: 'r', modified: 1, size: 0 }],
                files: [{ filename: 'kept.gcode', permissions: 'r', modified: 1, size: 1 }],
            } as never
        )
        expect(c.commit).toHaveBeenCalledWith(
            'setDeleteDir',
            expect.objectContaining({ item: { path: 'sub/old', root: 'gcodes' } })
        )
        expect(c.commit).toHaveBeenCalledWith(
            'setDeleteFile',
            expect.objectContaining({ item: { path: 'sub/gone.gcode', root: 'gcodes' } })
        )
        expect(c.commit).not.toHaveBeenCalledWith(
            'setDeleteDir',
            expect.objectContaining({ item: expect.objectContaining({ path: 'sub/kept' }) })
        )
    })

    it('getDirectory creates new dirs, skips hidden and existing ones', () => {
        const directory = { childrens: [{ isDirectory: true, filename: 'existing' }] }
        const c = ctx({ getters: { getDirectory: () => directory } })
        actions.getDirectory(
            c as never,
            {
                requestParams: { path: 'gcodes' },
                dirs: [
                    { dirname: 'brand-new', permissions: 'rw', modified: 1700, size: 0 },
                    { dirname: '.git', permissions: 'r', modified: 1700, size: 0 },
                    { dirname: 'existing', permissions: 'r', modified: 1700, size: 0 },
                ],
                files: [],
            } as never
        )
        expect(c.commit).toHaveBeenCalledWith(
            'setCreateDir',
            expect.objectContaining({
                item: expect.objectContaining({ path: 'brand-new', root: 'gcodes', modified: 1700 * 1000 }),
            })
        )
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'gcodes/brand-new' },
            { action: 'files/getDirectory' }
        )
        const created = c.commit.mock.calls.filter(([name]) => name === 'setCreateDir')
        expect(created).toHaveLength(1)
    })

    it('getDirectory modifies changed files and creates new ones', () => {
        const sameDate = new Date(1700 * 1000)
        const directory = {
            childrens: [
                { isDirectory: false, filename: 'same.gcode', size: 10, modified: sameDate },
                { isDirectory: false, filename: 'changed.gcode', size: 10, modified: sameDate },
            ],
        }
        const c = ctx({ getters: { getDirectory: () => directory } })
        actions.getDirectory(
            c as never,
            {
                requestParams: { path: 'gcodes' },
                dirs: [],
                files: [
                    { filename: 'same.gcode', permissions: 'r', modified: 1700, size: 10 },
                    { filename: 'changed.gcode', permissions: 'r', modified: 1700, size: 99 },
                    { filename: 'fresh.gcode', permissions: 'r', modified: 1700, size: 5 },
                ],
            } as never
        )
        expect(c.commit).toHaveBeenCalledWith(
            'setModifyFile',
            expect.objectContaining({ item: expect.objectContaining({ path: 'changed.gcode' }) })
        )
        expect(c.commit).toHaveBeenCalledWith(
            'setCreateFile',
            expect.objectContaining({ item: expect.objectContaining({ path: 'fresh.gcode' }) })
        )
        expect(c.commit).not.toHaveBeenCalledWith(
            'setModifyFile',
            expect.objectContaining({ item: expect.objectContaining({ path: 'same.gcode' }) })
        )
    })

    it('getDirectory updates root permissions and disk usage', () => {
        const c = ctx({
            state: { filetree: [{ filename: 'gcodes', permissions: 'r' }] },
            getters: { getDirectory: () => ({ childrens: [] }) },
        })
        actions.getDirectory(
            c as never,
            {
                requestParams: { path: 'gcodes' },
                dirs: [],
                files: [],
                root_info: { name: 'gcodes', permissions: 'rw' },
                disk_usage: { free: 1, total: 2, used: 1 },
            } as never
        )
        expect(c.commit).toHaveBeenCalledWith('setRootPermissions', { name: 'gcodes', permissions: 'rw' })
        expect(c.commit).toHaveBeenCalledWith('setDiskUsage', {
            disk_usage: { free: 1, total: 2, used: 1 },
            path: 'gcodes',
        })
    })

    it('getDirectory skips permission and disk commits when nothing changed', () => {
        const c = ctx({
            state: { filetree: [{ filename: 'gcodes', permissions: 'r' }] },
            getters: { getDirectory: () => ({ childrens: [] }) },
        })
        actions.getDirectory(
            c as never,
            {
                requestParams: { path: 'gcodes' },
                dirs: [],
                files: [],
                root_info: { name: 'gcodes', permissions: 'r' },
            } as never
        )
        expect(c.commit).not.toHaveBeenCalledWith('setRootPermissions', expect.anything())
        expect(c.commit).not.toHaveBeenCalledWith('setDiskUsage', expect.anything())
    })

    it('getDirectory tolerates a missing directory and missing requestParams', () => {
        const c = ctx({ getters: { getDirectory: () => null } })
        actions.getDirectory(
            c as never,
            {
                dirs: [],
                files: [{ filename: 'lonely.gcode', permissions: 'r', modified: 1, size: 1 }],
            } as never
        )
        expect(c.commit).toHaveBeenCalledWith(
            'setCreateFile',
            expect.objectContaining({ item: expect.objectContaining({ path: 'lonely.gcode' }) })
        )
    })

    it('scanMetadata requests scans only for gcodes', () => {
        const c = ctx()
        actions.scanMetadata(c as never, { filename: 'gcodes/sub/test.gcode' })
        expect(c.commit).toHaveBeenCalledWith('setMetadataRequested', { filename: 'sub/test.gcode' })
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.metascan',
            { filename: 'sub/test.gcode' },
            { action: 'files/getScanMetadata' }
        )
        const other = ctx()
        actions.scanMetadata(other as never, { filename: 'config/printer.cfg' })
        expect(other.commit).not.toHaveBeenCalled()
        expect(mocks.emit).toHaveBeenCalledTimes(1)
    })

    it('getScanMetadata dispatches and toasts on valid payloads', () => {
        const c = ctx()
        actions.getScanMetadata(c as never, { filename: 'test.gcode' })
        expect(c.dispatch).toHaveBeenCalledWith('getMetadata', { filename: 'test.gcode' })
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Files.ScanMetaSuccess')
        const empty = ctx()
        actions.getScanMetadata(empty as never, { filename: '' })
        expect(empty.dispatch).not.toHaveBeenCalled()
        actions.getScanMetadata(empty as never, undefined as never)
        expect(empty.dispatch).not.toHaveBeenCalled()
    })

    it('requestMetadata batches gcodes files and skips other roots', () => {
        const c = ctx()
        actions.requestMetadata(c as never, [{ filename: 'gcodes/a.gcode' }, { filename: 'config/b.cfg' }] as never)
        expect(c.commit).toHaveBeenCalledTimes(1)
        expect(c.commit).toHaveBeenCalledWith('setMetadataRequested', { filename: 'a.gcode' })
        expect(mocks.emitBatch).toHaveBeenCalledTimes(1)
        const batch = mocks.emitBatch.mock.calls[0][0] as { method: string }[]
        expect(batch).toHaveLength(1)
        expect(batch[0].method).toBe('server.files.metadata')
    })

    it('requestMetadata flushes every 100 messages', () => {
        const c = ctx()
        const payload = Array.from({ length: 101 }, (_, i) => ({ filename: `gcodes/f${i}.gcode` }))
        actions.requestMetadata(c as never, payload as never)
        expect(mocks.emitBatch).toHaveBeenCalledTimes(2)
        expect(mocks.emitBatch.mock.calls[0][0]).toHaveLength(100)
        expect(mocks.emitBatch.mock.calls[1][0]).toHaveLength(1)
    })

    it('getMetadata ignores empty payloads', () => {
        const c = ctx()
        actions.getMetadata(c as never, null as never)
        actions.getMetadata(c as never, undefined as never)
        actions.getMetadata(c as never, { filename: '' } as never)
        expect(c.commit).not.toHaveBeenCalled()
    })

    it('getMetadata refreshes the printer current file when it matches', () => {
        const payload = { filename: 'test.gcode', slicer: 'Prusa' }
        const c = ctx({ rootState: { printer: { print_stats: { filename: 'test.gcode' } } } })
        actions.getMetadata(c as never, payload as never)
        expect(c.commit).toHaveBeenCalledWith('printer/clearCurrentFile', null, { root: true })
        expect(c.commit).toHaveBeenCalledWith('printer/setData', { current_file: payload }, { root: true })
        expect(c.commit).toHaveBeenCalledWith('setMetadata', payload)
    })

    it('getMetadata skips printer commits for other files', () => {
        const c = ctx({ rootState: { printer: { print_stats: { filename: 'other.gcode' } } } })
        actions.getMetadata(c as never, { filename: 'test.gcode' } as never)
        expect(c.commit).not.toHaveBeenCalledWith('printer/clearCurrentFile', expect.anything(), expect.anything())
        expect(c.commit).toHaveBeenCalledWith('setMetadata', { filename: 'test.gcode' })
    })

    it('getMetadataCurrentFile forwards to the printer module', () => {
        const c = ctx()
        actions.getMetadataCurrentFile(c as never, { filename: 'x' } as never)
        expect(c.commit).toHaveBeenCalledWith('printer/clearCurrentFile', null, { root: true })
        expect(c.commit).toHaveBeenCalledWith('printer/setData', { current_file: { filename: 'x' } }, { root: true })
    })

    it('filelist_changed handles simple create/delete/modify actions', async () => {
        const c = ctx()
        await actions.filelist_changed(c as never, { action: 'create_file', item: {} } as never)
        expect(c.commit).toHaveBeenCalledWith('setCreateFile', expect.objectContaining({ action: 'create_file' }))
        await actions.filelist_changed(c as never, { action: 'delete_file', item: {} } as never)
        expect(c.commit).toHaveBeenCalledWith('setDeleteFile', expect.objectContaining({ action: 'delete_file' }))
        await actions.filelist_changed(c as never, { action: 'modify_file', item: {} } as never)
        expect(c.commit).toHaveBeenCalledWith('setModifyFile', expect.objectContaining({ action: 'modify_file' }))
        await actions.filelist_changed(c as never, { action: 'move_dir', item: {} } as never)
        expect(c.commit).toHaveBeenCalledWith('setMoveDir', expect.objectContaining({ action: 'move_dir' }))
        await actions.filelist_changed(c as never, { action: 'delete_dir', item: {} } as never)
        expect(c.commit).toHaveBeenCalledWith('setDeleteDir', expect.objectContaining({ action: 'delete_dir' }))
    })

    it('filelist_changed recreates printer_autosave.cfg instead of renaming', async () => {
        const c = ctx()
        await actions.filelist_changed(
            c as never,
            {
                action: 'move_file',
                source_item: { path: 'printer_autosave.cfg', root: 'config' },
                item: { path: 'printer.cfg', root: 'config' },
            } as never
        )
        expect(c.commit).toHaveBeenCalledWith('setCreateFile', expect.anything())
        expect(c.dispatch).not.toHaveBeenCalled()
    })

    it('filelist_changed moves gcode files and requests metadata', async () => {
        const c = ctx()
        await actions.filelist_changed(
            c as never,
            {
                action: 'move_file',
                source_item: { path: 'old.gcode', root: 'gcodes' },
                item: { path: 'new.gcode', root: 'gcodes' },
            } as never
        )
        expect(c.commit).toHaveBeenCalledWith('setMoveFile', expect.anything())
        expect(c.dispatch).toHaveBeenCalledWith('requestMetadata', [{ filename: 'gcodes/new.gcode' }])
    })

    it('filelist_changed skips metadata for non-gcode moves', async () => {
        const c = ctx()
        await actions.filelist_changed(
            c as never,
            {
                action: 'move_file',
                source_item: { path: 'a.txt', root: 'gcodes' },
                item: { path: 'b.txt', root: 'gcodes' },
            } as never
        )
        expect(c.dispatch).not.toHaveBeenCalled()
        const other = ctx()
        await actions.filelist_changed(
            other as never,
            {
                action: 'move_file',
                source_item: { path: 'a.cfg', root: 'config' },
                item: { path: 'b.cfg', root: 'config' },
            } as never
        )
        expect(other.dispatch).not.toHaveBeenCalled()
    })

    it('filelist_changed create_dir refreshes the directory', async () => {
        const c = ctx()
        await actions.filelist_changed(
            c as never,
            {
                action: 'create_dir',
                item: { path: 'newdir', root: 'gcodes' },
            } as never
        )
        expect(c.commit).toHaveBeenCalledWith('setCreateDir', expect.anything())
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'gcodes/newdir' },
            { action: 'files/getDirectory' }
        )
    })

    it('filelist_changed root_update notifies the server module', async () => {
        const c = ctx()
        const payload = { action: 'root_update', item: { root: 'gcodes' } }
        await actions.filelist_changed(c as never, payload as never)
        expect(c.dispatch).toHaveBeenCalledWith('server/addRootDirectory', payload, { root: true })
        expect(c.commit).toHaveBeenCalledWith('setRootUpdate', payload)
    })

    it('filelist_changed logs unknown actions', async () => {
        const c = ctx()
        await actions.filelist_changed(c as never, { action: 'explode', item: {} } as never)
        expect(window.console.error).toHaveBeenCalledWith(expect.stringContaining('explode'))
        expect(c.commit).not.toHaveBeenCalled()
    })

    it('getMove toasts errors, renames and moves', () => {
        const c = ctx()
        actions.getMove(c as never, { error: { message: 'boom' }, requestParams: {} } as never)
        expect(mocks.toastError).toHaveBeenCalledWith('boom')
        actions.getMove(
            c as never,
            { requestParams: { source: 'gcodes/old.gcode', dest: 'gcodes/new.gcode', path: '' } } as never
        )
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Files.SuccessfullyRenamed')
        actions.getMove(
            c as never,
            { requestParams: { source: 'gcodes/a.gcode', dest: 'config/a.gcode', path: '' } } as never
        )
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Files.SuccessfullyMoved')
    })

    it('getCreateDir and getDeleteDir toast outcomes', () => {
        const c = ctx()
        actions.getCreateDir(c as never, { error: { message: 'no' }, requestParams: {} } as never)
        expect(mocks.toastError).toHaveBeenCalledWith('no')
        actions.getCreateDir(c as never, { requestParams: { source: '', dest: '', path: 'gcodes/newdir' } } as never)
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Files.SuccessfullyCreated')
        actions.getDeleteDir(c as never, { error: { message: 'no' }, requestParams: {} } as never)
        expect(mocks.toastError).toHaveBeenCalledWith('no')
        actions.getDeleteDir(c as never, { requestParams: { source: '', dest: '', path: 'gcodes/olddir' } } as never)
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Files.SuccessfullyDeleted')
    })

    it('getDeleteFile toasts unless a timelapse jpg was removed', () => {
        const c = ctx()
        actions.getDeleteFile(c as never, { error: { message: 'no' }, item: {} } as never)
        expect(mocks.toastError).toHaveBeenCalledWith('no')
        actions.getDeleteFile(c as never, { item: { path: 'sub/a.gcode', root: 'gcodes' } } as never)
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Files.SuccessfullyDeleted')
        mocks.toastSuccess.mockClear()
        actions.getDeleteFile(c as never, { item: { path: 'frame.jpg', root: 'timelapse' } } as never)
        expect(mocks.toastSuccess).not.toHaveBeenCalled()
    })

    it('uploadFile resolves the uploaded filename and reports progress', async () => {
        mocks.axiosPost.mockImplementation((...args: unknown[]) => {
            const config = args[2] as { onUploadProgress?: (e: unknown) => void }
            config.onUploadProgress?.({ progress: 0.5, rate: 200 })
            return Promise.resolve({ data: { item: { path: 'gcodes/sub/up.gcode' } } })
        })
        const c = ctx({ rootGetters: { 'socket/getUrl': 'http://host' } })
        const result = await actions.uploadFile(
            c as never,
            {
                file: new File(['x'], 'up.gcode'),
                path: 'sub',
                root: 'gcodes',
            } as never
        )
        expect(result).toBe('up.gcode')
        expect(c.commit).toHaveBeenCalledWith('uploadClearState')
        expect(c.commit).toHaveBeenCalledWith('uploadSetCancelTokenSource', mocks.cancelSource)
        expect(c.commit).toHaveBeenCalledWith('uploadSetFilename', 'up.gcode')
        expect(c.commit).toHaveBeenCalledWith('uploadSetShow', true)
        expect(c.commit).toHaveBeenCalledWith('uploadSetPercent', 50)
        expect(c.commit).toHaveBeenCalledWith('uploadSetSpeed', 200)
        expect(c.commit).toHaveBeenCalledWith('uploadSetShow', false)
        expect(mocks.axiosPost).toHaveBeenCalledWith(
            'http://host/server/files/upload',
            expect.any(FormData),
            expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
        )
    })

    it('uploadFile resolves false and toasts on failure', async () => {
        mocks.axiosPost.mockRejectedValue(new Error('denied'))
        const c = ctx({ rootGetters: { 'socket/getUrl': 'http://host' } })
        const result = await actions.uploadFile(
            c as never,
            {
                file: new File(['x'], 'up.gcode'),
                path: '',
                root: 'gcodes',
            } as never
        )
        expect(result).toBe(false)
        expect(mocks.toastError).toHaveBeenCalledWith('FullscreenUpload.CannotUploadFile')
        expect(c.commit).toHaveBeenCalledWith('uploadSetShow', false)
    })

    it('upload counter actions commit through', () => {
        const c = ctx()
        actions.uploadSetShow(c as never, true as never)
        expect(c.commit).toHaveBeenCalledWith('uploadSetShow', true)
        actions.uploadSetCurrentNumber(c as never, 3 as never)
        expect(c.commit).toHaveBeenCalledWith('uploadSetCurrentNumber', 3)
        const counting = ctx({ state: { upload: { currentNumber: 4 } } })
        actions.uploadIncrementCurrentNumber(counting as never)
        expect(counting.commit).toHaveBeenCalledWith('uploadSetCurrentNumber', 5)
        actions.uploadSetMaxNumber(c as never, 9 as never)
        expect(c.commit).toHaveBeenCalledWith('uploadSetMaxNumber', 9)
    })

    it('downloadZip opens the file url', () => {
        const c = ctx({ rootGetters: { 'socket/getUrl': 'http://host' } })
        actions.downloadZip(c as never, { destination: { root: 'gcodes', path: 'sub/a gcode.gcode' } } as never)
        expect(window.open).toHaveBeenCalledWith('http://host/server/files/gcodes/sub/a%20gcode.gcode')
    })

    it('rolloverLog toasts results and refreshes the logs directory', () => {
        const c = ctx()
        actions.rolloverLog(
            c as never,
            {
                rolled_over: ['klippy.log'],
                failed: { 'moonraker.log': 'locked' },
            } as never
        )
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Machine.LogfilesPanel.RolloverToastSuccessful')
        expect(mocks.toastError).toHaveBeenCalledWith('Machine.LogfilesPanel.RolloverToastFailed')
        expect(mocks.emit).not.toHaveBeenCalled()
        vi.advanceTimersByTime(500)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.get_directory',
            { path: 'logs' },
            { action: 'files/getDirectory' }
        )
    })
})
