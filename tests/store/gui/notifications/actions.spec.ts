import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/gui/notifications/actions'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { dismiss: [] },
        rootState: {},
        rootGetters: {},
        getters: {},
        ...overrides,
    }
}

describe('gui/notifications/actions', () => {
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

    it('upload posts the dismiss list', () => {
        const dismiss = [{ id: 'x', category: 'flag', type: 'ever', date: 1 }]
        const c = ctx({ state: { dismiss } })
        actions.upload(c as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.database.post_item', {
            namespace: 'mainsail',
            key: 'notifications.dismiss',
            value: dismiss,
        })
    })

    it('close returns early when the id has no category slash', () => {
        const c = ctx()
        actions.close(c as never, { id: 'noslash' } as never)
        expect(c.dispatch).not.toHaveBeenCalled()
    })

    it('close dispatches storeDismiss with type ever', () => {
        const c = ctx()
        actions.close(c as never, { id: 'flag/UnderVoltage' } as never)
        expect(c.dispatch).toHaveBeenCalledWith('storeDismiss', {
            entry_id: 'UnderVoltage',
            category: 'flag',
            type: 'ever',
            time: null,
        })
    })

    it('close splits on the first slash only', () => {
        const c = ctx()
        actions.close(c as never, { id: 'cat/a/b' } as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'storeDismiss',
            expect.objectContaining({ entry_id: 'a/b', category: 'cat' })
        )
    })

    it('dismiss returns early when the id has no category slash', () => {
        const c = ctx()
        actions.dismiss(c as never, { id: 'noslash', type: 'ever', time: null } as never)
        expect(c.dispatch).not.toHaveBeenCalled()
    })

    it('dismiss forwards type and time', () => {
        const c = ctx()
        actions.dismiss(c as never, { id: 'maintenance/k1', type: 'time', time: 60 } as never)
        expect(c.dispatch).toHaveBeenCalledWith('storeDismiss', {
            entry_id: 'k1',
            category: 'maintenance',
            type: 'time',
            time: 60,
        })
    })

    it('storeDismiss stores an ever dismiss with the current date', async () => {
        const c = ctx()
        const before = Date.now()
        await actions.storeDismiss(c as never, { entry_id: 'e1', category: 'flag', type: 'ever', time: null } as never)
        expect(c.commit).toHaveBeenCalledWith(
            'addDismiss',
            expect.objectContaining({ id: 'e1', category: 'flag', type: 'ever' })
        )
        const added = c.commit.mock.calls.find(([name]) => name === 'addDismiss')?.[1] as { date: number }
        expect(added.date).toBeGreaterThanOrEqual(before)
        expect(c.commit).not.toHaveBeenCalledWith('removeDismiss', expect.anything())
        expect(c.dispatch).toHaveBeenCalledWith('upload')
    })

    it('storeDismiss offsets the date for time dismisses', async () => {
        const c = ctx()
        const before = Date.now()
        await actions.storeDismiss(c as never, { entry_id: 'e1', category: 'flag', type: 'time', time: 60 } as never)
        const added = c.commit.mock.calls.find(([name]) => name === 'addDismiss')?.[1] as { date: number }
        expect(added.date).toBeGreaterThanOrEqual(before + 60000 - 1000)
    })

    it('storeDismiss treats a null time offset as zero', async () => {
        const c = ctx()
        const before = Date.now()
        await actions.storeDismiss(c as never, { entry_id: 'e1', category: 'flag', type: 'time', time: null } as never)
        const added = c.commit.mock.calls.find(([name]) => name === 'addDismiss')?.[1] as { date: number }
        expect(added.date).toBeGreaterThanOrEqual(before)
        expect(added.date).toBeLessThan(before + 5000)
    })

    it('storeDismiss removes a duplicate before re-adding it', async () => {
        const existing = { id: 'e1', category: 'flag', type: 'ever', date: 1 }
        const c = ctx({ state: { dismiss: [existing] } })
        await actions.storeDismiss(c as never, { entry_id: 'e1', category: 'flag', type: 'ever', time: null } as never)
        expect(c.commit).toHaveBeenCalledWith('removeDismiss', expect.objectContaining({ id: 'e1' }))
        expect(c.commit).toHaveBeenCalledWith('addDismiss', expect.objectContaining({ id: 'e1' }))
        expect(c.dispatch).toHaveBeenCalledWith('upload')
    })

    it('storeDismiss keeps entries that differ in type', async () => {
        const existing = { id: 'e1', category: 'flag', type: 'time', date: 1 }
        const c = ctx({ state: { dismiss: [existing] } })
        await actions.storeDismiss(c as never, { entry_id: 'e1', category: 'flag', type: 'ever', time: null } as never)
        expect(c.commit).not.toHaveBeenCalledWith('removeDismiss', expect.anything())
        expect(c.commit).toHaveBeenCalledWith('addDismiss', expect.objectContaining({ type: 'ever' }))
    })
})
