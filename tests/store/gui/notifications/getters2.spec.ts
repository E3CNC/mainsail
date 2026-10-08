import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const detectMock = vi.hoisted(() => ({ browser: null as unknown }))

vi.mock('@/plugins/i18n.js', () => ({
    default: { global: { t: (key: string) => key } },
}))

vi.mock('detect-browser', () => ({
    detect: () => detectMock.browser,
}))

import { getters } from '@/store/gui/notifications/getters'
import { sha256 } from 'js-sha256'

const bootDate = new Date('2024-01-01T00:00:00Z')

function rootGettersWith(dismissByCategory: (category: string) => { id: string }[] = () => [], extra = {}) {
    return {
        'server/getThrottledStateFlags': [],
        'gui/notifications/getDismissByCategory': dismissByCategory,
        getDependencies: [],
        'gui/maintenance/getOverdueEntries': [],
        ...extra,
    }
}

describe('gui/notifications/getters (part 2)', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        detectMock.browser = null
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('getNotificationsKlipperWarnings returns empty without warnings', () => {
        const fn = getters.getNotificationsKlipperWarnings as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => unknown[]
        expect(fn({} as never, {} as never, { printer: {} } as never, rootGettersWith() as never)).toEqual([])
    })

    it('getNotificationsKlipperWarnings maps every warning type with doc urls', () => {
        const fn = getters.getNotificationsKlipperWarnings as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => { id: string; url: string }[]
        const warnings = [
            { message: 'plain', type: 'unknown_type' },
            { message: 'old opt', type: 'deprecated_option', option: 'default_parameter_x' },
            { message: 'old opt 2', type: 'deprecated_option', option: 'some_option' },
            { message: 'old val', type: 'deprecated_value', value: 'some_value' },
            { message: 'runtime', type: 'runtime_warning' },
        ]
        const result = fn(
            {} as never,
            {} as never,
            { printer: { configfile: { warnings } }, server: { system_boot_at: bootDate } } as never,
            rootGettersWith(() => []) as never
        )
        expect(result).toHaveLength(5)
        expect(result[0].id).toBe(`klipperWarning/${sha256('plain')}`)
        expect(result[0].url).toContain('unknown_type')
        expect(result.find((n) => n.url.endsWith('#default_parameter'))).toBeDefined()
        expect(result.find((n) => n.url.endsWith('#some_option'))).toBeDefined()
        expect(result.find((n) => n.url.endsWith('#some_value'))).toBeDefined()
    })

    it('getNotificationsKlipperWarnings filters dismissed warnings', () => {
        const fn = getters.getNotificationsKlipperWarnings as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => unknown[]
        const warnings = [{ message: 'gone', type: 'x' }]
        const result = fn(
            {} as never,
            {} as never,
            { printer: { configfile: { warnings } }, server: {} } as never,
            rootGettersWith(() => [{ id: sha256('gone') }]) as never
        )
        expect(result).toEqual([])
    })

    it('getNotificationsBrowserWarnings returns empty when no browser is detected', () => {
        detectMock.browser = null
        const fn = getters.getNotificationsBrowserWarnings as (s: unknown, g: unknown, r: unknown) => unknown[]
        expect(fn({} as never, {} as never, {} as never)).toEqual([])
    })

    it('getNotificationsBrowserWarnings returns empty when the browser has no requirement', () => {
        detectMock.browser = { name: 'chrome', version: '120.0.0', os: 'linux' }
        const fn = getters.getNotificationsBrowserWarnings as (s: unknown, g: unknown, r: unknown) => unknown[]
        expect(fn({} as never, {} as never, {} as never)).toEqual([])
    })

    it('getNotificationsBrowserWarnings warns on outdated browsers', () => {
        detectMock.browser = { name: 'Safari', version: '16.0.0', os: 'macOS' }
        const fn = getters.getNotificationsBrowserWarnings as (
            s: unknown,
            g: unknown,
            r: unknown
        ) => { id: string; priority: string }[]
        const result = fn({} as never, {} as never, { server: { system_boot_at: bootDate } } as never)
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('browserWarning/safari/16.5.2')
        expect(result[0].priority).toBe('critical')
    })

    it('getNotificationsBrowserWarnings stays silent on new browsers', () => {
        detectMock.browser = { name: 'safari', version: '17.0.0', os: 'macOS' }
        const fn = getters.getNotificationsBrowserWarnings as (s: unknown, g: unknown, r: unknown) => unknown[]
        expect(fn({} as never, {} as never, {} as never)).toEqual([])
    })

    it('getNotificationsBrowserWarnings stays silent on invalid versions', () => {
        detectMock.browser = { name: 'safari', version: 'not-a-version', os: 'macOS' }
        const fn = getters.getNotificationsBrowserWarnings as (s: unknown, g: unknown, r: unknown) => unknown[]
        expect(fn({} as never, {} as never, {} as never)).toEqual([])
    })

    it('getNotificationsOverdueMaintenance returns empty when nothing is overdue', () => {
        const fn = getters.getNotificationsOverdueMaintenance as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => unknown[]
        expect(
            fn(
                {} as never,
                {} as never,
                {} as never,
                rootGettersWith(() => [], { 'gui/maintenance/getOverdueEntries': [] }) as never
            )
        ).toEqual([])
    })

    it('getNotificationsOverdueMaintenance maps entries and filters dismissed ones', () => {
        const fn = getters.getNotificationsOverdueMaintenance as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => { id: string }[]
        const entries = [
            { id: 'k1', name: 'belts' },
            { id: 'k2', name: 'nozzle' },
        ]
        const result = fn(
            {} as never,
            {} as never,
            { server: { system_boot_at: bootDate } } as never,
            rootGettersWith(() => [{ id: 'k1' }], { 'gui/maintenance/getOverdueEntries': entries }) as never
        )
        expect(result.map((n) => n.id)).toEqual(['maintenance/k2'])
    })

    it('getNotificationsOverheatDrivers reports ot and otpw flags', () => {
        const fn = getters.getNotificationsOverheatDrivers as (
            s: unknown,
            g: unknown,
            r: unknown
        ) => { id: string; priority: string }[]
        const rootState = {
            server: { system_boot_at: bootDate },
            printer: {
                'tmc2209 stepper_x': { drv_status: { ot: 1, otpw: 1 } },
                'tmc2209 stepper_y': { drv_status: { ot: 0, otpw: 0 } },
                extruder: {},
            },
        }
        const result = fn({} as never, { getDismissByCategory: () => [] } as never, rootState as never)
        expect(result.map((n) => n.id).sort()).toEqual([
            'tmcwarning/tmc2209 stepper_x-ot',
            'tmcwarning/tmc2209 stepper_x-otpw',
        ])
        expect(result.find((n) => n.id.endsWith('-ot'))?.priority).toBe('critical')
        expect(result.find((n) => n.id.endsWith('-otpw'))?.priority).toBe('high')
    })

    it('getNotificationsOverheatDrivers filters dismissed warnings and tolerates missing status', () => {
        const fn = getters.getNotificationsOverheatDrivers as (s: unknown, g: unknown, r: unknown) => { id: string }[]
        const rootState = {
            server: {},
            printer: {
                tmc2209: {},
                'tmc2209 stepper_x': { drv_status: { ot: 1 } },
            },
        }
        const result = fn(
            {} as never,
            { getDismissByCategory: () => [{ id: 'tmc2209 stepper_x-ot' }] } as never,
            rootState as never
        )
        expect(result).toEqual([])
    })

    it('getDismiss keeps ever entries and filters expired reboot and time entries', () => {
        const fn = getters.getDismiss as (s: unknown, g: unknown, r: unknown) => { id: string }[]
        const state = {
            dismiss: [
                { id: 'ever', category: 'flag', type: 'ever', date: 1 },
                { id: 'reboot-new', category: 'flag', type: 'reboot', date: bootDate.getTime() + 1000 },
                { id: 'reboot-old', category: 'flag', type: 'reboot', date: bootDate.getTime() - 1000 },
                { id: 'time-new', category: 'flag', type: 'time', date: Date.now() + 60000 },
                { id: 'time-old', category: 'flag', type: 'time', date: Date.now() - 60000 },
            ],
        }
        const result = fn(state as never, {} as never, { server: { system_boot_at: bootDate } } as never)
        expect(result.map((d) => d.id).sort()).toEqual(['ever', 'reboot-new', 'time-new'])
    })

    it('getDismiss falls back to now when system_boot_at is missing', () => {
        const fn = getters.getDismiss as (s: unknown, g: unknown, r: unknown) => { id: string }[]
        const state = { dismiss: [{ id: 'ever', category: 'flag', type: 'ever', date: 1 }] }
        expect(fn(state as never, {} as never, {} as never)).toHaveLength(1)
    })

    it('getDismissByCategory filters by category', () => {
        const fn = (getters.getDismissByCategory as (s: unknown, g: unknown) => (c: string) => { id: string }[])(
            {} as never,
            {
                getDismiss: [
                    { id: 'a', category: 'flag' },
                    { id: 'b', category: 'maintenance' },
                ],
            } as never
        )
        expect(fn('flag').map((d) => d.id)).toEqual(['a'])
        expect(fn('maintenance').map((d) => d.id)).toEqual(['b'])
        expect(fn('other')).toEqual([])
    })
})
