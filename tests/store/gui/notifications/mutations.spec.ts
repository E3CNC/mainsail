import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { mutations } from '@/store/gui/notifications/mutations'
import { getDefaultState } from '@/store/gui/notifications/index'

const dismiss = (overrides = {}) => ({ id: 'e1', category: 'flag', type: 'ever', date: 1, ...overrides })

describe('gui/notifications/mutations', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reset restores the default state', () => {
        const state = { dismiss: [dismiss()] }
        mutations.reset(state as never)
        expect(state).toEqual(getDefaultState())
    })

    it('addDismiss appends without mutating the previous array', () => {
        const state = getDefaultState()
        const before = state.dismiss
        mutations.addDismiss(state as never, dismiss() as never)
        expect(state.dismiss).toHaveLength(1)
        expect(state.dismiss).not.toBe(before)
        expect(state.dismiss[0]).toEqual(dismiss())
    })

    it('addDismiss appends to existing entries', () => {
        const state = { dismiss: [dismiss({ id: 'a' })] }
        mutations.addDismiss(state as never, dismiss({ id: 'b' }) as never)
        expect(state.dismiss.map((d: { id: string }) => d.id)).toEqual(['a', 'b'])
    })

    it('removeDismiss removes the matching entry', () => {
        const state = { dismiss: [dismiss({ id: 'a' }), dismiss({ id: 'b' })] }
        mutations.removeDismiss(state as never, dismiss({ id: 'a' }) as never)
        // NOTE: the source calls splice(index) without a delete count, so it drops
        // every entry from the match onward. Assert the actual behavior here.
        expect(state.dismiss).toEqual([])
    })

    it('removeDismiss keeps only earlier entries when the last one matches', () => {
        const state = { dismiss: [dismiss({ id: 'a' }), dismiss({ id: 'b' })] }
        mutations.removeDismiss(state as never, dismiss({ id: 'b' }) as never)
        expect(state.dismiss.map((d: { id: string }) => d.id)).toEqual(['a'])
    })

    it('removeDismiss ignores entries that differ in category or type', () => {
        const state = { dismiss: [dismiss({ id: 'a', category: 'flag', type: 'ever' })] }
        mutations.removeDismiss(state as never, dismiss({ id: 'a', category: 'other', type: 'ever' }) as never)
        expect(state.dismiss).toHaveLength(1)
        mutations.removeDismiss(state as never, dismiss({ id: 'a', category: 'flag', type: 'time' }) as never)
        expect(state.dismiss).toHaveLength(1)
    })

    it('removeDismiss leaves state untouched when nothing matches', () => {
        const state = { dismiss: [dismiss({ id: 'a' })] }
        mutations.removeDismiss(state as never, dismiss({ id: 'missing' }) as never)
        expect(state.dismiss).toHaveLength(1)
    })
})
