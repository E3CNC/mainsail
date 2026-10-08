import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { mutations } from '@/store/gui/remoteprinters/mutations'
import { getDefaultState } from '@/store/gui/remoteprinters/index'

const printer = { hostname: 'printer1', port: 7125 }

describe('gui/remoteprinters/mutations', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reset restores the default state', () => {
        const state = { printers: { p1: { ...printer } } } as never
        mutations.reset(state as never)
        expect(state).toEqual(getDefaultState())
    })

    it('store adds a printer by id', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'p1', values: { ...printer } } as never)
        expect(state.printers['p1']).toEqual({ ...printer })
    })

    it('update merges partial values into an existing printer', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'p1', values: { ...printer } } as never)
        mutations.update(state as never, { id: 'p1', values: { name: 'renamed' } } as never)
        expect(state.printers['p1']).toMatchObject({ hostname: 'printer1', name: 'renamed' })
    })

    it('update ignores unknown ids', () => {
        const state = getDefaultState()
        mutations.update(state as never, { id: 'missing', values: { name: 'x' } } as never)
        expect(state.printers).toEqual({})
    })

    it('delete removes an existing printer', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'p1', values: { ...printer } } as never)
        mutations.delete(state as never, 'p1' as never)
        expect(state.printers).toEqual({})
    })

    it('delete ignores unknown ids', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'p1', values: { ...printer } } as never)
        mutations.delete(state as never, 'missing' as never)
        expect(Object.keys(state.printers)).toEqual(['p1'])
    })
})
