import { describe, expect, it, vi } from 'vitest'
import { mutations } from '@/store/server/mutations'

// Isolate from @/plugins/router (imported by ./index.ts via actions.ts;
// the real router pulls every page and component into coverage).
vi.mock('@/plugins/router', () => ({
    default: { currentRoute: { value: { path: '/' } } },
}))

// Isolate from @/plugins/helpers (pulls the @mdi/js icon bundle into
// coverage as import-time statements); the real formatConsoleMessage is
// covered by tests/helpers.spec.ts.
vi.mock('@/plugins/helpers', () => ({
    formatConsoleMessage: (message: string) => message,
}))
import { getDefaultState } from '@/store/server/index'
import type { ServerState } from '@/store/server/types'

function state(overrides = {}): ServerState {
    return { ...getDefaultState(), ...overrides }
}

describe('server/mutations', () => {
    it('reset restores defaults', () => {
        const s = state({ klippy_connected: true, klippy_state: 'ready' })
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('klippy connection transitions', () => {
        const s = state()
        mutations.setKlippyConnected(s)
        expect(s.klippy_connected).toBe(true)
        mutations.setKlippyState(s, 'ready')
        expect(s.klippy_state).toBe('ready')
        mutations.setKlippyMessage(s, 'Printer is ready')
        expect(s.klippy_message).toBe('Printer is ready')
        mutations.setKlippyShutdown(s)
        expect(s.klippy_state).toBe('shutdown')
        mutations.setKlippyDisconnected(s)
        expect(s.klippy_connected).toBe(false)
        expect(s.klippy_state).toBe('disconnected')
    })

    it('setData assigns and strips requestParams', () => {
        const s = state()
        mutations.setData(s, { klippy_state: 'ready', requestParams: { id: 1 } })
        expect(s.klippy_state).toBe('ready')
        expect('requestParams' in s).toBe(false)
    })

    it('setGcodeStore formats messages and maps response types', () => {
        const s = state()
        mutations.setGcodeStore(s, [
            { time: 1000, type: 'command', message: 'G28' },
            { time: 1001, type: 'response', message: '// action:pause' },
            { time: 1002, type: 'response', message: '// debug:info' },
            { time: 1003, type: 'response', message: 'ok' },
        ])
        expect(s.events).toHaveLength(4)
        expect(s.events[0].type).toBe('command')
        expect(s.events[0].formatMessage).toContain('command text--blue')
        expect(s.events[1].type).toBe('action')
        expect(s.events[2].type).toBe('debug')
        expect(s.events[3].type).toBe('response')
        expect(s.events[0].date).toEqual(new Date(1000 * 1000))
    })

    it('setGcodeStore caps history at maxEventHistory', () => {
        const s = state()
        const payload = Array.from({ length: 505 }, (_, i) => ({ time: i, type: 'response', message: `m${i}` }))
        mutations.setGcodeStore(s, payload)
        expect(s.events).toHaveLength(500)
        expect(s.events[0].message).toBe('m5')
    })

    it('addEvent replaces a trailing autocomplete and trims', () => {
        const s = state()
        const d = new Date()
        mutations.addEvent(s, { date: d, message: 'G2', formatMessage: 'G2', type: 'autocomplete' })
        mutations.addEvent(s, { date: d, message: 'G28', formatMessage: 'G28', type: 'command' })
        expect(s.events).toHaveLength(1)
        expect(s.events[0].message).toBe('G28')
    })

    it('clearGcodeStore and console session flag', () => {
        const s = state()
        const d = new Date()
        mutations.addEvent(s, { date: d, message: 'x', formatMessage: 'x', type: 'response' })
        mutations.clearGcodeStore(s)
        expect(s.events).toEqual([])
        mutations.setConsoleClearedThisSession(s)
        expect(s.console_cleared_this_session).toBe(true)
    })

    it('component and directory bookkeeping', () => {
        const s = state({ components: ['history', 'power'], failed_init_components: [] })
        mutations.removeComponent(s, 'power')
        expect(s.components).toEqual(['history'])
        mutations.removeComponent(s, 'missing')
        expect(s.components).toEqual(['history'])
        mutations.addFailedInitComponent(s, 'spoolman')
        mutations.addFailedInitComponent(s, 'spoolman')
        expect(s.failed_init_components).toEqual(['spoolman'])
        mutations.addRootDirectory(s, { name: 'gcodes' })
        expect(s.registered_directories).toContain('gcodes')
    })

    it('setThrottledState merges bits and flags', () => {
        const s = state()
        mutations.setThrottledState(s, { bits: 3, flags: ['undervoltage'] } as never)
        expect(s.throttled_state.bits).toBe(3)
        expect(s.throttled_state.flags).toEqual(['undervoltage'])
        mutations.setThrottledState(s, null)
    })

    it('service state updates only when system_info exists', () => {
        const s = state()
        mutations.updateServiceState(s, { klipper: { active_state: 'active' } } as never)
        const withInfo = state({ system_info: { service_state: {} } } as never)
        mutations.updateServiceState(withInfo, { klipper: { active_state: 'active' } } as never)
        expect(withInfo.system_info?.service_state?.['klipper']).toEqual({ active_state: 'active' })
    })

    it('timer, cpu and stats setters store values', () => {
        const s = state()
        mutations.setKlippyConnectedTimer(s, 7 as never)
        expect(s.klippy_connected_timer).toBe(7 as never)
        mutations.setKlippyStateTimer(s, 9 as never)
        expect(s.klippy_state_timer).toBe(9 as never)
        mutations.setCpuTemp(s, 51.2)
        expect(s.cpu_temp).toBe(51.2)
        mutations.setMoonrakerStats(s, { time: 1 } as never)
        expect(s.moonraker_stats).toEqual({ time: 1 })
        mutations.setNetworkStats(s, { eth0: {} } as never)
        expect(s.network_stats).toEqual({ eth0: {} })
        mutations.setCpuStats(s, { cpu: 12 } as never)
        expect(s.system_cpu_usage).toEqual({ cpu: 12 })
    })

    it('setProcStats stores cpu and moonraker stats', () => {
        const s = state()
        mutations.setProcStats(s, { cpu_temp: 44, moonraker_stats: { t: 2 } } as never)
        expect(s.cpu_temp).toBe(44)
        expect(s.moonraker_stats).toEqual({ t: 2 })
    })

    it('connection, config and namespace setters', () => {
        const s = state()
        mutations.setConnectionId(s, 'conn-1')
        expect(s.connection_id).toBe('conn-1')
        mutations.setConfig(s, { config: { server: {} }, orig: {} } as never)
        expect(s.config).toEqual({ config: { server: {} }, orig: {} })
        mutations.saveDbNamespaces(s, ['mainsail'])
        expect(s.dbNamespaces).toEqual(['mainsail'])
        mutations.setData(s, { moonraker_version: 'v1' })
        expect(s.moonraker_version).toBe('v1')
    })

    it('system info and boot time setters', () => {
        const s = state()
        mutations.setSystemInfo(s, { cpu_info: { cpu_count: 4 } } as never)
        expect(s.system_info).toEqual({ cpu_info: { cpu_count: 4 } })
        const boot = new Date('2024-01-01T00:00:00Z')
        mutations.setSystemBootAt(s, boot)
        expect(s.system_boot_at).toBe(boot)
    })

    it('setThrottledState ignores payloads without bits or flags', () => {
        const s = state({ throttled_state: { bits: 1, flags: ['a'] } } as never)
        mutations.setThrottledState(s, {} as never)
        expect(s.throttled_state.bits).toBe(1)
        expect(s.throttled_state.flags).toEqual(['a'])
    })
})
