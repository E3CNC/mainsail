import { describe, expect, it, vi, beforeEach } from 'vitest'
import { farm, getDefaultState } from '@/store/farm/index'

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

describe('farm/index', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('getDefaultState returns an empty map', () => {
        expect(getDefaultState()).toEqual({})
    })

    it('module is namespaced with getters, actions and no mutations', () => {
        expect(farm.namespaced).toBe(true)
        expect(typeof farm.getters).toBe('object')
        expect(typeof farm.actions).toBe('object')
        expect(farm.mutations).toEqual({})
    })

    it('countPrinters / getPrinters / existsPrinter', () => {
        const s = { p1: {}, p2: {} } as never
        const count = (farm.getters!.countPrinters as (s: never) => number)(s)
        expect(count).toBe(2)
        expect((farm.getters!.getPrinters as (s: never) => never)(s)).toBe(s)
        const exists = farm.getters!.existsPrinter as (s: never) => (ns: string) => boolean
        expect(exists(s)('p1')).toBe(true)
        expect(exists(s)('missing')).toBe(false)
    })

    it('getPrinterName delegates to the namespaced getter', () => {
        const fn = farm.getters!.getPrinterName as (s: never, g: Record<string, unknown>) => (ns: string) => unknown
        const run = fn({} as never, { 'p1/getPrinterName': 'Farm1' })
        expect(run('p1')).toBe('Farm1')
    })

    it('getPrinterSocketState falls back when missing', () => {
        const fn = farm.getters!.getPrinterSocketState as (
            s: never,
            g: Record<string, unknown>
        ) => (ns: string) => unknown
        expect(fn({} as never, {})('p1')).toEqual({ isConnecting: false, isConnected: false })
        const connected = { isConnecting: false, isConnected: true }
        expect(fn({} as never, { 'p1/getPrinterSocketState': connected })('p1')).toBe(connected)
    })

    it('registerPrinter registers, commits socket data and connects', () => {
        const c = ctx()
        const store = {
            hasModule: vi.fn().mockReturnValue(false),
            registerModule: vi.fn(),
        }
        farm.actions!.registerPrinter.call(store as never, c as never, { id: 'p1', hostname: 'a.local' })
        expect(store.registerModule).toHaveBeenCalledWith(['farm', 'p1'], expect.anything())
        expect(c.commit).toHaveBeenCalledWith('farm/p1/setSocketData', expect.objectContaining({ _namespace: 'p1' }), {
            root: true,
        })
        expect(c.dispatch).toHaveBeenCalledWith('farm/p1/connect', {}, { root: true })
    })

    it('registerPrinter stores settings when present', () => {
        const c = ctx()
        const store = { hasModule: vi.fn().mockReturnValue(false), registerModule: vi.fn() }
        farm.actions!.registerPrinter.call(store as never, c as never, { id: 'p1', settings: { theme: 1 } })
        expect(c.commit).toHaveBeenCalledWith('farm/p1/setSettings', { theme: 1 }, { root: true })
    })

    it('registerPrinter skips existing modules', () => {
        const c = ctx()
        const store = { hasModule: vi.fn().mockReturnValue(true), registerModule: vi.fn() }
        farm.actions!.registerPrinter.call(store as never, c as never, { id: 'p1' })
        expect(store.registerModule).not.toHaveBeenCalled()
        expect(c.commit).not.toHaveBeenCalled()
    })

    it('updatePrinter commits socket data and reconnects', () => {
        const c = ctx()
        farm.actions!.updatePrinter(c as never, {
            id: 'p1',
            values: { hostname: 'b.local', port: 7126, path: '/x' },
        })
        expect(c.commit).toHaveBeenCalledWith('p1/setSocketData', {
            hostname: 'b.local',
            port: 7126,
            path: '/x',
            isConnecting: true,
        })
        expect(c.dispatch).toHaveBeenCalledWith('p1/reconnect')
    })

    it('unregisterPrinter closes the socket and unregisters', () => {
        const close = vi.fn()
        const c = ctx({ state: { p1: { socket: { instance: { close } } } } })
        const store = { unregisterModule: vi.fn() }
        farm.actions!.unregisterPrinter.call(store as never, c as never, 'p1')
        expect(close).toHaveBeenCalled()
        expect(store.unregisterModule).toHaveBeenCalledWith(['farm', 'p1'])
    })

    it('unregisterPrinter handles missing instance and unknown id', () => {
        const c = ctx({ state: { p1: { socket: { instance: null } } } })
        const store = { unregisterModule: vi.fn() }
        farm.actions!.unregisterPrinter.call(store as never, c as never, 'p1')
        expect(store.unregisterModule).toHaveBeenCalled()
        const empty = ctx({ state: {} })
        farm.actions!.unregisterPrinter.call(store as never, empty as never, 'missing')
        expect(store.unregisterModule).toHaveBeenCalledTimes(1)
    })
})
