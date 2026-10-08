import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    close: vi.fn(),
    setUrl: vi.fn(),
    connect: vi.fn(),
    emit: vi.fn(),
    emitAndWait: vi.fn(),
    toastInfo: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    getSocket: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: (...args: unknown[]) => mocks.getSocket(...args),
    $toast: {
        info: (...args: unknown[]) => mocks.toastInfo(...args),
        success: (...args: unknown[]) => mocks.toastSuccess(...args),
        error: (...args: unknown[]) => mocks.toastError(...args),
    },
}))

import { actions } from '@/store/socket/actions'

function ctx(overrides = {}) {
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

function socketStub() {
    return {
        close: mocks.close,
        setUrl: mocks.setUrl,
        connect: mocks.connect,
        emit: mocks.emit,
        emitAndWait: mocks.emitAndWait,
    }
}

describe('socket/actions', () => {
    beforeEach(() => {
        mocks.close.mockReset()
        mocks.setUrl.mockReset()
        mocks.connect.mockReset()
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastInfo.mockReset()
        mocks.toastSuccess.mockReset()
        mocks.toastError.mockReset()
        mocks.getSocket.mockReset()
        mocks.getSocket.mockReturnValue(socketStub())
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reset commits disconnect, loadings cleanup and reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('setDisconnected')
        expect(c.commit).toHaveBeenCalledWith('clearLoadings')
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('setData commits the payload through', () => {
        const c = ctx()
        const payload = { hostname: 'printer.local', port: 7125 }
        actions.setData(c as never, payload as never)
        expect(c.commit).toHaveBeenCalledWith('setData', payload)
    })

    it('setSocket stores data and connects with a normalized path', async () => {
        const c = ctx({ state: { protocol: 'ws' } })
        await actions.setSocket(c as never, { hostname: 'printer.local', port: 7125, path: '///api/v1///' } as never)
        expect(c.commit).toHaveBeenCalledWith('setData', {
            hostname: 'printer.local',
            port: 7125,
            path: '///api/v1///',
        })
        expect(mocks.close).toHaveBeenCalled()
        expect(mocks.setUrl).toHaveBeenCalledWith('ws://printer.local:7125/api/v1/websocket')
        expect(mocks.connect).toHaveBeenCalled()
    })

    it('setSocket handles empty and root paths without a path segment', async () => {
        const c = ctx({ state: { protocol: 'wss' } })
        await actions.setSocket(c as never, { hostname: 'printer.local', port: 443, path: '' } as never)
        expect(mocks.setUrl).toHaveBeenCalledWith('wss://printer.local:443/websocket')

        mocks.setUrl.mockClear()
        await actions.setSocket(c as never, { hostname: 'printer.local', port: 443, path: '/' } as never)
        expect(mocks.setUrl).toHaveBeenCalledWith('wss://printer.local:443/websocket')
    })

    it('setSocket swallows errors when the socket is not initialized', async () => {
        mocks.getSocket.mockImplementationOnce(() => {
            throw new Error('Socket not initialized')
        })
        const c = ctx({ state: { protocol: 'ws' } })
        await actions.setSocket(c as never, { hostname: 'printer.local', port: 7125, path: 'api' } as never)
        expect(c.commit).toHaveBeenCalledWith('setData', { hostname: 'printer.local', port: 7125, path: 'api' })
        expect(mocks.close).not.toHaveBeenCalled()
        expect(mocks.setUrl).not.toHaveBeenCalled()
        expect(mocks.connect).not.toHaveBeenCalled()
    })

    it('onOpen marks connected and inits the server', () => {
        const c = ctx()
        actions.onOpen(c as never)
        expect(c.commit).toHaveBeenCalledWith('setConnected')
        expect(c.dispatch).toHaveBeenCalledWith('server/init', null, { root: true })
    })

    it('onClose marks disconnected', () => {
        const c = ctx()
        actions.onClose(c as never)
        expect(c.commit).toHaveBeenCalledWith('setDisconnected')
    })

    it('onReconnecting flags reconnecting and toasts', () => {
        const c = ctx()
        actions.onReconnecting(c as never)
        expect(c.commit).toHaveBeenCalledWith('setReconnecting', true)
        expect(mocks.toastInfo).toHaveBeenCalledWith('Connection lost — reconnecting...', { duration: 4000 })
    })

    it('onReconnected clears the flag, toasts and re-inits server and printer', () => {
        const c = ctx()
        actions.onReconnected(c as never)
        expect(c.commit).toHaveBeenCalledWith('setReconnecting', false)
        expect(c.commit).toHaveBeenCalledWith('setConnected')
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Connection restored', { duration: 3000 })
        expect(c.dispatch).toHaveBeenCalledWith('server/reset', null, { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('server/init', null, { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('printer/reset', null, { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('printer/init', null, { root: true })
    })

    it('onMessage routes printer and server notifications', () => {
        const c = ctx()
        actions.onMessage(c as never, { method: 'notify_status_update', params: [{ toolhead: {} }] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('printer/getData', { toolhead: {} }, { root: true })

        actions.onMessage(c as never, { method: 'notify_gcode_response', params: ['ok'] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('server/addEvent', { result: 'ok', send: false }, { root: true })

        actions.onMessage(c as never, { method: 'notify_proc_stat_update', params: [{ cpu: 1 }] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('server/updateProcStats', { cpu: 1 }, { root: true })

        actions.onMessage(c as never, { method: 'notify_cpu_throttled', params: [{ bits: 1 }] } as never)
        expect(c.commit).toHaveBeenCalledWith('server/setThrottledState', { bits: 1 }, { root: true })
    })

    it('onMessage handles klippy lifecycle notifications', () => {
        const c = ctx()
        actions.onMessage(c as never, { method: 'notify_klippy_ready', params: [] } as never)
        expect(c.commit).toHaveBeenCalledWith('server/setKlippyConnected', null, { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('server/stopKlippyConnectedInterval', null, { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('server/stopKlippyStateInterval', null, { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('printer/init', null, { root: true })

        actions.onMessage(c as never, { method: 'notify_klippy_disconnected', params: [] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('server/setKlippyDisconnected', null, { root: true })

        actions.onMessage(c as never, { method: 'notify_klippy_shutdown', params: [] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('server/setKlippyShutdown', null, { root: true })
    })

    it('onMessage routes files, power, history and service notifications', () => {
        const c = ctx()
        actions.onMessage(c as never, { method: 'notify_filelist_changed', params: [{ root: 'gcodes' }] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('files/filelist_changed', { root: 'gcodes' }, { root: true })

        actions.onMessage(c as never, { method: 'notify_metadata_update', params: [{ filename: 'a.gcode' }] } as never)
        expect(c.commit).toHaveBeenCalledWith('files/setMetadata', { filename: 'a.gcode' }, { root: true })

        actions.onMessage(c as never, { method: 'notify_power_changed', params: [{ printer: 'on' }] } as never)
        expect(c.commit).toHaveBeenCalledWith('server/power/setStatus', { printer: 'on' }, { root: true })

        actions.onMessage(c as never, { method: 'notify_history_changed', params: [{ action: 'added' }] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('server/history/getChanged', { action: 'added' }, { root: true })

        actions.onMessage(c as never, { method: 'notify_service_state_changed', params: [{ klipper: {} }] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('server/serviceStateChanged', { klipper: {} }, { root: true })
    })

    it('onMessage routes timelapse, jobQueue, webcams and sensor notifications', () => {
        const c = ctx()
        actions.onMessage(c as never, { method: 'notify_timelapse_event', params: [{ event: 'frame' }] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('server/timelapse/getEvent', { event: 'frame' }, { root: true })

        actions.onMessage(c as never, { method: 'notify_job_queue_changed', params: [{ action: 'changed' }] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('server/jobQueue/getEvent', { action: 'changed' }, { root: true })

        actions.onMessage(c as never, { method: 'notify_webcams_changed', params: [{}] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('gui/webcams/initStore', {}, { root: true })

        actions.onMessage(c as never, { method: 'notify_sensor_update', params: [{ sensor: 1 }] } as never)
        expect(c.dispatch).toHaveBeenCalledWith('server/sensor/updateSensors', { sensor: 1 }, { root: true })
    })

    it('onMessage debugs unknown methods', () => {
        const debug = vi.spyOn(window.console, 'debug').mockImplementation(() => {})
        const c = ctx()
        const payload = { method: 'notify_unknown', params: [] }
        actions.onMessage(c as never, payload as never)
        expect(debug).toHaveBeenCalledWith(payload)
        expect(c.dispatch).not.toHaveBeenCalled()
        expect(c.commit).not.toHaveBeenCalled()
    })

    it('loading and init module actions commit through', () => {
        const c = ctx()
        actions.addLoading(c as never, 'sendGcode' as never)
        expect(c.commit).toHaveBeenCalledWith('addLoading', 'sendGcode')
        actions.removeLoading(c as never, 'sendGcode' as never)
        expect(c.commit).toHaveBeenCalledWith('removeLoading', 'sendGcode')
        actions.clearLoadings(c as never)
        expect(c.commit).toHaveBeenCalledWith('clearLoadings')
        actions.addInitModule(c as never, 'server/history' as never)
        expect(c.commit).toHaveBeenCalledWith('addInitModule', 'server/history')
        actions.removeInitModule(c as never, 'server/history' as never)
        expect(c.commit).toHaveBeenCalledWith('removeInitModule', 'server/history')
        actions.removeInitComponent(c as never, 'server/spoolman' as never)
        expect(c.commit).toHaveBeenCalledWith('removeInitComponent', 'server/spoolman')
    })

    it('reportDebug logs the payload', () => {
        const log = vi.spyOn(window.console, 'log').mockImplementation(() => {})
        actions.reportDebug({} as never, { debug: true } as never)
        expect(log).toHaveBeenCalledWith({ debug: true })
    })

    it('setConnectionFailed commits disconnected with the message', () => {
        const c = ctx()
        actions.setConnectionFailed(c as never, 'refused' as never)
        expect(c.commit).toHaveBeenCalledWith('setDisconnected', 'refused')
    })
})
