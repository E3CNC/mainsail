import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { mutations } from '@/store/gui/reminders/mutations'
import { getDefaultState } from '@/store/gui/reminders/index'

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

describe('gui/reminders/mutations', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reset restores the default state', () => {
        const state = { reminders: { r1: reminder() } } as never
        mutations.reset(state as never)
        expect(state).toEqual(getDefaultState())
    })

    it('initStore replaces the reminders record', () => {
        const state = getDefaultState()
        mutations.initStore(state as never, { value: { r1: reminder() } } as never)
        expect(state.reminders).toEqual({ r1: reminder() })
    })

    it('store adds a reminder by id', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'r1', values: reminder() } as never)
        expect(state.reminders['r1']).toEqual(reminder())
    })

    it('update merges partial reminders', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'r1', values: reminder() } as never)
        mutations.update(state as never, { id: 'r1', name: 'renamed' } as never)
        expect(state.reminders['r1'].name).toBe('renamed')
        expect(state.reminders['r1'].time_delta).toBe(50)
    })

    it('update ignores unknown ids', () => {
        const state = getDefaultState()
        mutations.update(state as never, { id: 'missing', name: 'x' } as never)
        expect(state.reminders).toEqual({})
    })

    it('delete removes an existing reminder', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'r1', values: reminder() } as never)
        mutations.delete(state as never, 'r1' as never)
        expect(state.reminders).toEqual({})
    })

    it('delete ignores unknown ids', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'r1', values: reminder() } as never)
        mutations.delete(state as never, 'missing' as never)
        expect(Object.keys(state.reminders)).toEqual(['r1'])
    })
})
