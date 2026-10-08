import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { getters } from '@/store/gui/miscellaneous/getters'

const stateWithEntries = () => ({
    entries: {
        id1: { name: 'bed', type: 'temperature', lightgroups: { lg1: { name: 'lg1', start: 0, end: 1 } }, presets: {} },
        id2: { name: 'extruder', type: 'temperature', lightgroups: {}, presets: { p1: { name: 'red' } } },
    },
})

describe('gui/miscellaneous/getters', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('getEntries maps the entries record to an array', () => {
        const result = (getters.getEntries as (s: unknown) => { id: string }[])(stateWithEntries() as never)
        expect(result).toHaveLength(2)
        expect(result.find((e) => e.id === 'id1')).toMatchObject({ name: 'bed', type: 'temperature' })
        expect(result.find((e) => e.id === 'id2')).toMatchObject({ name: 'extruder', type: 'temperature' })
    })

    it('getEntries returns an empty array when there are no entries', () => {
        const result = (getters.getEntries as (s: unknown) => unknown[])({ entries: {} } as never)
        expect(result).toEqual([])
    })

    it('getEntries copies lightgroups and presets instead of referencing state', () => {
        const state = stateWithEntries()
        const result = (getters.getEntries as (s: unknown) => { lightgroups: object; presets: object }[])(
            state as never
        )
        expect(result[0].lightgroups).toEqual(state.entries.id1.lightgroups)
        expect(result[0].lightgroups).not.toBe(state.entries.id1.lightgroups)
    })

    it('getEntry finds an entry by type and name', () => {
        const localGetters = {
            getEntries: (getters.getEntries as (s: unknown) => never[])(stateWithEntries() as never),
        }
        const fn = (getters.getEntry as (s: unknown, g: unknown) => (p: unknown) => { id: string } | undefined)(
            stateWithEntries() as never,
            localGetters as never
        )
        expect(fn({ type: 'temperature', name: 'bed' } as never)?.id).toBe('id1')
    })

    it('getEntry returns undefined when nothing matches', () => {
        const localGetters = {
            getEntries: (getters.getEntries as (s: unknown) => never[])(stateWithEntries() as never),
        }
        const fn = (getters.getEntry as (s: unknown, g: unknown) => (p: unknown) => unknown)(
            stateWithEntries() as never,
            localGetters as never
        )
        expect(fn({ type: 'other', name: 'missing' } as never)).toBeUndefined()
    })

    it('getId returns the id of the matching entry', () => {
        const entries = (getters.getEntries as (s: unknown) => { id: string; type: string; name: string }[])(
            stateWithEntries() as never
        )
        const localGetters = {
            getEntry: (payload: { type: string; name: string }) =>
                entries.find((e) => e.name === payload.name && e.type === payload.type),
        }
        const fn = (getters.getId as (s: unknown, g: unknown) => (p: unknown) => string | null)(
            stateWithEntries() as never,
            localGetters as never
        )
        expect(fn({ type: 'temperature', name: 'extruder' } as never)).toBe('id2')
    })

    it('getId returns null when nothing matches', () => {
        const fn = (getters.getId as (s: unknown, g: unknown) => (p: unknown) => string | null)(
            { entries: {} } as never,
            { getEntry: () => undefined } as never
        )
        expect(fn({ type: 'temperature', name: 'missing' } as never)).toBeNull()
    })
})
