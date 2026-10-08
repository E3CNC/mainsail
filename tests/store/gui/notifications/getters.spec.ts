import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/plugins/i18n.js', () => ({
    default: { global: { t: (key: string) => key } },
}))

vi.mock('detect-browser', () => ({
    detect: () => null,
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

describe('gui/notifications/getters (part 1)', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('getNotifications concatenates every category', () => {
        const mk = (id: string) => ({
            id,
            priority: 'high',
            title: id,
            description: id,
            date: new Date(),
            dismissed: false,
        })
        const local = {
            getNotificationsFlags: [mk('f1')],
            getNotificationsDependencies: [mk('d1')],
            getNotificationsMoonrakerWarnings: [mk('w1')],
            getNotificationsMoonrakerFailedComponents: [mk('c1')],
            getNotificationsMoonrakerFailedInitComponents: [mk('i1')],
            getNotificationsKlipperWarnings: [mk('k1')],
            getNotificationsOverdueMaintenance: [mk('m1')],
            getNotificationsBrowserWarnings: [mk('b1')],
            getNotificationsOverheatDrivers: [mk('t1')],
        }
        const fn = getters.getNotifications as (s: unknown, g: unknown) => { id: string }[]
        const result = fn({} as never, local as never)
        expect(result.map((n) => n.id).sort()).toEqual(['b1', 'c1', 'd1', 'f1', 'i1', 'k1', 'm1', 't1', 'w1'])
    })

    it('getNotifications sorts critical first, then by newest date', () => {
        const older = {
            id: 'a',
            priority: 'critical',
            title: 'a',
            description: 'a',
            date: new Date(1000),
            dismissed: false,
        }
        const newer = {
            id: 'b',
            priority: 'critical',
            title: 'b',
            description: 'b',
            date: new Date(2000),
            dismissed: false,
        }
        const normal = {
            id: 'c',
            priority: 'normal',
            title: 'c',
            description: 'c',
            date: new Date(9999),
            dismissed: false,
        }
        const high = { id: 'd', priority: 'high', title: 'd', description: 'd', date: new Date(9999), dismissed: false }
        const local = {
            getNotificationsFlags: [],
            getNotificationsDependencies: [],
            getNotificationsMoonrakerWarnings: [],
            getNotificationsMoonrakerFailedComponents: [],
            getNotificationsMoonrakerFailedInitComponents: [],
            getNotificationsKlipperWarnings: [normal, newer, high, older],
            getNotificationsOverdueMaintenance: [],
            getNotificationsBrowserWarnings: [],
            getNotificationsOverheatDrivers: [],
        }
        const fn = getters.getNotifications as (s: unknown, g: unknown) => { id: string }[]
        expect(fn({} as never, local as never).map((n) => n.id)).toEqual(['b', 'a', 'd', 'c'])
    })

    it('getNotificationsFlags returns empty when there are no flags', () => {
        const fn = getters.getNotificationsFlags as (s: unknown, g: unknown, r: unknown, rg: unknown) => unknown[]
        expect(fn({} as never, {} as never, {} as never, rootGettersWith() as never)).toEqual([])
    })

    it('getNotificationsFlags maps flags, marks Previously* as high and filters dismissed', () => {
        const fn = getters.getNotificationsFlags as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => { id: string; priority: string }[]
        const result = fn(
            {} as never,
            {} as never,
            { server: { system_boot_at: bootDate } } as never,
            rootGettersWith(() => [{ id: 'UnderVoltage' }], {
                'server/getThrottledStateFlags': ['UnderVoltage', 'PreviouslyUnderVoltage', 'OverHeat'],
            }) as never
        )
        expect(result.map((n) => n.id).sort()).toEqual(['flag/OverHeat', 'flag/PreviouslyUnderVoltage'])
        expect(result.find((n) => n.id === 'flag/OverHeat')?.priority).toBe('critical')
        expect(result.find((n) => n.id === 'flag/PreviouslyUnderVoltage')?.priority).toBe('high')
    })

    it('getNotificationsFlags falls back to the current date without system_boot_at', () => {
        const fn = getters.getNotificationsFlags as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => { date: Date }[]
        const result = fn(
            {} as never,
            {} as never,
            {} as never,
            rootGettersWith(() => [], { 'server/getThrottledStateFlags': ['OverHeat'] }) as never
        )
        expect(result[0].date).toBeInstanceOf(Date)
    })

    it('getNotificationsDependencies returns empty when there are no dependencies', () => {
        const fn = getters.getNotificationsDependencies as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => unknown[]
        expect(fn({} as never, {} as never, {} as never, rootGettersWith() as never)).toEqual([])
    })

    it('getNotificationsDependencies maps dependencies and filters dismissed ones', () => {
        const fn = getters.getNotificationsDependencies as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => { id: string; priority: string }[]
        const dep = { serviceName: 'klipper', installedVersion: 'v1', neededVersion: 'v2' }
        const result = fn(
            {} as never,
            {} as never,
            { server: { system_boot_at: bootDate } } as never,
            rootGettersWith(() => [{ id: 'klipper/v2' }], {
                getDependencies: [dep, { ...dep, serviceName: 'moonraker' }],
            }) as never
        )
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('dependency/moonraker/v2')
        expect(result[0].priority).toBe('high')
    })

    it('getNotificationsMoonrakerWarnings returns empty when there are no warnings', () => {
        const fn = getters.getNotificationsMoonrakerWarnings as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => unknown[]
        expect(fn({} as never, {} as never, { server: {} } as never, rootGettersWith() as never)).toEqual([])
    })

    it('getNotificationsMoonrakerWarnings maps plain warnings and filters dismissed hashes', () => {
        const fn = getters.getNotificationsMoonrakerWarnings as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => { id: string }[]
        const dismissed = sha256('old warning')
        const result = fn(
            {} as never,
            {} as never,
            { server: { warnings: ['old warning', 'new warning'], system_boot_at: bootDate } } as never,
            rootGettersWith(() => [{ id: dismissed }]) as never
        )
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe(`moonrakerWarning/${sha256('new warning')}`)
    })

    it('getNotificationsMoonrakerWarnings translates unparsed config options and sections', () => {
        const fn = getters.getNotificationsMoonrakerWarnings as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => { description: string }[]
        const result = fn(
            {} as never,
            {} as never,
            {
                server: {
                    warnings: [
                        "Unparsed config option 'foo: bar' in section [printer]",
                        'Unparsed config section [display]',
                    ],
                    system_boot_at: bootDate,
                },
            } as never,
            rootGettersWith(() => []) as never
        )
        expect(result).toHaveLength(2)
    })

    it('getNotificationsMoonrakerFailedComponents maps components and filters dismissed', () => {
        const fn = getters.getNotificationsMoonrakerFailedComponents as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => { id: string }[]
        const result = fn(
            {} as never,
            {} as never,
            { server: { failed_components: ['history', 'power'], system_boot_at: bootDate } } as never,
            rootGettersWith(() => [{ id: 'history' }]) as never
        )
        expect(result.map((n) => n.id)).toEqual(['moonrakerFailedComponent/power'])
    })

    it('getNotificationsMoonrakerFailedComponents returns empty without failures', () => {
        const fn = getters.getNotificationsMoonrakerFailedComponents as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => unknown[]
        expect(fn({} as never, {} as never, { server: {} } as never, rootGettersWith() as never)).toEqual([])
    })

    it('getNotificationsMoonrakerFailedInitComponents maps components and filters dismissed', () => {
        const fn = getters.getNotificationsMoonrakerFailedInitComponents as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => { id: string }[]
        const result = fn(
            {} as never,
            {} as never,
            { server: { failed_init_components: ['spoolman'], system_boot_at: bootDate } } as never,
            rootGettersWith(() => []) as never
        )
        expect(result.map((n) => n.id)).toEqual(['moonrakerFailedInitComponent/spoolman'])
    })

    it('getNotificationsMoonrakerFailedInitComponents returns empty without failures', () => {
        const fn = getters.getNotificationsMoonrakerFailedInitComponents as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => unknown[]
        expect(fn({} as never, {} as never, { server: {} } as never, rootGettersWith() as never)).toEqual([])
    })
})
