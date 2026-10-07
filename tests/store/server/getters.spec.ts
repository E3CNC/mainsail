import { describe, expect, it, vi } from 'vitest'
import { getters } from '@/store/server/getters'

// See mutations.spec.ts: isolate from the real router + @mdi/js bundle.
vi.mock('@/plugins/router', () => ({
    default: { currentRoute: { value: { path: '/' } } },
}))

vi.mock('@/plugins/helpers', () => ({
    formatConsoleMessage: (message: string) => message,
    formatFilesize: (bytes: number) => `${bytes} B`,
}))
import { getDefaultState } from '@/store/server/index'
import type { ServerState } from '@/store/server/types'
import type { RootState } from '@/store/types'

function state(overrides = {}): ServerState {
    return { ...getDefaultState(), ...overrides }
}

const d = new Date()

describe('server/getters', () => {
    it('getConsoleEvents injects help when history is short', () => {
        const events = getters.getConsoleEvents(state(), undefined as never, undefined as never, undefined as never)()
        expect(events.length).toBeGreaterThan(0)
        expect(events[events.length - 1].message).toContain('HELP')
    })

    it('getConsoleEvents returns stored events reversed by default', () => {
        const s = state({
            console_cleared_this_session: true,
            events: [
                { date: d, message: 'a', formatMessage: 'a', type: 'response' },
                { date: d, message: 'b', formatMessage: 'b', type: 'response' },
            ],
        })
        const run = getters.getConsoleEvents(s, undefined as never, undefined as never, undefined as never)
        expect(run().map((e: { message: string }) => e.message)).toEqual(['b', 'a'])
        expect(run(false).map((e: { message: string }) => e.message)).toEqual(['a', 'b'])
        expect(run(true, 1).map((e: { message: string }) => e.message)).toEqual(['b'])
    })

    it('getConfig reads nested config values', () => {
        const s = state({ config: { config: { server: { port: 7125 } }, orig: {} } } as never)
        const run = getters.getConfig(s, undefined as never, undefined as never, undefined as never)
        expect(run('server', 'port')).toBe(7125)
        expect(run('server', 'missing')).toBeNull()
        expect(run('missing', 'port')).toBeNull()
    })

    it('getCpuUsage rounds or returns null', () => {
        expect(
            getters.getCpuUsage(
                state({ system_cpu_usage: { cpu: 12.6 } } as never),
                undefined as never,
                undefined as never,
                undefined as never
            )
        ).toBe(13)
        expect(getters.getCpuUsage(state(), undefined as never, undefined as never, undefined as never)).toBeNull()
    })

    it('getNetworkInterfaces skips loopback and unknown interfaces', () => {
        const s = state({
            network_stats: { lo: {}, eth0: { rx: 1 }, can0: { rx: 2 }, unknown0: { rx: 3 } },
            system_info: { network: { eth0: { mac: 'aa' } } },
        } as never)
        const ifs = getters.getNetworkInterfaces(s, undefined as never, undefined as never, undefined as never)
        expect(Object.keys(ifs).sort()).toEqual(['can0', 'eth0'])
        expect(ifs['eth0'].details).toEqual({ mac: 'aa' })
    })

    it('getThrottledStateFlags normalizes flag names', () => {
        const s = state({ throttled_state: { bits: 0, flags: ['under-voltage detected', '?', 'frequency-capped'] } })
        expect(getters.getThrottledStateFlags(s, undefined as never, undefined as never, undefined as never)).toEqual([
            'Undervoltagedetected',
            'Frequencycapped',
        ])
    })

    it('getHostStats computes load, memory and fallback temp', () => {
        const s = state({
            cpu_temp: 55.4,
            system_info: {
                cpu_info: { processor: 'arm', cpu_desc: 'Pi', bits: '64', cpu_count: 4, total_memory: 1000 },
                python: { version_string: '3.11 x' },
                distribution: { name: 'Debian', release_info: null },
            },
        } as never)
        const rs = {
            printer: {
                software_version: 'v0.12.0-1',
                app_name: 'Klipper',
                system_stats: { sysload: 1.5, memavail: 500 },
            },
        } as unknown as RootState
        const stats = getters.getHostStats(s, {}, rs, { 'printer/getHostTempSensor': null })
        expect(stats?.load).toBe(1.5)
        expect(stats?.loadPercent).toBe(38)
        expect(stats?.loadProgressColor).toBe('primary')
        expect(stats?.memUsage).toBe(50)
        expect(stats?.tempSensor?.temperature).toBe('55')
        expect(stats?.version).toBe('Klipper v0.12.0-1')
        expect(stats?.pythonVersion).toBe('3.11 ')
    })
})
