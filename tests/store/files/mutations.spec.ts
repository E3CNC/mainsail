import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { mutations } from '@/store/files/mutations'
import { getDefaultState } from '@/store/files/index'
import type { FileState, FileStateFile } from '@/store/files/types'

function dir(name: string, childrens: FileStateFile[] = []): FileStateFile {
    return { isDirectory: true, filename: name, modified: new Date('2024-01-01'), permissions: 'r', childrens }
}

function file(name: string, overrides: Partial<FileStateFile> = {}): FileStateFile {
    return {
        isDirectory: false,
        filename: name,
        modified: new Date('2024-01-01T00:00:00Z'),
        permissions: 'r',
        size: 100,
        ...overrides,
    }
}

function stateWithGcodes(children: FileStateFile[] = []): FileState {
    const s = getDefaultState()
    s.filetree.push(dir('gcodes', children))
    return s
}

describe('files/mutations', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
        vi.spyOn(window.console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reset restores the default state', () => {
        const s = stateWithGcodes([file('a.gcode')])
        s.upload.show = true
        mutations.reset(s as never, undefined as never)
        expect(s.filetree).toEqual([])
        expect(s.upload.show).toBe(false)
    })

    it('createRootDir appends a root directory', () => {
        const s = getDefaultState()
        mutations.createRootDir(s as never, { name: 'gcodes', permissions: 'r' } as never)
        expect(s.filetree).toHaveLength(1)
        expect(s.filetree[0]).toMatchObject({ isDirectory: true, filename: 'gcodes', childrens: [] })
    })

    it('setMetadataRequested flags an existing file', () => {
        const s = stateWithGcodes([file('test.gcode')])
        mutations.setMetadataRequested(s as never, { filename: 'test.gcode' } as never)
        expect(s.filetree[0].childrens?.[0].metadataRequested).toBe(true)
    })

    it('setMetadataRequested flags a nested file', () => {
        const s = stateWithGcodes([dir('sub', [file('nested.gcode')])])
        mutations.setMetadataRequested(s as never, { filename: 'sub/nested.gcode' } as never)
        const sub = s.filetree[0].childrens?.find((e) => e.filename === 'sub')
        expect(sub?.childrens?.[0].metadataRequested).toBe(true)
    })

    it('setMetadataRequested logs when the file is missing', () => {
        const s = stateWithGcodes()
        mutations.setMetadataRequested(s as never, { filename: 'missing.gcode' } as never)
        expect(window.console.error).toHaveBeenCalledWith(expect.stringContaining('missing.gcode'))
    })

    it('setMetadata copies allowed keys and marks pulled', () => {
        const s = stateWithGcodes([file('test.gcode')])
        mutations.setMetadata(
            s as never,
            { filename: 'test.gcode', uuid: 'abc', slicer: 'Prusa', evil: 'nope' } as never
        )
        const f = s.filetree[0].childrens?.[0]
        expect(f?.uuid).toBe('abc')
        expect(f?.slicer).toBe('Prusa')
        expect(f).not.toHaveProperty('evil')
        expect(f?.metadataRequested).toBe(true)
        expect(f?.metadataPulled).toBe(true)
    })

    it('setMetadata logs when the file is missing', () => {
        const s = stateWithGcodes()
        mutations.setMetadata(s as never, { filename: 'missing.gcode' } as never)
        expect(window.console.error).toHaveBeenCalledWith(expect.stringContaining('missing.gcode'))
    })

    it('setCreateFile creates a root-level file', () => {
        const s = stateWithGcodes()
        mutations.setCreateFile(
            s as never,
            { item: { path: 'test.gcode', root: 'gcodes', permissions: 'r', modified: 1700000000, size: 42 } } as never
        )
        expect(s.filetree[0].childrens).toHaveLength(1)
        expect(s.filetree[0].childrens?.[0]).toMatchObject({ filename: 'test.gcode', size: 42 })
    })

    it('setCreateFile creates a nested file', () => {
        const s = stateWithGcodes([dir('sub')])
        mutations.setCreateFile(
            s as never,
            { item: { path: 'sub/a.gcode', root: 'gcodes', permissions: 'r', modified: 1700000000, size: 7 } } as never
        )
        const sub = s.filetree[0].childrens?.find((e) => e.filename === 'sub')
        expect(sub?.childrens?.[0]).toMatchObject({ filename: 'a.gcode', size: 7 })
    })

    it('setCreateFile updates an existing file without metadata emit for non-gcode', () => {
        const s = stateWithGcodes([file('readme.txt')])
        mutations.setCreateFile(
            s as never,
            { item: { path: 'readme.txt', root: 'gcodes', permissions: 'r', modified: 1700000001, size: 9 } } as never
        )
        expect(s.filetree[0].childrens).toHaveLength(1)
        expect(mocks.emit).not.toHaveBeenCalled()
    })

    it('setCreateFile re-requests metadata for an existing gcode file', () => {
        const s = stateWithGcodes([file('test.gcode')])
        mutations.setCreateFile(
            s as never,
            { item: { path: 'test.gcode', root: 'gcodes', permissions: 'r', modified: 1700000001, size: 9 } } as never
        )
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.metadata',
            { filename: 'test.gcode' },
            { action: 'files/getMetadata' }
        )
    })

    it('setCreateFile falls back to the top level for unknown roots', () => {
        const s = getDefaultState()
        mutations.setCreateFile(
            s as never,
            { item: { path: 'a.gcode', root: 'nope', permissions: 'r', modified: 1, size: 1 } } as never
        )
        // findDirectory returns the input folder when no parent matches,
        // so the file lands at the top level
        expect(s.filetree.map((f) => f.filename)).toEqual(['a.gcode'])
    })

    it('setMoveFile renames within the same directory', () => {
        const s = stateWithGcodes([file('old.gcode')])
        mutations.setMoveFile(
            s as never,
            { source_item: { path: 'old.gcode', root: 'gcodes' }, item: { path: 'new.gcode', root: 'gcodes' } } as never
        )
        expect(s.filetree[0].childrens?.map((f) => f.filename)).toEqual(['new.gcode'])
    })

    it('setMoveFile moves across directories and clears stale thumbnails', () => {
        const s = stateWithGcodes([
            dir('a', [
                file('m.gcode', {
                    metadataPulled: true,
                    thumbnails: [{ width: 300, height: 300, size: 1, relative_path: '.thumbs/m.png' }],
                }),
            ]),
            dir('b'),
        ])
        mutations.setMoveFile(
            s as never,
            { source_item: { path: 'a/m.gcode', root: 'gcodes' }, item: { path: 'b/m.gcode', root: 'gcodes' } } as never
        )
        const a = s.filetree[0].childrens?.find((e) => e.filename === 'a')
        const b = s.filetree[0].childrens?.find((e) => e.filename === 'b')
        expect(a?.childrens).toHaveLength(0)
        expect(b?.childrens?.[0].filename).toBe('m.gcode')
        expect(b?.childrens?.[0].metadataPulled).toBe(false)
        expect(b?.childrens?.[0]).not.toHaveProperty('thumbnails')
    })

    it('setMoveFile returns early when the source is missing', () => {
        const s = stateWithGcodes()
        mutations.setMoveFile(
            s as never,
            {
                source_item: { path: 'ghost.gcode', root: 'gcodes' },
                item: { path: 'b/ghost.gcode', root: 'gcodes' },
            } as never
        )
        expect(s.filetree[0].childrens).toEqual([])
    })

    it('setModifyFile updates size and timestamp and resets pulled metadata', () => {
        const s = stateWithGcodes([
            file('test.gcode', {
                metadataPulled: true,
                thumbnails: [{ width: 300, height: 300, size: 1, relative_path: '.thumbs/t.png' }],
            }),
        ])
        mutations.setModifyFile(
            s as never,
            { item: { path: 'test.gcode', root: 'gcodes', modified: 1700000005, size: 123 } } as never
        )
        const f = s.filetree[0].childrens?.[0]
        expect(f?.size).toBe(123)
        expect(f?.metadataPulled).toBe(false)
        expect(f).not.toHaveProperty('thumbnails')
    })

    it('setModifyFile handles nested paths and missing files', () => {
        const s = stateWithGcodes([dir('sub', [file('a.gcode')])])
        mutations.setModifyFile(
            s as never,
            { item: { path: 'sub/a.gcode', root: 'gcodes', modified: 1700000005, size: 5 } } as never
        )
        const sub = s.filetree[0].childrens?.find((e) => e.filename === 'sub')
        expect(sub?.childrens?.[0].size).toBe(5)
        mutations.setModifyFile(
            s as never,
            { item: { path: 'sub/ghost.gcode', root: 'gcodes', modified: 1, size: 1 } } as never
        )
        expect(sub?.childrens).toHaveLength(1)
    })

    it('setMoveDir renames and relocates directories', () => {
        const s = stateWithGcodes([dir('old', [file('a.gcode')]), dir('target')])
        mutations.setMoveDir(
            s as never,
            { source_item: { path: 'old', root: 'gcodes' }, item: { path: 'target/old', root: 'gcodes' } } as never
        )
        const top = s.filetree[0].childrens?.map((e) => e.filename)
        expect(top).toEqual(['target'])
        const target = s.filetree[0].childrens?.find((e) => e.filename === 'target')
        expect(target?.childrens?.map((e) => e.filename)).toContain('old')
    })

    it('setMoveDir ignores missing sources', () => {
        const s = stateWithGcodes()
        mutations.setMoveDir(
            s as never,
            { source_item: { path: 'ghost', root: 'gcodes' }, item: { path: 'ghost2', root: 'gcodes' } } as never
        )
        expect(s.filetree[0].childrens).toEqual([])
    })

    it('setDeleteFile removes files and ignores misses', () => {
        const s = stateWithGcodes([dir('sub', [file('a.gcode')]), file('top.gcode')])
        mutations.setDeleteFile(s as never, { item: { path: 'sub/a.gcode', root: 'gcodes' } } as never)
        const sub = s.filetree[0].childrens?.find((e) => e.filename === 'sub')
        expect(sub?.childrens).toHaveLength(0)
        mutations.setDeleteFile(s as never, { item: { path: 'sub/ghost.gcode', root: 'gcodes' } } as never)
        expect(sub?.childrens).toHaveLength(0)
        mutations.setDeleteFile(s as never, { item: { path: 'top.gcode', root: 'gcodes' } } as never)
        expect(s.filetree[0].childrens?.map((e) => e.filename)).toEqual(['sub'])
    })

    it('setDeleteFile returns early for unknown roots', () => {
        const s = getDefaultState()
        mutations.setDeleteFile(s as never, { item: { path: 'a.gcode', root: 'nope' } } as never)
        expect(s.filetree).toEqual([])
    })

    it('setCreateDir creates nested and root-level dirs', () => {
        const s = stateWithGcodes([dir('sub')])
        mutations.setCreateDir(
            s as never,
            { item: { path: 'sub/newdir', root: 'gcodes', permissions: 'r', modified: 1700000000 } } as never
        )
        const sub = s.filetree[0].childrens?.find((e) => e.filename === 'sub')
        expect(sub?.childrens?.[0]).toMatchObject({ filename: 'newdir', isDirectory: true })
        mutations.setCreateDir(s as never, { item: { path: 'topdir', root: 'gcodes', permissions: 'r' } } as never)
        expect(s.filetree[0].childrens?.map((e) => e.filename)).toContain('topdir')
    })

    it('setDeleteDir removes directories and ignores misses', () => {
        const s = stateWithGcodes([dir('sub', [dir('gone')])])
        mutations.setDeleteDir(s as never, { item: { path: 'sub/gone', root: 'gcodes' } } as never)
        const sub = s.filetree[0].childrens?.find((e) => e.filename === 'sub')
        expect(sub?.childrens).toHaveLength(0)
        mutations.setDeleteDir(s as never, { item: { path: 'sub/ghost', root: 'gcodes' } } as never)
        expect(sub?.childrens).toHaveLength(0)
    })

    it('setDeleteDir returns early for unknown roots', () => {
        const s = getDefaultState()
        mutations.setDeleteDir(s as never, { item: { path: 'a', root: 'nope' } } as never)
        expect(s.filetree).toEqual([])
    })

    it('setRootUpdate clears children of the matching root', () => {
        const s = stateWithGcodes([file('a.gcode')])
        mutations.setRootUpdate(s as never, { item: { root: 'gcodes' } } as never)
        expect(s.filetree[0].childrens).toHaveLength(0)
        mutations.setRootUpdate(s as never, { item: { root: 'unknown' } } as never)
        expect(s.filetree).toHaveLength(1)
    })

    it('setDiskUsage assigns usage to root and nested dirs', () => {
        const s = stateWithGcodes([dir('sub')])
        const usage = { free: 1, total: 2, used: 1 }
        mutations.setDiskUsage(s as never, { path: 'gcodes', disk_usage: usage } as never)
        expect(s.filetree[0].disk_usage).toEqual(usage)
        const usage2 = { free: 5, total: 9, used: 4 }
        mutations.setDiskUsage(s as never, { path: 'gcodes/sub', disk_usage: usage2 } as never)
        const sub = s.filetree[0].childrens?.find((e) => e.filename === 'sub')
        expect(sub?.disk_usage).toEqual(usage2)
        mutations.setDiskUsage(s as never, { path: 'gcodes/ghost', disk_usage: usage2 } as never)
        expect(sub?.disk_usage).toEqual(usage2)
    })

    it('setRootPermissions updates matching roots only', () => {
        const s = stateWithGcodes()
        mutations.setRootPermissions(s as never, { name: 'gcodes', permissions: 'rw' } as never)
        expect(s.filetree[0].permissions).toBe('rw')
        mutations.setRootPermissions(s as never, { name: 'unknown', permissions: 'rw' } as never)
        expect(s.filetree).toHaveLength(1)
    })

    it('upload mutations manage the upload state', () => {
        const s = getDefaultState()
        mutations.uploadSetShow(s as never, true as never)
        expect(s.upload.show).toBe(true)
        mutations.uploadSetFilename(s as never, 'a.gcode' as never)
        expect(s.upload.filename).toBe('a.gcode')
        const token = { cancel: vi.fn() }
        mutations.uploadSetCancelTokenSource(s as never, token as never)
        expect(s.upload.cancelTokenSource).toBe(token as never)
        mutations.uploadSetCurrentNumber(s as never, 2 as never)
        expect(s.upload.currentNumber).toBe(2)
        mutations.uploadSetMaxNumber(s as never, 5 as never)
        expect(s.upload.maxNumber).toBe(5)
        mutations.uploadSetPercent(s as never, 10 as never)
        expect(s.upload.percent).toBe(10)
        mutations.uploadSetPercent(s as never, 10 as never)
        expect(s.upload.percent).toBe(10)
        mutations.uploadSetSpeed(s as never, 99 as never)
        expect(s.upload.speed).toBe(99)
        mutations.uploadSetSpeed(s as never, 99 as never)
        expect(s.upload.speed).toBe(99)
        mutations.uploadClearState(s as never, undefined as never)
        expect(s.upload).toMatchObject({ show: false, filename: '', percent: 0, speed: 0 })
        expect(s.upload.cancelTokenSource).toBeNull()
    })
})
