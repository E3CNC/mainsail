import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/gui/webcams/actions'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { webcams: [] },
        rootState: {},
        rootGetters: {},
        getters: {},
        ...overrides,
    }
}

const webcam = {
    name: 'cam1',
    service: 'mjpegstreamer',
    enabled: true,
    icon: 'mdiCamera',
    target_fps: 15,
    stream_url: 'http://localhost/stream',
    snapshot_url: 'http://localhost/snapshot',
    flip_horizontal: false,
    flip_vertical: false,
    rotation: 0,
}

describe('gui/webcams/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('init requests the webcam list', () => {
        const c = ctx()
        actions.init(c as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.webcams.list', {}, { action: 'gui/webcams/initStore' })
    })

    it('initStore resets, stores and removes the init module', async () => {
        const c = ctx()
        await actions.initStore(c as never, { webcams: [webcam] } as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
        expect(c.commit).toHaveBeenCalledWith('initStore', [webcam])
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'gui/webcam/init', { root: true })
    })

    it('store posts the webcam', () => {
        const c = ctx()
        actions.store(c as never, webcam as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.webcams.post_item', webcam)
    })

    it('update posts and deletes the old webcam when renamed, skipping timelapse without the component', () => {
        const c = ctx({ rootState: { server: { components: [] } } })
        actions.update(c as never, { webcam: { ...webcam, name: 'cam2' }, oldWebcamName: 'cam1' } as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.webcams.post_item', expect.objectContaining({ name: 'cam2' }))
        expect(c.dispatch).toHaveBeenCalledWith('delete', 'cam1')
        expect(c.dispatch).not.toHaveBeenCalledWith(
            'server/timelapse/updateCamSettings',
            expect.anything(),
            expect.anything()
        )
    })

    it('update forwards the rename to timelapse when the component is active', () => {
        const c = ctx({ rootState: { server: { components: ['timelapse'] } } })
        actions.update(c as never, { webcam: { ...webcam, name: 'cam2' }, oldWebcamName: 'cam1' } as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'server/timelapse/updateCamSettings',
            { newName: 'cam2', oldName: 'cam1' },
            { root: true }
        )
    })

    it('update skips delete and timelapse when the name is unchanged', () => {
        const c = ctx({ rootState: { server: { components: ['timelapse'] } } })
        actions.update(c as never, { webcam: { ...webcam, name: 'cam1' }, oldWebcamName: 'cam1' } as never)
        expect(c.dispatch).not.toHaveBeenCalledWith('delete', expect.anything())
        expect(c.dispatch).toHaveBeenCalledWith(
            'server/timelapse/updateCamSettings',
            { newName: 'cam1', oldName: 'cam1' },
            { root: true }
        )
    })

    it('update returns early on timelapse check when server state is missing', () => {
        const c = ctx({ rootState: {} })
        actions.update(c as never, { webcam: { ...webcam, name: 'cam1' }, oldWebcamName: 'cam1' } as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.webcams.post_item', expect.objectContaining({ name: 'cam1' }))
        expect(c.dispatch).not.toHaveBeenCalledWith(
            'server/timelapse/updateCamSettings',
            expect.anything(),
            expect.anything()
        )
    })

    it('delete emits the delete item event', () => {
        const c = ctx()
        actions.delete(c as never, 'cam1')
        expect(mocks.emit).toHaveBeenCalledWith('server.webcams.delete_item', { name: 'cam1' })
    })
})
