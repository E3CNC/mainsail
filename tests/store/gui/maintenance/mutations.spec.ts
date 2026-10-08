import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { mutations } from '@/store/gui/maintenance/mutations'
import { getDefaultState } from '@/store/gui/maintenance/index'

const entry = {
    name: 'belts',
    note: '',
    start_time: 1000,
    end_time: null,
    start_filament: 0,
    end_filament: null,
    start_printtime: 0,
    end_printtime: null,
    last_entry: null,
    reminder: {
        type: 'repeat',
        filament: { bool: false, value: null },
        printtime: { bool: false, value: null },
        date: { bool: false, value: null },
    },
}

describe('gui/maintenance/mutations', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reset restores the default state', () => {
        const state = { entries: { k1: { ...entry } } } as never
        mutations.reset(state as never)
        expect(state).toEqual(getDefaultState())
    })

    it('initStore replaces the entries record', () => {
        const state = getDefaultState()
        mutations.initStore(state as never, { k1: entry } as never)
        expect(state.entries).toEqual({ k1: entry })
    })

    it('store adds an entry by id', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'k1', values: entry } as never)
        expect(state.entries['k1']).toEqual(entry)
    })

    it('update merges partial entries', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'k1', values: entry } as never)
        mutations.update(state as never, { id: 'k1', entry: { note: 'new' } } as never)
        expect(state.entries['k1'].note).toBe('new')
        expect(state.entries['k1'].name).toBe('belts')
    })

    it('update ignores unknown ids', () => {
        const state = getDefaultState()
        mutations.update(state as never, { id: 'missing', entry: { note: 'new' } } as never)
        expect(state.entries).toEqual({})
    })

    it('delete removes an existing entry', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'k1', values: entry } as never)
        mutations.delete(state as never, 'k1' as never)
        expect(state.entries).toEqual({})
    })

    it('delete ignores unknown ids', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'k1', values: entry } as never)
        mutations.delete(state as never, 'missing' as never)
        expect(Object.keys(state.entries)).toEqual(['k1'])
    })
})
