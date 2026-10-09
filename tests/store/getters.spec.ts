import { describe, expect, it } from 'vitest'

vi.mock('@/plugins/i18n', () => ({
    default: {
        global: {
            t: (key: string, params?: Record<string, unknown>) => {
                if (!params) return key
                return `${key}|${JSON.stringify(params)}`
            },
        },
    },
}))

import { getters } from '@/store/getters'
import { minKlipperVersion, minMoonrakerVersion } from '@/store/variables'

function rootState(overrides = {}) {
    return {
        packageVersion: '1.0.0',
        debugMode: false,
        naviDrawer: null,
        instancesDB: 'moonraker',
        configInstances: [],
        ...overrides,
    } as never
}

describe('store/getters', () => {
    it('getVersion returns the package version', () => {
        expect(
            getters.getVersion(
                rootState({ packageVersion: '2.3.4' }),
                undefined as never,
                undefined as never,
                undefined as never
            )
        ).toBe('2.3.4')
    })

    it('getTitle returns E3CNC when disconnected', () => {
        const s = rootState({ socket: { isConnected: false } })
        expect(getters.getTitle(s, {}, undefined as never, undefined as never)).toBe('E3CNC')
    })

    it('getTitle returns the error title when klippy is not ready', () => {
        const s = rootState({ socket: { isConnected: true }, server: { klippy_state: 'error' } })
        expect(getters.getTitle(s, {}, undefined as never, undefined as never)).toBe('App.Titles.Error')
    })

    it('getTitle maps timelapse pause to printing', () => {
        const s = rootState({
            socket: { isConnected: true },
            server: { klippy_state: 'ready' },
            printer: {
                print_stats: { state: 'paused', filename: 'a.gcode' },
                'gcode_macro TIMELAPSE_TAKE_FRAME': { is_paused: true },
            },
            gui: { general: {} },
        })
        const moduleGetters = {
            'printer/getEstimatedTimeETAFormat': '--',
            'printer/getPrintPercent': 0.5,
        } as never
        const title = getters.getTitle(s, moduleGetters, undefined as never, undefined as never) as string
        expect(title).toContain('App.Titles.Printing')
    })

    it('getTitle returns pause', () => {
        const s = rootState({
            socket: { isConnected: true },
            server: { klippy_state: 'ready' },
            printer: { print_stats: { state: 'paused' } },
        })
        expect(getters.getTitle(s, {}, undefined as never, undefined as never)).toBe('App.Titles.Pause')
    })

    it('getTitle returns complete with and without printer name', () => {
        const withName = rootState({
            socket: { isConnected: true },
            server: { klippy_state: 'ready' },
            printer: { print_stats: { state: 'complete', filename: 'a.gcode' } },
            gui: { general: { printername: 'Voron' } },
        })
        const title = getters.getTitle(withName, {}, undefined as never, undefined as never) as string
        expect(title).toContain('App.Titles.Complete')
        expect(title).toContain('Voron')

        const withoutName = rootState({
            socket: { isConnected: true },
            server: { klippy_state: 'ready' },
            printer: { print_stats: { state: 'complete', filename: 'a.gcode' } },
            gui: { general: {} },
        })
        expect(getters.getTitle(withoutName, {}, undefined as never, undefined as never) as string).toContain(
            'App.Titles.Complete'
        )
    })

    it('getTitle returns printing with ETA', () => {
        const s = rootState({
            socket: { isConnected: true },
            server: { klippy_state: 'ready' },
            printer: { print_stats: { state: 'printing', filename: 'a.gcode' } },
            gui: { general: { printername: 'Voron' } },
        })
        const moduleGetters = {
            'printer/getEstimatedTimeETAFormat': '10m',
            'printer/getPrintPercent': 0.5,
        } as never
        const title = getters.getTitle(s, moduleGetters, undefined as never, undefined as never) as string
        expect(title).toContain('App.Titles.PrintingETA')
        expect(title).toContain('Voron')
    })

    it('getTitle returns printing without ETA and without printer name', () => {
        const s = rootState({
            socket: { isConnected: true },
            server: { klippy_state: 'ready' },
            printer: { print_stats: { state: 'printing', filename: 'a.gcode' } },
            gui: { general: {} },
        })
        const moduleGetters = {
            'printer/getEstimatedTimeETAFormat': '--',
            'printer/getPrintPercent': 0.42,
        } as never
        const title = getters.getTitle(s, moduleGetters, undefined as never, undefined as never) as string
        expect(title).toContain('App.Titles.Printing')
    })

    it('getTitle falls back to printer name, hostname or E3CNC', () => {
        const named = rootState({
            socket: { isConnected: true },
            server: { klippy_state: 'ready' },
            printer: { print_stats: { state: 'standby' }, hostname: 'h.local' },
            gui: { general: { printername: 'MyPrinter' } },
        })
        expect(getters.getTitle(named, {}, undefined as never, undefined as never)).toBe('MyPrinter')

        const hosted = rootState({
            socket: { isConnected: true },
            server: { klippy_state: 'ready' },
            printer: { print_stats: { state: 'standby' }, hostname: 'h.local' },
            gui: { general: {} },
        })
        expect(getters.getTitle(hosted, {}, undefined as never, undefined as never)).toBe('h.local')

        const bare = rootState({
            socket: { isConnected: true },
            server: { klippy_state: 'ready' },
            printer: { print_stats: { state: 'standby' } },
            gui: { general: {} },
        })
        expect(getters.getTitle(bare, {}, undefined as never, undefined as never)).toBe('E3CNC')

        const unnamed = rootState({
            socket: { isConnected: true },
            server: { klippy_state: 'ready' },
            printer: { print_stats: { state: 'standby' }, hostname: 'h.local' },
            gui: { general: { printername: '' } },
        })
        expect(getters.getTitle(unnamed, {}, undefined as never, undefined as never)).toBe('h.local')
    })

    it('getDependencies flags outdated klipper and moonraker', () => {
        const s = rootState({
            printer: { software_version: 'v0.1.0-0' },
            server: { moonraker_version: 'v0.1.0-0' },
        })
        const deps = getters.getDependencies(s, undefined as never, undefined as never, undefined as never) as {
            serviceName: string
            neededVersion: string
        }[]
        expect(deps.map((d) => d.serviceName)).toEqual(['Klipper', 'Moonraker'])
        expect(deps[0].neededVersion).toBe(minKlipperVersion)
        expect(deps[1].neededVersion).toBe(minMoonrakerVersion)
    })

    it('getDependencies flags equal release with older build', () => {
        const [release] = minKlipperVersion.split('-')
        const s = rootState({
            printer: { software_version: `${release}-0` },
            server: { moonraker_version: 'v9.9.9-9999' },
        })
        const deps = getters.getDependencies(s, undefined as never, undefined as never, undefined as never) as {
            serviceName: string
        }[]
        expect(deps.map((d) => d.serviceName)).toEqual(['Klipper'])
    })

    it('getDependencies passes current versions and invalid strings', () => {
        const s = rootState({
            printer: { software_version: 'v9.9.9-9999' },
            server: { moonraker_version: 'v9.9.9-9999' },
        })
        expect(getters.getDependencies(s, undefined as never, undefined as never, undefined as never)).toEqual([])
        const invalid = rootState({ printer: {}, server: {} })
        expect(getters.getDependencies(invalid, undefined as never, undefined as never, undefined as never)).toEqual([])
    })

    it('getDependencies keeps equal release with newer build', () => {
        const [release, build] = minMoonrakerVersion.split('-')
        const s = rootState({
            printer: { software_version: 'v9.9.9-9999' },
            server: { moonraker_version: `${release}-${parseInt(build) + 1}` },
        })
        expect(getters.getDependencies(s, undefined as never, undefined as never, undefined as never)).toEqual([])
    })
})
