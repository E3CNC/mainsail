import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
    toastError: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/server/timelapse/actions'

function ctx(overrides = {}) {
    return { commit: vi.fn(), dispatch: vi.fn(), state: { settings: {} }, ...overrides }
}

describe('server/timelapse/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.toastError.mockReset()
    })

    it('init requests settings and last frame info', () => {
        actions.init({} as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'machine.timelapse.get_settings',
            {},
            { action: 'server/timelapse/initSettings' }
        )
        expect(mocks.emit).toHaveBeenCalledWith(
            'machine.timelapse.lastframeinfo',
            {},
            { action: 'server/timelapse/initLastFrameinfo' }
        )
    })

    it('initSettings strips params, commits and clears init', async () => {
        const c = ctx()
        await actions.initSettings(c as never, { requestParams: {}, mode: 'layermacro' } as never)
        expect(c.commit).toHaveBeenCalledWith('setSettings', { mode: 'layermacro' })
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/timelapse/init', { root: true })
    })

    it('initLastFrameinfo maps frame fields', () => {
        const c = ctx()
        actions.initLastFrameinfo(c as never, { framecount: 7, lastframefile: 'f.jpg' })
        expect(c.commit).toHaveBeenCalledWith('setLastFrame', { count: 7, file: 'f.jpg' })
    })

    it('getEvent handles newframe and render outcomes', () => {
        const c = ctx()
        actions.getEvent(c as never, { action: 'newframe', frame: '9', framefile: 'n.jpg' } as never)
        expect(c.commit).toHaveBeenCalledWith('setLastFrame', { count: 9, file: 'n.jpg' })
        actions.getEvent(c as never, { action: 'render', status: 'running' } as never)
        expect(c.commit).toHaveBeenCalledWith('setRenderStatus', expect.objectContaining({ status: 'running' }))
        actions.getEvent(c as never, { action: 'render', status: 'error', msg: 'boom' } as never)
        expect(mocks.toastError).toHaveBeenCalledWith('boom')
        expect(c.commit).toHaveBeenCalledWith('resetSnackbar')
    })

    it('saveSetting posts, updateCamSettings guards on the active camera', () => {
        actions.saveSetting({} as never, { mode: 'layermacro' } as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'machine.timelapse.post_settings',
            { mode: 'layermacro' },
            { action: 'server/timelapse/initSettings' }
        )
        const c = ctx({ state: { settings: { camera: 'cam1' } } })
        actions.updateCamSettings(c as never, { oldName: 'other', newName: 'cam2' })
        expect(c.dispatch).not.toHaveBeenCalled()
        actions.updateCamSettings(c as never, { oldName: 'cam1', newName: 'cam2' })
        expect(c.dispatch).toHaveBeenCalledWith('saveSetting', { camera: 'cam2' })
    })

    it('resetSnackbar commits through', () => {
        const c = ctx()
        actions.resetSnackbar(c as never)
        expect(c.commit).toHaveBeenCalledWith('resetSnackbar')
    })
})
