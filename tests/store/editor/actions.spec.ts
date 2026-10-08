import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
    emitAndWait: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    axiosGet: vi.fn(),
    axiosPost: vi.fn(),
    cancelFn: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: {
        error: (...args: unknown[]) => mocks.toastError(...args),
        success: (...args: unknown[]) => mocks.toastSuccess(...args),
    },
}))

vi.mock('@/plugins/helpers', () => ({
    escapePath: (p: string) => p.replace(/ /g, '%20'),
    formatFilesize: (n: number) => `${n} B`,
    windowBeforeUnloadFunction: (e: Event) => e.preventDefault(),
}))

vi.mock('@/plugins/i18n', () => ({
    default: { global: { t: (key: string) => key } },
}))

vi.mock('axios', () => ({
    default: {
        get: (...args: unknown[]) => mocks.axiosGet(...args),
        post: (...args: unknown[]) => mocks.axiosPost(...args),
        CancelToken: {
            source: () => ({ token: { id: 'token' }, cancel: mocks.cancelFn }),
        },
    },
}))

import { actions } from '@/store/editor/actions'
import { getDefaultState } from '@/store/editor/index'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { ...getDefaultState() },
        rootState: {},
        rootGetters: { 'socket/getUrl': 'http://localhost:7125' },
        getters: {},
        ...overrides,
    }
}

