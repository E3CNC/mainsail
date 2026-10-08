import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/gui/navigation/actions'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { entries: [] },
        rootState: {},
        rootGetters: {},
        getters: {},
        ...overrides,
    }
}

describe('gui/navigation/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
    })

    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('upload emits current entries to the db', () => {
        const entries = [{ type: 'route', title: 'Dashboard', visible: true, position: 1 }]
        const c = ctx({ state: { entries } })
        actions.upload(c as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ namespace: 'mainsail', key: 'navigation.entries', value: entries })
        )
    })

    it('updatePos commits the payload', () => {
        const c = ctx()
        const payload = { type: 'route', title: 'Dashboard', visible: true, position: 3 }
        actions.updatePos(c as never, payload as never)
        expect(c.commit).toHaveBeenCalledWith('updatePos', payload)
    })

    it('changeVisibility commits and uploads', () => {
        const c = ctx()
        const payload = { type: 'route', title: 'Dashboard', icon: 'mdi', position: 1, visible: true }
        actions.changeVisibility(c as never, payload as never)
        expect(c.commit).toHaveBeenCalledWith('changeVisibility', payload)
        expect(c.dispatch).toHaveBeenCalledWith('upload')
    })
})
