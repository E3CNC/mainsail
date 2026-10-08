import { describe, expect, it, vi } from 'vitest'
import { actions } from '@/store/gcodeviewer/actions'

function ctx() {
    return { commit: vi.fn(), dispatch: vi.fn() }
}

describe('gcodeviewer/actions', () => {
    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('setViewerBackup commits the backup', () => {
        const c = ctx()
        const backup = { viewer: true } as never
        actions.setViewerBackup(c as never, backup)
        expect(c.commit).toHaveBeenCalledWith('setViewerBackup', backup)
        actions.setViewerBackup(c as never, null)
        expect(c.commit).toHaveBeenCalledWith('setViewerBackup', null)
    })

    it('setCanvasBackup commits the backup', () => {
        const c = ctx()
        const backup = { canvas: true } as never
        actions.setCanvasBackup(c as never, backup)
        expect(c.commit).toHaveBeenCalledWith('setCanvasBackup', backup)
    })

    it('setLoadedFileBackup commits the backup', () => {
        const c = ctx()
        actions.setLoadedFileBackup(c as never, 'file.gcode')
        expect(c.commit).toHaveBeenCalledWith('setLoadedFileBackup', 'file.gcode')
        actions.setLoadedFileBackup(c as never, null)
        expect(c.commit).toHaveBeenCalledWith('setLoadedFileBackup', null)
    })
})
