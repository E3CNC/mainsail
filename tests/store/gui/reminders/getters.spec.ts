import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { getters } from '@/store/gui/reminders/getters'

const reminder = (overrides = {}) => ({
    id: 'r1',
    name: 'clean filter',
    start_total_print_time: 100,
    time_delta: 50,
    repeating: false,
    snooze_print_hours_timestamps: [],
    snooze_epoch_timestamps: [],
    ...overrides,
})

describe('gui/reminders/getters', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('getReminders maps the record to an array with ids', () => {
        const state = { reminders: { r1: reminder(), r2: reminder({ id: 'r2', name: 'other' }) } }
        const result = (getters.getReminders as (s: unknown) => { id: string; name: string }[])(state as never)
        expect(result).toHaveLength(2)
        expect(result.find((r) => r.id === 'r2')?.name).toBe('other')
    })

    it('getReminders returns an empty array when there are no reminders', () => {
        const result = (getters.getReminders as (s: unknown) => unknown[])({ reminders: {} } as never)
        expect(result).toEqual([])
    })

    it('getReminder finds a reminder by id', () => {
        const localGetters = { getReminders: [reminder(), reminder({ id: 'r2' })] }
        const fn = (getters.getReminder as (s: unknown, g: unknown) => (id: string) => { id: string } | undefined)(
            {} as never,
            localGetters as never
        )
        expect(fn('r2')?.id).toBe('r2')
    })

    it('getReminder returns undefined for unknown ids and missing lists', () => {
        const fn = (getters.getReminder as (s: unknown, g: unknown) => (id: string) => unknown)(
            {} as never,
            { getReminders: [reminder()] } as never
        )
        expect(fn('missing')).toBeUndefined()
        const fallback = (getters.getReminder as (s: unknown, g: unknown) => (id: string) => unknown)(
            {} as never,
            {} as never
        )
        expect(fallback('r1')).toBeUndefined()
    })

    it('getOverdueReminders returns overdue reminders', () => {
        // NOTE: the source computes `time_delta - (current - 0 - start)`, i.e. operator
        // precedence makes the snooze-unaware formula `time_delta - current + 0 - start`.
        // With time_delta 50, current 200, start 100 this is 50 - 200 - 100 = -250 (< 0).
        const localGetters = { getReminders: [reminder()] }
        const rootState = { server: { history: { job_totals: { total_print_time: 200 } } } }
        const fn = getters.getOverdueReminders as (s: unknown, g: unknown, r: unknown) => { id: string }[]
        expect(fn({} as never, localGetters as never, rootState as never).map((r) => r.id)).toEqual(['r1'])
    })

    it('getOverdueReminders skips reminders that are not overdue', () => {
        const localGetters = { getReminders: [reminder({ time_delta: 10000 })] }
        const rootState = { server: { history: { job_totals: { total_print_time: 200 } } } }
        const fn = getters.getOverdueReminders as (s: unknown, g: unknown, r: unknown) => unknown[]
        expect(fn({} as never, localGetters as never, rootState as never)).toEqual([])
    })

    it('getOverdueReminders falls back to zero print time without history', () => {
        const localGetters = { getReminders: [reminder({ time_delta: -500, start_total_print_time: 0 })] }
        const fn = getters.getOverdueReminders as (s: unknown, g: unknown, r: unknown) => { id: string }[]
        expect(fn({} as never, localGetters as never, {} as never).map((r) => r.id)).toEqual(['r1'])
    })
})
