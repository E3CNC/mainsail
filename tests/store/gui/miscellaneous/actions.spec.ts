import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/gui/miscellaneous/actions'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { entries: {} },
        rootState: {},
        rootGetters: {},
        getters: {},
        ...overrides,
    }
}

const lightgroup = { name: 'lg1', start: 0, end: 100 }
const preset = { name: 'p1', red: 1, blue: 0, green: 0, white: null }

describe('gui/miscellaneous/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('upload emits the entry value', () => {
        const entry = { name: 'n', type: 't' }
        const c = ctx({ state: { entries: { abc: entry } } })
        actions.upload(c as never, 'abc')
        expect(mocks.emit).toHaveBeenCalledWith('server.database.post_item', {
            namespace: 'mainsail',
            key: 'miscellaneous.entries.abc',
            value: entry,
        })
    })

    it('store commits, dispatches upload and returns the id', () => {
        const c = ctx()
        const id = actions.store(c as never, { type: 't', name: 'n' } as never) as unknown as string
        expect(typeof id).toBe('string')
        expect(c.commit).toHaveBeenCalledWith('store', { id, values: { type: 't', name: 'n' } })
        expect(c.dispatch).toHaveBeenCalledWith('upload', id)
    })

    it('storeLightgroup creates a new entry when none matches', () => {
        const c = ctx({ state: { entries: {} } })
        actions.storeLightgroup(c as never, { type: 't', name: 'n', lightgroup } as never)
        expect(c.commit).toHaveBeenCalledWith('store', expect.objectContaining({ values: { name: 'n', type: 't' } }))
        const entryId = (c.commit.mock.calls[0][1] as { id: string }).id
        expect(c.commit).toHaveBeenCalledWith('storeLightgroup', { entryId, values: lightgroup })
        expect(c.dispatch).toHaveBeenCalledWith('upload', entryId)
    })

    it('storeLightgroup reuses the matching entry', () => {
        const c = ctx({ state: { entries: { e1: { type: 't', name: 'n' } } } })
        actions.storeLightgroup(c as never, { type: 't', name: 'n', lightgroup } as never)
        expect(c.commit).not.toHaveBeenCalledWith('store', expect.anything())
        expect(c.commit).toHaveBeenCalledWith('storeLightgroup', { entryId: 'e1', values: lightgroup })
        expect(c.dispatch).toHaveBeenCalledWith('upload', 'e1')
    })

    it('updateLightgroup commits and uploads when the entry exists', () => {
        const c = ctx({ state: { entries: { e1: { type: 't', name: 'n' } } } })
        actions.updateLightgroup(c as never, { type: 't', name: 'n', lightgroupId: 'lg1', lightgroup } as never)
        expect(c.commit).toHaveBeenCalledWith('updateLightgroup', {
            entryId: 'e1',
            lightgroupId: 'lg1',
            values: lightgroup,
        })
        expect(c.dispatch).toHaveBeenCalledWith('upload', 'e1')
    })

    it('updateLightgroup returns early when no entry matches', () => {
        const c = ctx({ state: { entries: {} } })
        actions.updateLightgroup(c as never, { type: 't', name: 'n', lightgroupId: 'lg1', lightgroup } as never)
        expect(c.commit).not.toHaveBeenCalled()
        expect(c.dispatch).not.toHaveBeenCalled()
    })

    it('deleteLightgroup commits destroy and uploads when the entry exists', () => {
        const c = ctx({ state: { entries: { e1: { type: 't', name: 'n' } } } })
        actions.deleteLightgroup(c as never, { type: 't', name: 'n', lightgroupId: 'lg1' } as never)
        expect(c.commit).toHaveBeenCalledWith('destroyLightgroup', { entryId: 'e1', lightgroupId: 'lg1' })
        expect(c.dispatch).toHaveBeenCalledWith('upload', 'e1')
    })

    it('deleteLightgroup returns early when no entry matches', () => {
        const c = ctx({ state: { entries: {} } })
        actions.deleteLightgroup(c as never, { type: 't', name: 'n', lightgroupId: 'lg1' } as never)
        expect(c.commit).not.toHaveBeenCalled()
        expect(c.dispatch).not.toHaveBeenCalled()
    })

    it('storePreset creates a new entry when none matches', () => {
        const c = ctx({ state: { entries: {} } })
        actions.storePreset(c as never, { type: 't', name: 'n', preset } as never)
        expect(c.commit).toHaveBeenCalledWith('store', expect.objectContaining({ values: { name: 'n', type: 't' } }))
        const entryId = (c.commit.mock.calls[0][1] as { id: string }).id
        expect(c.commit).toHaveBeenCalledWith('storePreset', { entryId, values: preset })
        expect(c.dispatch).toHaveBeenCalledWith('upload', entryId)
    })

    it('storePreset reuses the matching entry', () => {
        const c = ctx({ state: { entries: { e1: { type: 't', name: 'n' } } } })
        actions.storePreset(c as never, { type: 't', name: 'n', preset } as never)
        expect(c.commit).not.toHaveBeenCalledWith('store', expect.anything())
        expect(c.commit).toHaveBeenCalledWith('storePreset', { entryId: 'e1', values: preset })
        expect(c.dispatch).toHaveBeenCalledWith('upload', 'e1')
    })

    it('updatePreset commits and uploads when the entry exists', () => {
        const c = ctx({ state: { entries: { e1: { type: 't', name: 'n' } } } })
        actions.updatePreset(c as never, { type: 't', name: 'n', presetId: 'p1', preset } as never)
        expect(c.commit).toHaveBeenCalledWith('updatePreset', { entryId: 'e1', presetId: 'p1', values: preset })
        expect(c.dispatch).toHaveBeenCalledWith('upload', 'e1')
    })

    it('updatePreset returns early when no entry matches', () => {
        const c = ctx({ state: { entries: {} } })
        actions.updatePreset(c as never, { type: 't', name: 'n', presetId: 'p1', preset } as never)
        expect(c.commit).not.toHaveBeenCalled()
        expect(c.dispatch).not.toHaveBeenCalled()
    })

    it('deletePreset commits destroy and uploads when the entry exists', () => {
        const c = ctx({ state: { entries: { e1: { type: 't', name: 'n' } } } })
        actions.deletePreset(c as never, { type: 't', name: 'n', presetId: 'p1' } as never)
        expect(c.commit).toHaveBeenCalledWith('destroyPreset', { entryId: 'e1', presetId: 'p1' })
        expect(c.dispatch).toHaveBeenCalledWith('upload', 'e1')
    })

    it('deletePreset returns early when no entry matches', () => {
        const c = ctx({ state: { entries: {} } })
        actions.deletePreset(c as never, { type: 't', name: 'n', presetId: 'p1' } as never)
        expect(c.commit).not.toHaveBeenCalled()
        expect(c.dispatch).not.toHaveBeenCalled()
    })
})
