import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { getters } from '@/store/gui/remoteprinters/getters'

describe('gui/remoteprinters/getters', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('getRemoteprinters merges socket state and sorts case-insensitively by hostname', () => {
        const state = {
            printers: {
                p1: { hostname: 'beta', port: 7125 },
                p2: { hostname: 'Alpha', port: 7125 },
            },
        }
        const rootGetters = {
            'farm/getPrinterSocketState': (id: string) => ({ id, connected: id === 'p1' }),
        }
        const fn = getters.getRemoteprinters as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => { id: string; hostname: string; socket: unknown }[]
        const result = fn(state as never, {} as never, {} as never, rootGetters as never)
        expect(result.map((p) => p.hostname)).toEqual(['Alpha', 'beta'])
        expect(result.find((p) => p.id === 'p1')?.socket).toEqual({ id: 'p1', connected: true })
        expect(result.find((p) => p.id === 'p2')?.socket).toEqual({ id: 'p2', connected: false })
    })

    it('getRemoteprinters returns an empty array when there are no printers', () => {
        const fn = getters.getRemoteprinters as (s: unknown, g: unknown, r: unknown, rg: unknown) => unknown[]
        const rootGetters = { 'farm/getPrinterSocketState': () => ({}) }
        expect(fn({ printers: {} } as never, {} as never, {} as never, rootGetters as never)).toEqual([])
    })

    it('getRemoteprinters keeps printer fields alongside id and socket', () => {
        const state = { printers: { p1: { hostname: 'h', port: 1234, name: 'n', path: '/p', settings: { a: 1 } } } }
        const rootGetters = { 'farm/getPrinterSocketState': () => ({ state: 'ok' }) }
        const fn = getters.getRemoteprinters as (
            s: unknown,
            g: unknown,
            r: unknown,
            rg: unknown
        ) => { port: number; name: string }[]
        const result = fn(state as never, {} as never, {} as never, rootGetters as never)
        expect(result[0].port).toBe(1234)
        expect(result[0].name).toBe('n')
    })
})
