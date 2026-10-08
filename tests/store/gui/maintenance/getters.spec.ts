import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { getters } from '@/store/gui/maintenance/getters'

const baseEntry = {
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

const withReminder = (overrides: object) => ({
    ...baseEntry,
    reminder: { ...baseEntry.reminder, ...overrides },
})

describe('gui/maintenance/getters', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('getEntries maps the record to an array with ids', () => {
        const state = { entries: { k1: { ...baseEntry }, k2: { ...baseEntry, name: 'nozzles' } } }
        const result = (getters.getEntries as (s: unknown) => { id: string; name: string }[])(state as never)
        expect(result).toHaveLength(2)
        expect(result.find((e) => e.id === 'k1')?.name).toBe('belts')
        expect(result.find((e) => e.id === 'k2')?.name).toBe('nozzles')
    })

    it('getEntries returns an empty array when there are no entries', () => {
        const result = (getters.getEntries as (s: unknown) => unknown[])({ entries: {} } as never)
        expect(result).toEqual([])
    })

    it('getOverdueEntries flags overdue filament usage', () => {
        const localGetters = {
            getEntries: [{ ...withReminder({ filament: { bool: true, value: 1 } }), id: 'k1' }],
        }
        const rootState = { server: { history: { job_totals: { total_print_time: 0, total_filament_used: 2000 } } } }
        const fn = getters.getOverdueEntries as (s: unknown, g: unknown, r: unknown) => { id: string }[]
        expect(fn({} as never, localGetters as never, rootState as never).map((e) => e.id)).toEqual(['k1'])
    })

    it('getOverdueEntries flags overdue print time', () => {
        const localGetters = {
            getEntries: [{ ...withReminder({ printtime: { bool: true, value: 1 } }), id: 'k1' }],
        }
        const rootState = { server: { history: { job_totals: { total_print_time: 7200, total_filament_used: 0 } } } }
        const fn = getters.getOverdueEntries as (s: unknown, g: unknown, r: unknown) => { id: string }[]
        expect(fn({} as never, localGetters as never, rootState as never)).toHaveLength(1)
    })

    it('getOverdueEntries flags overdue dates', () => {
        const localGetters = {
            getEntries: [{ ...withReminder({ date: { bool: true, value: 1 } }), id: 'k1', start_time: 1000 }],
        }
        const rootState = { server: { history: { job_totals: { total_print_time: 0, total_filament_used: 0 } } } }
        const fn = getters.getOverdueEntries as (s: unknown, g: unknown, r: unknown) => { id: string }[]
        expect(fn({} as never, localGetters as never, rootState as never)).toHaveLength(1)
    })

    it('getOverdueEntries skips entries that are not yet due', () => {
        const localGetters = {
            getEntries: [
                {
                    ...withReminder({
                        filament: { bool: true, value: 1000 },
                        printtime: { bool: true, value: 1000 },
                        date: { bool: true, value: 365 },
                    }),
                    id: 'k1',
                    start_time: Date.now() / 1000,
                    start_filament: 0,
                    start_printtime: 0,
                },
            ],
        }
        const rootState = { server: { history: { job_totals: { total_print_time: 10, total_filament_used: 10 } } } }
        const fn = getters.getOverdueEntries as (s: unknown, g: unknown, r: unknown) => unknown[]
        expect(fn({} as never, localGetters as never, rootState as never)).toEqual([])
    })

    it('getOverdueEntries skips missing reminders, null types and finished entries', () => {
        const localGetters = {
            getEntries: [
                { ...baseEntry, reminder: null, id: 'k1' },
                { ...withReminder({ type: null }), id: 'k2' },
                { ...withReminder({ filament: { bool: true, value: 0 } }), id: 'k3', end_time: 123 },
                { ...baseEntry, id: 'k4' },
            ],
        }
        const rootState = { server: { history: { job_totals: { total_print_time: 9999, total_filament_used: 9999 } } } }
        const fn = getters.getOverdueEntries as (s: unknown, g: unknown, r: unknown) => unknown[]
        expect(fn({} as never, localGetters as never, rootState as never)).toEqual([])
    })

    it('getOverdueEntries falls back to zero totals when history is missing', () => {
        const localGetters = {
            getEntries: [{ ...withReminder({ filament: { bool: true, value: 0 } }), id: 'k1', start_filament: 0 }],
        }
        const fn = getters.getOverdueEntries as (s: unknown, g: unknown, r: unknown) => { id: string }[]
        expect(fn({} as never, localGetters as never, {} as never).map((e) => e.id)).toEqual(['k1'])
    })
})
