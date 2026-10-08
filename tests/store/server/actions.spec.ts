import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
    emitAndWait: vi.fn(),
    toastError: vi.fn(),
    routePath: '/console',
}))

vi.mock('@/plugins/helpers', () => ({
    formatConsoleMessage: (message: string) => message,
    camelize: (str: string) => str,
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

vi.mock('@/plugins/router', () => ({
    default: {
        get currentRoute() {
            return { value: { path: mocks.routePath } }
        },
    },
}))

import { actions } from '@/store/server/actions'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: {},
        rootState: {},
        rootGetters: {},
        ...overrides,
    }
}

describe('server/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
        mocks.routePath = '/console'
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('reset stops intervals, resets and resets power', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.dispatch).toHaveBeenCalledWith('stopKlippyConnectedInterval')
        expect(c.dispatch).toHaveBeenCalledWith('stopKlippyStateInterval')
        expect(c.commit).toHaveBeenCalledWith('reset')
        expect(c.dispatch).toHaveBeenCalledWith('power/reset')
    })

    it('init identifies the client and subscribes to init modules', async () => {
        const c = ctx({ rootState: { packageVersion: '0.10.7' } })
        mocks.emitAndWait.mockResolvedValue({ connection_id: 'abc' })
        await actions.init(c as never)
        expect(mocks.emitAndWait).toHaveBeenCalledWith(
            'server.connection.identify',
            expect.objectContaining({ client_name: 'mainsail' })
        )
        expect(c.commit).toHaveBeenCalledWith('setConnectionId', 'abc')
        expect(mocks.emit).toHaveBeenCalledWith('server.info', {}, { action: 'server/initServerInfo' })
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server', { root: true })
    })

    it('init returns early when identification fails', async () => {
        const c = ctx({ rootState: {} })
        mocks.emitAndWait.mockRejectedValue(new Error('nope'))
        await actions.init(c as never)
        expect(mocks.emit).not.toHaveBeenCalled()
    })

    it('checkDatabases inits gui db or live depending on namespaces', () => {
        const c = ctx()
        actions.checkDatabases(c as never, { namespaces: ['mainsail', 'maintenance'] })
        expect(c.dispatch).toHaveBeenCalledWith('gui/init', null, { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('gui/maintenance/init', null, { root: true })
        expect(c.commit).toHaveBeenCalledWith('saveDbNamespaces', ['mainsail', 'maintenance'])
    })

    it('initServerInfo strips plugins, inits components and root dirs', () => {
        const c = ctx()
        actions.initServerInfo(c as never, {
            plugins: {},
            components: ['history', 'unknown_thing'],
            registered_directories: ['gcodes'],
        })
        expect(c.dispatch).toHaveBeenCalledWith('server/history/init', {}, { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('files/initRootDirs', ['gcodes'], { root: true })
        expect(c.commit).toHaveBeenCalledWith('setData', expect.not.objectContaining({ plugins: expect.anything() }))
    })

    it('initServerConfig / initSystemInfo / initProcStats commit through', () => {
        const c = ctx()
        actions.initServerConfig(c as never, { config: {} } as never)
        expect(c.commit).toHaveBeenCalledWith('setConfig', { config: {} })
        actions.initSystemInfo(c as never, { system_info: { cpu: 1 } } as never)
        expect(c.commit).toHaveBeenCalledWith('setSystemInfo', { cpu: 1 })
        actions.initProcStats(c as never, { throttled_state: { bits: 1 }, system_uptime: 60 })
        expect(c.commit).toHaveBeenCalledWith('setThrottledState', { bits: 1 })
        expect(c.commit).toHaveBeenCalledWith('setSystemBootAt', expect.any(Date))
    })

    it('updateProcStats commits each present stat', () => {
        const c = ctx()
        actions.updateProcStats(c as never, { cpu_temp: 50, network: { eth0: {} } } as never)
        expect(c.commit).toHaveBeenCalledWith('setCpuTemp', 50)
        expect(c.commit).toHaveBeenCalledWith('setNetworkStats', { eth0: {} })
        expect(c.commit).not.toHaveBeenCalledWith('setMoonrakerStats', expect.anything())
    })

    it('klippy transitions drive intervals and printer init', () => {
        const c = ctx()
        actions.setKlippyReady(c as never)
        expect(c.dispatch).toHaveBeenCalledWith('printer/reset', null, { root: true })
        actions.setKlippyDisconnected(c as never)
        expect(c.commit).toHaveBeenCalledWith('setKlippyDisconnected', null)
        actions.setKlippyShutdown(c as never)
        expect(c.commit).toHaveBeenCalledWith('setKlippyShutdown', null)
    })

    it('klippy interval start is idempotent, stop clears', () => {
        const c = ctx({ state: { klippy_connected_timer: null } })
        actions.startKlippyConnectedInterval(c as never)
        expect(c.commit).toHaveBeenCalledWith('setKlippyConnectedTimer', expect.anything())
        const withTimer = ctx({ state: { klippy_connected_timer: 7 } })
        actions.startKlippyConnectedInterval(withTimer as never)
        expect(withTimer.commit).not.toHaveBeenCalled()
        actions.stopKlippyConnectedInterval(withTimer as never)
        expect(withTimer.commit).toHaveBeenCalledWith('setKlippyConnectedTimer', null)
        actions.stopKlippyConnectedInterval(c as never)
        expect(c.commit).toHaveBeenCalledTimes(1)
    })

    it('checkKlippyConnected starts polling when disconnected', () => {
        const c = ctx()
        actions.checkKlippyConnected(c as never, { klippy_connected: false, klippy_state: '' })
        expect(c.dispatch).toHaveBeenCalledWith('startKlippyConnectedInterval')
        actions.checkKlippyConnected(c as never, { klippy_connected: true, klippy_state: 'ready' })
        expect(c.commit).toHaveBeenCalledWith('setKlippyConnected')
        expect(c.dispatch).toHaveBeenCalledWith('printer/initGcodes', null, { root: true })
    })

    it('checkKlippyState polls until ready, then inits the printer', () => {
        const c = ctx()
        actions.checkKlippyState(c as never, { state: 'startup', state_message: null })
        expect(c.dispatch).toHaveBeenCalledWith('startKlippyStateInterval')
        actions.checkKlippyState(c as never, { state: 'ready', state_message: null })
        expect(c.dispatch).toHaveBeenCalledWith('printer/init', null, { root: true })
    })

    it('getGcodeStore filters events and respects the cleared-since cutoff', () => {
        const c = ctx({
            rootGetters: {
                'gui/console/getConsolefilterRules': ['secret'],
                'gui/console/getConsoleClearedSince': Date.now() + 100000,
            },
        })
        actions.getGcodeStore(c as never, {
            gcode_store: [
                { time: 1, type: 'response', message: 'old' },
                { time: Date.now() / 1000 + 200, type: 'response', message: 'new' },
                { time: Date.now() / 1000 + 200, type: 'response', message: 'secret data' },
            ],
        })
        const stored = c.commit.mock.calls.find(([name]) => name === 'setGcodeStore')?.[1] as { message: string }[]
        expect(stored.map((e) => e.message)).toEqual(['new'])
    })

    it('addEvent commits and toasts errors off-console', () => {
        const c = ctx({ rootGetters: { 'gui/console/getConsolefilterRules': [] } })
        actions.addEvent(c as never, { type: 'command', message: 'G28' })
        expect(c.commit).toHaveBeenCalledWith('addEvent', expect.objectContaining({ message: 'G28', type: 'command' }))
        expect(mocks.toastError).not.toHaveBeenCalled()
    })

    it('addEvent drops filtered messages', () => {
        const c = ctx({ rootGetters: { 'gui/console/getConsolefilterRules': ['G28'] } })
        actions.addEvent(c as never, { type: 'command', message: 'G28' })
        expect(c.commit).not.toHaveBeenCalled()
    })

    it('addRootDirectory commits only unknown roots', () => {
        const c = ctx({ state: { registered_directories: ['gcodes'] } })
        actions.addRootDirectory(c as never, { item: { root: 'gcodes' } })
        expect(c.commit).not.toHaveBeenCalled()
        actions.addRootDirectory(c as never, { item: { root: 'config' } })
        expect(c.commit).toHaveBeenCalledWith('addRootDirectory', { name: 'config' })
    })

    it('serviceStateChanged and addFailedInitComponent commit through', () => {
        const c = ctx()
        actions.serviceStateChanged(c as never, { klipper: {} } as never)
        expect(c.commit).toHaveBeenCalledWith('updateServiceState', { klipper: {} })
        actions.addFailedInitComponent(c as never, 'spoolman')
        expect(c.commit).toHaveBeenCalledWith('removeComponent', 'spoolman')
        expect(c.commit).toHaveBeenCalledWith('addFailedInitComponent', 'spoolman')
    })

    it('init dispatches socket failure on Unauthorized', async () => {
        const c = ctx({ rootState: {} })
        const storeDispatch = vi.fn()
        mocks.emitAndWait.mockRejectedValue(new Error('Unauthorized'))
        await actions.init.call({ dispatch: storeDispatch } as never, c as never)
        expect(storeDispatch).toHaveBeenCalledWith('socket/setConnectionFailed', 'Unauthorized')
        expect(c.commit).not.toHaveBeenCalled()
    })

    it('init registers init modules on success', async () => {
        const c = ctx({ rootState: { packageVersion: '1.0' } })
        mocks.emitAndWait.mockResolvedValue({ connection_id: 'x' })
        await actions.init(c as never)
        expect(c.dispatch).toHaveBeenCalledWith('socket/addInitModule', 'server/info', { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('socket/addInitModule', 'server/databaseList', { root: true })
    })

    it('checkDatabases falls back to db init without namespaces', () => {
        const c = ctx()
        actions.checkDatabases(c as never, { namespaces: [] })
        expect(c.dispatch).toHaveBeenCalledWith('gui/initDb', null, { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('gui/maintenance/initDb', null, { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('gui/webcams/init', null, { root: true })
    })

    it('checkDatabases handles missing namespaces', () => {
        const c = ctx()
        actions.checkDatabases(c as never, {})
        expect(c.dispatch).toHaveBeenCalledWith('gui/initDb', null, { root: true })
    })

    it('initServerInfo strips failed plugins and skips unknown components', () => {
        const c = ctx()
        actions.initServerInfo(c as never, {
            plugins: { a: 1 },
            failed_plugins: { b: 2 },
            components: ['unknown_thing'],
            registered_directories: [],
        })
        expect(c.dispatch).not.toHaveBeenCalledWith('server/history/init', expect.anything(), expect.anything())
        expect(c.commit).toHaveBeenCalledWith('setData', expect.not.objectContaining({ plugins: expect.anything() }))
    })

    it('initServerInfo handles empty payload', () => {
        const c = ctx()
        actions.initServerInfo(c as never, {})
        expect(c.commit).toHaveBeenCalledWith('setData', {})
    })

    it('initProcStats skips null throttled state and missing uptime', () => {
        const c = ctx()
        actions.initProcStats(c as never, { throttled_state: null, system_uptime: 0 })
        expect(c.commit).not.toHaveBeenCalledWith('setThrottledState', expect.anything())
        expect(c.commit).not.toHaveBeenCalledWith('setSystemBootAt', expect.anything())
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/procStats', { root: true })
    })

    it('updateProcStats commits moonraker and cpu stats', () => {
        const c = ctx()
        actions.updateProcStats(
            c as never,
            {
                moonraker_stats: { time: 1 },
                system_cpu_usage: { cpu: 5 },
            } as never
        )
        expect(c.commit).toHaveBeenCalledWith('setMoonrakerStats', { time: 1 })
        expect(c.commit).toHaveBeenCalledWith('setCpuStats', { cpu: 5 })
    })

    it('klippy state interval start is idempotent, stop clears', () => {
        const c = ctx({ state: { klippy_state_timer: null } })
        actions.startKlippyStateInterval(c as never)
        expect(c.commit).toHaveBeenCalledWith('setKlippyStateTimer', expect.anything())
        const withTimer = ctx({ state: { klippy_state_timer: 7 } })
        actions.startKlippyStateInterval(withTimer as never)
        expect(withTimer.commit).not.toHaveBeenCalled()
        actions.stopKlippyStateInterval(withTimer as never)
        expect(withTimer.commit).toHaveBeenCalledWith('setKlippyStateTimer', null)
        actions.stopKlippyStateInterval(c as never)
        expect(c.commit).toHaveBeenCalledTimes(1)
    })

    it('checkKlippyState commits state and message', () => {
        const c = ctx()
        actions.checkKlippyState(c as never, { state: 'ready', state_message: 'ok' })
        expect(c.commit).toHaveBeenCalledWith('setKlippyState', 'ready')
        expect(c.commit).toHaveBeenCalledWith('setKlippyMessage', 'ok')
        expect(c.dispatch).toHaveBeenCalledWith('printer/init', null, { root: true })
    })

    it('getData commits through', () => {
        const c = ctx()
        actions.getData(c as never, { moonraker_version: 'v1' })
        expect(c.commit).toHaveBeenCalledWith('setData', { moonraker_version: 'v1' })
    })

    it('getGcodeStore tolerates invalid filter regex', () => {
        const c = ctx({
            rootGetters: {
                'gui/console/getConsolefilterRules': ['[invalid'],
                'gui/console/getConsoleClearedSince': 0,
            },
        })
        actions.getGcodeStore(c as never, {
            gcode_store: [{ time: 1, type: 'response', message: 'hello' }],
        })
        expect(c.commit).toHaveBeenCalledWith('setGcodeStore', expect.any(Array))
    })

    it('getGcodeStore filters by date field', () => {
        const since = Date.now()
        const c = ctx({
            rootGetters: {
                'gui/console/getConsolefilterRules': [],
                'gui/console/getConsoleClearedSince': since,
            },
        })
        actions.getGcodeStore(c as never, {
            gcode_store: [
                { time: 1, type: 'response', message: 'old', date: new Date(since - 10000).toISOString() },
                { time: since / 1000 + 10, type: 'response', message: 'new' },
            ],
        })
        const stored = c.commit.mock.calls.find(([name]) => name === 'setGcodeStore')?.[1] as { message: string }[]
        expect(stored.map((e) => e.message)).toEqual(['new'])
    })

    it('addEvent maps result and error payloads', () => {
        const c = ctx({ rootGetters: { 'gui/console/getConsolefilterRules': [] } })
        actions.addEvent(c as never, { result: 'done' })
        expect(c.commit).toHaveBeenCalledWith('addEvent', expect.objectContaining({ message: 'done' }))
        const e2 = ctx({ rootGetters: { 'gui/console/getConsolefilterRules': [] } })
        actions.addEvent(e2 as never, { error: { message: 'fail' } })
        expect(e2.commit).toHaveBeenCalledWith('addEvent', expect.objectContaining({ message: 'fail' }))
    })

    it('addEvent maps action and debug prefixes', () => {
        const c = ctx({ rootGetters: { 'gui/console/getConsolefilterRules': [] } })
        actions.addEvent(c as never, { type: 'response', message: '// action:pause' })
        expect(c.commit).toHaveBeenCalledWith('addEvent', expect.objectContaining({ type: 'action' }))
        const d = ctx({ rootGetters: { 'gui/console/getConsolefilterRules': [] } })
        actions.addEvent(d as never, { type: 'response', message: '// debug:info' })
        expect(d.commit).toHaveBeenCalledWith('addEvent', expect.objectContaining({ type: 'debug' }))
    })

    it('addEvent formats command messages', () => {
        const c = ctx({ rootGetters: { 'gui/console/getConsolefilterRules': [] } })
        actions.addEvent(c as never, { type: 'command', message: 'G28' })
        const payload = c.commit.mock.calls.find(([name]) => name === 'addEvent')?.[1] as {
            formatMessage: string
        }
        expect(payload.formatMessage).toContain('command text--blue')
    })

    it('addEvent tolerates invalid filter regex', () => {
        const c = ctx({ rootGetters: { 'gui/console/getConsolefilterRules': ['[invalid'] } })
        actions.addEvent(c as never, { type: 'response', message: 'hello' })
        expect(c.commit).toHaveBeenCalled()
    })

    it('addEvent toasts errors when off-console', () => {
        mocks.routePath = '/dashboard'
        const c = ctx({ rootGetters: { 'gui/console/getConsolefilterRules': [] } })
        actions.addEvent(c as never, { type: 'error', message: '!! heater fault' })
        expect(mocks.toastError).toHaveBeenCalled()
    })

    it('addEvent skips toast on the console route', () => {
        const c = ctx({ rootGetters: { 'gui/console/getConsolefilterRules': [] } })
        actions.addEvent(c as never, { type: 'response', message: '!! heater fault' })
        expect(mocks.toastError).not.toHaveBeenCalled()
    })
})
