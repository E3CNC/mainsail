import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { mutations } from '@/store/gui/miscellaneous/mutations'
import { getDefaultState } from '@/store/gui/miscellaneous/index'

const lightgroup = { name: 'lg1', start: 0, end: 100 }
const preset = { name: 'p1', red: 1, blue: 0, green: 0, white: null }

describe('gui/miscellaneous/mutations', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reset restores the default state', () => {
        const state = { entries: { old: { name: 'x', type: 't', lightgroups: {}, presets: {} } } } as never
        mutations.reset(state as never)
        expect(state).toEqual(getDefaultState())
    })

    it('store creates an entry with empty lightgroups and presets', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'e1', values: { type: 't', name: 'n' } } as never)
        expect(state.entries['e1']).toEqual({ name: 'n', type: 't', lightgroups: {}, presets: {} })
    })

    it('storeLightgroup adds a lightgroup under a generated id', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'e1', values: { type: 't', name: 'n' } } as never)
        mutations.storeLightgroup(state as never, { entryId: 'e1', values: lightgroup } as never)
        const ids = Object.keys(state.entries['e1'].lightgroups)
        expect(ids).toHaveLength(1)
        expect(state.entries['e1'].lightgroups[ids[0]]).toEqual(lightgroup)
    })

    it('updateLightgroup replaces the lightgroup value', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'e1', values: { type: 't', name: 'n' } } as never)
        mutations.storeLightgroup(state as never, { entryId: 'e1', values: lightgroup } as never)
        const id = Object.keys(state.entries['e1'].lightgroups)[0]
        const updated = { name: 'lg1', start: 10, end: 20 }
        mutations.updateLightgroup(state as never, { entryId: 'e1', lightgroupId: id, values: updated } as never)
        expect(state.entries['e1'].lightgroups[id]).toEqual(updated)
    })

    it('destroyLightgroup removes only the targeted lightgroup', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'e1', values: { type: 't', name: 'n' } } as never)
        mutations.storeLightgroup(state as never, { entryId: 'e1', values: lightgroup } as never)
        mutations.storeLightgroup(state as never, { entryId: 'e1', values: { ...lightgroup, name: 'lg2' } } as never)
        const [keep, remove] = Object.keys(state.entries['e1'].lightgroups)
        mutations.destroyLightgroup(state as never, { entryId: 'e1', lightgroupId: remove } as never)
        expect(Object.keys(state.entries['e1'].lightgroups)).toEqual([keep])
    })

    it('storePreset adds a preset under a generated id', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'e1', values: { type: 't', name: 'n' } } as never)
        mutations.storePreset(state as never, { entryId: 'e1', values: preset } as never)
        const ids = Object.keys(state.entries['e1'].presets)
        expect(ids).toHaveLength(1)
        expect(state.entries['e1'].presets[ids[0]]).toEqual(preset)
    })

    it('updatePreset replaces the preset value', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'e1', values: { type: 't', name: 'n' } } as never)
        mutations.storePreset(state as never, { entryId: 'e1', values: preset } as never)
        const id = Object.keys(state.entries['e1'].presets)[0]
        const updated = { ...preset, red: 0 }
        mutations.updatePreset(state as never, { entryId: 'e1', presetId: id, values: updated } as never)
        expect(state.entries['e1'].presets[id]).toEqual(updated)
    })

    it('destroyPreset removes only the targeted preset', () => {
        const state = getDefaultState()
        mutations.store(state as never, { id: 'e1', values: { type: 't', name: 'n' } } as never)
        mutations.storePreset(state as never, { entryId: 'e1', values: preset } as never)
        mutations.storePreset(state as never, { entryId: 'e1', values: { ...preset, name: 'p2' } } as never)
        const [keep, remove] = Object.keys(state.entries['e1'].presets)
        mutations.destroyPreset(state as never, { entryId: 'e1', presetId: remove } as never)
        expect(Object.keys(state.entries['e1'].presets)).toEqual([keep])
    })
})
