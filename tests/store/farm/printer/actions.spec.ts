import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { actions } from '@/store/farm/printer/actions'
import { getDefaultState } from '@/store/farm/printer/index'

class MockWebSocket {
    static OPEN = 1
    static instances: MockWebSocket[] = []
    url: string
    readyState = 1
    sent: string[] = []
    onopen: (() => void) | null = null
    onclose: ((e: { wasClean: boolean }) => void) | null = null
    onerror: (() => void) | null = null
    onmessage: ((msg: { data: string }) => void) | null = null
    close = vi.fn()

    constructor(url: string) {
        this.url = url
        MockWebSocket.instances.push(this)
    }

    send(data: string) {
        this.sent.push(data)
    }
}

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: getDefaultState(),
        rootState: {},
        rootGetters: { 'farm/existsPrinter': () => true },
        getters: { getSocketUrl: 'ws://localhost:7125/websocket' },
        ...overrides,
    }
}

describe('farm/printer/actions', () => {
    beforeEach(() => {
        MockWebSocket.instances = []
        vi.stubGlobal('WebSocket', MockWebSocket)
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('connect opens a socket and requests server info on open', () => {
        const c = ctx()
        actions.connect(c as never)
        expect(c.commit).toHaveBeenCalledWith('setSocketData', { isConnecting: true })
        expect(MockWebSocket.instances).toHaveLength(1)
        const socket = MockWebSocket.instances[0]
        socket.onopen?.()
        expect(c.commit).toHaveBeenCalledWith(
            'setSocketData',
            expect.objectContaining({ reconnects: 0, isConnecting: false, isConnected: true })
        )
        expect(c.dispatch).toHaveBeenCalledWith('sendObj', { method: 'server.info', action: 'getServerInfo' })
    })

    it('connect schedules a reconnect on unclean close', () => {
        const c = ctx()
        actions.connect(c as never)
        const socket = MockWebSocket.instances[0]
        socket.onclose?.({ wasClean: false })
        expect(c.commit).toHaveBeenCalledWith('setSocketData', { reconnects: 1 })
        vi.runAllTimers()
        expect(c.dispatch).toHaveBeenCalledWith('connect')
    })

    it('connect marks disconnected when reconnects are exhausted or clean', () => {
        const exhausted = ctx({
            state: { ...getDefaultState(), socket: { ...getDefaultState().socket, reconnects: 2 } },
        })
        actions.connect(exhausted as never)
        MockWebSocket.instances[0].onclose?.({ wasClean: false })
        expect(exhausted.commit).toHaveBeenCalledWith(
            'setSocketData',
            expect.objectContaining({ isConnected: false, isConnecting: false })
        )

        MockWebSocket.instances = []
        const clean = ctx()
        actions.connect(clean as never)
        MockWebSocket.instances[0].onclose?.({ wasClean: true })
        expect(clean.commit).toHaveBeenCalledWith('setSocketData', expect.objectContaining({ isConnected: false }))
    })

    it('connect ignores close for removed printers', () => {
        const c = ctx({ rootGetters: { 'farm/existsPrinter': () => false } })
        actions.connect(c as never)
        MockWebSocket.instances[0].onclose?.({ wasClean: false })
        expect(c.commit).toHaveBeenCalledTimes(1)
    })

    it('connect logs socket errors', () => {
        const c = ctx()
        const err = vi.spyOn(window.console, 'error').mockImplementation(() => {})
        actions.connect(c as never)
        MockWebSocket.instances[0].onerror?.()
        expect(err).toHaveBeenCalled()
        err.mockRestore()
    })

    it('onmessage dispatches notify methods', () => {
        const c = ctx()
        actions.connect(c as never)
        const socket = MockWebSocket.instances[0]
        socket.onmessage?.({ data: JSON.stringify({ method: 'notify_status_update', params: [{ a: 1 }] }) })
        expect(c.dispatch).toHaveBeenCalledWith('getData', { a: 1 })
        socket.onmessage?.({ data: JSON.stringify({ method: 'notify_klippy_disconnected' }) })
        expect(c.dispatch).toHaveBeenCalledWith('disconnectKlippy')
        socket.onmessage?.({ data: JSON.stringify({ method: 'notify_klippy_ready' }) })
        expect(c.dispatch).toHaveBeenCalledWith('connectKlippy')
        socket.onmessage?.({ data: JSON.stringify({ method: 'unknown' }) })
    })

    it('onmessage resolves result actions and removes ws data', () => {
        const c = ctx({
            state: {
                ...getDefaultState(),
                socket: {
                    ...getDefaultState().socket,
                    wsData: [{ id: 7, action: 'getData', params: { p: 1 }, actionPreload: { pre: 1 } }],
                },
            },
        })
        actions.connect(c as never)
        const socket = MockWebSocket.instances[0]
        socket.onmessage?.({ data: JSON.stringify({ id: 7, result: 'ok' }) })
        expect(c.dispatch).toHaveBeenCalledWith(
            'getData',
            expect.objectContaining({ result: 'ok', pre: 1, requestParams: { p: 1 } })
        )
        expect(c.commit).toHaveBeenCalledWith('removeWsData', 0)
    })

    it('onmessage handles string results and empty actions', () => {
        const c = ctx({
            state: {
                ...getDefaultState(),
                socket: {
                    ...getDefaultState().socket,
                    wsData: [
                        { id: 1, action: '', params: {} },
                        { id: 2, params: {} },
                    ],
                },
            },
        })
        actions.connect(c as never)
        const socket = MockWebSocket.instances[0]
        socket.onmessage?.({ data: JSON.stringify({ id: 1, result: 'done' }) })
        socket.onmessage?.({ data: JSON.stringify({ id: 2, result: { a: 1 } }) })
        socket.onmessage?.({ data: JSON.stringify({ id: 99, result: { a: 1 } }) })
        expect(c.dispatch).not.toHaveBeenCalled()
        expect(c.commit).toHaveBeenCalledWith('removeWsData', 0)
    })

    it('reconnect closes the instance and reconnects', () => {
        const close = vi.fn()
        const c = ctx({
            state: { ...getDefaultState(), socket: { ...getDefaultState().socket, instance: { close } as never } },
        })
        actions.reconnect(c as never)
        expect(close).toHaveBeenCalled()
        expect(c.dispatch).toHaveBeenCalledWith('connect')
        const empty = ctx()
        actions.reconnect(empty as never)
        expect(empty.dispatch).toHaveBeenCalledWith('connect')
    })

    it('sendObj sends when the socket is open', () => {
        const send = vi.fn()
        const c = ctx({
            state: {
                ...getDefaultState(),
                socket: { ...getDefaultState().socket, instance: { readyState: 1, send } as never },
            },
        })
        actions.sendObj(c as never, { method: 'server.info', action: 'getServerInfo' })
        expect(c.commit).toHaveBeenCalledWith(
            'addWsData',
            expect.objectContaining({ action: 'getServerInfo', params: {} })
        )
        expect(send).toHaveBeenCalled()
    })

    it('sendObj skips when the socket is not open', () => {
        const c = ctx()
        actions.sendObj(c as never, { method: 'server.info' })
        expect(c.commit).not.toHaveBeenCalled()
    })

    it('klippy connect/disconnect and server info', () => {
        const c = ctx()
        actions.connectKlippy(c as never)
        expect(c.commit).toHaveBeenCalledWith('setKlippyConnected', true)
        expect(c.dispatch).toHaveBeenCalledWith('initPrinter')
        actions.disconnectKlippy(c as never)
        expect(c.commit).toHaveBeenCalledWith('setKlippyConnected', false)
        actions.getServerInfo(c as never, { klippy_connected: true })
        expect(c.commit).toHaveBeenCalledWith('setKlippyConnected', true)
    })

    it('initPrinter subscribes based on klippy state', () => {
        const on = ctx({ state: { ...getDefaultState(), server: { klippy_connected: true } } })
        actions.initPrinter(on as never)
        expect(on.commit).toHaveBeenCalledWith('resetData')
        expect(on.dispatch).toHaveBeenCalledWith('sendObj', expect.objectContaining({ method: 'printer.objects.list' }))
        const off = ctx()
        actions.initPrinter(off as never)
        expect(off.dispatch).not.toHaveBeenCalledWith(
            'sendObj',
            expect.objectContaining({ method: 'printer.objects.list' })
        )
        expect(off.dispatch).toHaveBeenCalledWith('sendObj', expect.objectContaining({ method: 'server.files.list' }))
    })

    it('getObjectsList subscribes to allowed and extruder objects', () => {
        const c = ctx()
        actions.getObjectsList(c as never, { objects: ['extruder', 'heater_bed', 'menu foo', 'extruder1 temp'] })
        expect(c.dispatch).toHaveBeenCalledWith(
            'sendObj',
            expect.objectContaining({ method: 'printer.objects.subscribe' })
        )
        const empty = ctx()
        actions.getObjectsList(empty as never, { objects: ['menu foo'] })
        expect(empty.dispatch).not.toHaveBeenCalled()
        actions.getObjectsList(empty as never, {})
        expect(empty.dispatch).not.toHaveBeenCalled()
    })

    it('getData commits and fetches metadata when printing', () => {
        const c = ctx()
        actions.getData(c as never, { status: { print_stats: { filename: 'a.gcode' } } })
        expect(c.commit).toHaveBeenCalledWith('setData', expect.objectContaining({ print_stats: expect.anything() }))
        expect(c.dispatch).toHaveBeenCalledWith('sendObj', expect.objectContaining({ method: 'server.files.metadata' }))
        const idle = ctx()
        actions.getData(idle as never, { print_stats: { filename: '' } })
        expect(idle.dispatch).not.toHaveBeenCalled()
    })

    it('setSettings commits and syncs remote printers', () => {
        const c = ctx({ state: { ...getDefaultState(), _namespace: 'p1', settings: { a: 1 } } })
        actions.setSettings(c as never, { b: 2 })
        expect(c.commit).toHaveBeenCalledWith('setSettings', { b: 2 })
        expect(c.dispatch).toHaveBeenCalledWith(
            'gui/remoteprinters/updateSettings',
            { id: 'p1', values: { a: 1 } },
            { root: true }
        )
    })

    it('metadata, config, mainsail and webcam getters commit through', () => {
        const c = ctx()
        actions.getMetadataCurrentFile(c as never, { filename: 'a.gcode' })
        expect(c.commit).toHaveBeenCalledWith('setCurrentFile', { filename: 'a.gcode' })
        actions.getConfigDir(c as never, { '0': { path: 'x' } })
        expect(c.commit).toHaveBeenCalledWith('setConfigDir', { '0': { path: 'x' } })
        actions.getMainsailData(c as never, { value: { a: 1 } })
        expect(c.commit).toHaveBeenCalledWith('setMainsailData', { a: 1 })
        actions.getWebcamsData(c as never, { webcams: [] })
        expect(c.commit).toHaveBeenCalledWith('setWebcamsData', [])
    })

    it('getDatabases commits and inits mainsail data and webcams', () => {
        const c = ctx()
        actions.getDatabases(c as never, { namespaces: ['mainsail', 'other'] })
        expect(c.commit).toHaveBeenCalledWith('setDatabases', ['mainsail', 'other'])
        expect(c.dispatch).toHaveBeenCalledWith(
            'sendObj',
            expect.objectContaining({ method: 'server.database.get_item' })
        )
        expect(c.dispatch).toHaveBeenCalledWith('sendObj', expect.objectContaining({ method: 'server.webcams.list' }))

        const plain = ctx()
        actions.getDatabases(plain as never, { namespaces: ['other'] })
        expect(plain.dispatch).toHaveBeenCalledTimes(1)
    })
})
