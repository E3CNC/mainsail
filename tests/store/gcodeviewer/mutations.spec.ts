import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/gcodeviewer/mutations'
import { getDefaultState } from '@/store/gcodeviewer/index'

describe('gcodeviewer/mutations', () => {
    it('reset restores defaults', () => {
        const s = { viewerBackup: { a: 1 }, canvasBackup: { b: 2 }, loadedFileBackup: 'x' } as never
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('setViewerBackup keeps null and wraps objects with markRaw', () => {
        const s = getDefaultState()
        mutations.setViewerBackup(s as never, null)
        expect(s.viewerBackup).toBeNull()
        const backup = { big: true } as never
        mutations.setViewerBackup(s as never, backup)
        expect(s.viewerBackup).toBeTruthy()
    })

    it('setCanvasBackup stores the canvas', () => {
        const s = getDefaultState()
        const canvas = { node: true } as never
        mutations.setCanvasBackup(s as never, canvas)
        expect(s.canvasBackup).toBe(canvas)
        mutations.setCanvasBackup(s as never, null)
        expect(s.canvasBackup).toBeNull()
    })

    it('setLoadedFileBackup stores the filename', () => {
        const s = getDefaultState()
        mutations.setLoadedFileBackup(s as never, 'benchy.gcode')
        expect(s.loadedFileBackup).toBe('benchy.gcode')
        mutations.setLoadedFileBackup(s as never, null)
        expect(s.loadedFileBackup).toBeNull()
    })
})