describe('editor/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
        mocks.toastSuccess.mockReset()
        mocks.axiosGet.mockReset()
        mocks.axiosPost.mockReset()
        mocks.cancelFn.mockReset()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('downloadProgress commits loader with explicit filesize', () => {
        const c = ctx()
        actions.downloadProgress(c as never, {
            progressEvent: { loaded: 50, total: 200, rate: 10 } as never,
            direction: 'downloading',
            filesize: 200,
        })
        expect(c.commit).toHaveBeenCalledWith(
            'updateLoader',
            expect.objectContaining({ direction: 'downloading', loaded: 50, total: 200, speed: '10 B' })
        )
    })

    it('downloadProgress falls back to event total and zero rate', () => {
        const c = ctx()
        actions.downloadProgress(c as never, {
            progressEvent: { loaded: 5, total: 60 } as never,
            direction: 'uploading',
            filesize: null,
        })
        expect(c.commit).toHaveBeenCalledWith(
            'updateLoader',
            expect.objectContaining({ direction: 'uploading', total: 60, speed: '0 B' })
        )
    })

    it('openFile builds the url, cancels prior loads and opens the file', async () => {
        const c = ctx()
        mocks.axiosGet.mockResolvedValue({ data: { text: () => Promise.resolve('content') } })
        actions.openFile(c as never, {
            root: 'gcodes',
            path: '/sub/',
            filename: 'test.gcode',
            permissions: 'rw',
            size: 123,
        })
        expect(mocks.axiosGet).toHaveBeenCalledWith(
            expect.stringContaining('/server/files/gcodes/sub/test.gcode'),
            expect.objectContaining({ responseType: 'blob' })
        )
        expect(c.commit).toHaveBeenCalledWith('setFilename', 'test.gcode')
        expect(c.commit).toHaveBeenCalledWith('setPermissions', 'rw')
        await vi.runAllTimersAsync()
        await Promise.resolve()
        await Promise.resolve()
        expect(c.commit).toHaveBeenCalledWith(
            'openFile',
            expect.objectContaining({ filename: 'test.gcode', fileroot: 'gcodes', filepath: 'sub' })
        )
    })

    it('openFile handles root-level paths and cancels an active load', () => {
        const c = ctx({ state: { ...getDefaultState(), cancelToken: { cancel: mocks.cancelFn } as never } })
        mocks.axiosGet.mockResolvedValue({ data: { text: () => Promise.resolve('x') } })
        actions.openFile(c as never, {
            root: 'config',
            path: '',
            filename: 'printer.cfg',
            permissions: 'rw',
            size: null,
        })
        expect(c.dispatch).toHaveBeenCalledWith('cancelLoad')
        expect(mocks.axiosGet).toHaveBeenCalledWith(
            expect.stringContaining('/server/files/config/printer.cfg'),
            expect.anything()
        )
    })

    it('saveFile uploads, toasts success and restarts klipper', async () => {
        const c = ctx({
            state: { ...getDefaultState(), filename: 'printer.cfg', fileroot: 'config', filepath: '' },
            getters: { getKlipperRestartMethod: 'RESTART' },
        })
        mocks.axiosPost.mockResolvedValue({ data: { item: { path: 'config/printer.cfg' } } })
        const result = await actions.saveFile(c as never, { content: 'hello', restartServiceName: 'klipper' })
        expect(result).toBe(true)
        expect(mocks.axiosPost).toHaveBeenCalled()
        expect(mocks.toastSuccess).toHaveBeenCalled()
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'RESTART' })
        expect(c.commit).toHaveBeenCalledWith('updateLoadedHash', 'hello')
        expect(c.dispatch).toHaveBeenCalledWith('close')
    })

    it('saveFile restarts moonraker and custom services', async () => {
        const base = { ...getDefaultState(), filename: 'a.cfg', fileroot: 'config', filepath: '' }
        mocks.axiosPost.mockResolvedValue({ data: { item: { path: 'a.cfg' } } })

        const moon = ctx({ state: base })
        await actions.saveFile(moon as never, { content: 'x', restartServiceName: 'moonraker' })
        expect(mocks.emit).toHaveBeenCalledWith('server.restart', {})

        mocks.emit.mockClear()
        const custom = ctx({ state: base })
        await actions.saveFile(custom as never, { content: 'x', restartServiceName: 'crowsnest' })
        expect(mocks.emit).toHaveBeenCalledWith('machine.services.restart', { service: 'crowsnest' })
    })

    it('saveFile without restart skips emit and close', async () => {
        const c = ctx({ state: { ...getDefaultState(), filename: 'a.cfg', fileroot: 'config', filepath: '' } })
        mocks.axiosPost.mockResolvedValue({ data: { item: { path: 'a.cfg' } } })
        const result = await actions.saveFile(c as never, { content: 'x', restartServiceName: null })
        expect(result).toBe(true)
        expect(mocks.emit).not.toHaveBeenCalled()
        expect(c.dispatch).not.toHaveBeenCalledWith('close')
    })

    it('saveFile returns false and toasts on error', async () => {
        const c = ctx({ state: { ...getDefaultState(), filename: 'a.cfg', fileroot: 'config', filepath: '' } })
        mocks.axiosPost.mockRejectedValue({ response: { data: { error: 'disk full' } } })
        const result = await actions.saveFile(c as never, { content: 'x', restartServiceName: null })
        expect(result).toBe(false)
        expect(mocks.toastError).toHaveBeenCalled()
        expect(c.dispatch).toHaveBeenCalledWith('clearLoader')
    })

    it('cancelLoad cancels and clears, or no-ops without a token', () => {
        const c = ctx({ state: { ...getDefaultState(), cancelToken: { cancel: mocks.cancelFn } as never } })
        actions.cancelLoad(c as never)
        expect(mocks.cancelFn).toHaveBeenCalledWith('User canceled upload/download')
        expect(c.commit).toHaveBeenCalledWith('updateCancelTokenSource', null)
        expect(c.dispatch).toHaveBeenCalledWith('clearLoader')

        const empty = ctx()
        actions.cancelLoad(empty as never)
        expect(empty.commit).not.toHaveBeenCalled()
    })

    it('clearLoader resets loader state', () => {
        const c = ctx()
        actions.clearLoader(c as never)
        expect(c.commit).toHaveBeenCalledWith('updateLoaderState', false)
        expect(c.commit).toHaveBeenCalledWith(
            'updateLoader',
            expect.objectContaining({ direction: 'downloading', loaded: 0, total: 0 })
        )
    })

    it('close resets and removes the beforeunload listener', () => {
        const c = ctx()
        const remove = vi.spyOn(window, 'removeEventListener')
        actions.close(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
        expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function))
        remove.mockRestore()
    })

    it('updateSourcecode commits through', () => {
        const c = ctx()
        actions.updateSourcecode(c as never, 'gcode')
        expect(c.commit).toHaveBeenCalledWith('updateSourcecode', 'gcode')
    })
})
