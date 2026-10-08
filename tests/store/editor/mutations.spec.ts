import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/editor/mutations'
import { getDefaultState } from '@/store/editor/index'

function state(overrides = {}) {
    return { ...getDefaultState(), ...overrides }
}

describe('editor/mutations', () => {
    it('reset restores defaults', () => {
        const s = state({ filename: 'printer.cfg', sourcecode: 'hello', bool: true, changed: true })
        mutations.reset(s as never)
        expect(s).toEqual(getDefaultState())
    })

    it('updateCancelTokenSource stores the source', () => {
        const s = state()
        const source = { token: {}, cancel: () => {} } as never
        mutations.updateCancelTokenSource(s as never, source)
        expect(s.cancelToken).toBe(source)
        mutations.updateCancelTokenSource(s as never, null)
        expect(s.cancelToken).toBeNull()
    })

    it('updateLoaderState toggles the loader flag', () => {
        const s = state()
        mutations.updateLoaderState(s as never, true)
        expect(s.loaderBool).toBe(true)
        mutations.updateLoaderState(s as never, false)
        expect(s.loaderBool).toBe(false)
    })

    it('updateLoader replaces progress', () => {
        const s = state()
        const progress = { direction: 'uploading', loaded: 10, total: 100, speed: '1 kB' } as never
        mutations.updateLoader(s as never, progress)
        expect(s.loaderProgress).toEqual(progress)
    })

    it('openFile stores file and normalizes line endings for the hash', () => {
        const s = state()
        mutations.openFile(s as never, {
            filename: 'printer.cfg',
            fileroot: 'config',
            filepath: 'sub',
            file: 'line1\r\nline2\rline3\n',
        })
        expect(s.filename).toBe('printer.cfg')
        expect(s.fileroot).toBe('config')
        expect(s.filepath).toBe('sub')
        expect(s.sourcecode).toBe('line1\r\nline2\rline3\n')
        expect(s.changed).toBe(false)
        expect(s.bool).toBe(true)
        expect(typeof s.loadedHash).toBe('string')
        expect(s.loadedHash).toHaveLength(64)

        // unix endings produce the same hash
        const s2 = state()
        mutations.openFile(s2 as never, {
            filename: 'printer.cfg',
            fileroot: 'config',
            filepath: 'sub',
            file: 'line1\nline2\nline3\n',
        })
        expect(s2.loadedHash).toBe(s.loadedHash)
    })

    it('showEditor / hideEditor toggle visibility', () => {
        const s = state()
        mutations.showEditor(s as never)
        expect(s.bool).toBe(true)
        mutations.hideEditor(s as never)
        expect(s.bool).toBe(false)
    })

    it('setFilename and setPermissions store values', () => {
        const s = state()
        mutations.setFilename(s as never, 'moonraker.conf')
        expect(s.filename).toBe('moonraker.conf')
        mutations.setPermissions(s as never, 'rw')
        expect(s.permissions).toBe('rw')
    })

    it('updateSourcecode flags changes against the loaded hash', () => {
        const s = state()
        mutations.openFile(s as never, {
            filename: 'a.cfg',
            fileroot: 'config',
            filepath: '',
            file: 'original',
        })
        mutations.updateSourcecode(s as never, 'original')
        expect(s.sourcecode).toBe('original')
        expect(s.changed).toBe(false)
        mutations.updateSourcecode(s as never, 'modified')
        expect(s.changed).toBe(true)
    })

    it('updateLoadedHash resets the changed flag', () => {
        const s = state({ changed: true })
        mutations.updateLoadedHash(s as never, 'new content')
        expect(s.changed).toBe(false)
        expect(typeof s.loadedHash).toBe('string')
        mutations.updateSourcecode(s as never, 'new content')
        expect(s.changed).toBe(false)
    })
})
