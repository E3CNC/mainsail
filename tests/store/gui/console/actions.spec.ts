import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/gui/console/actions'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { consolefilters: {} },
        rootState: {},
        rootGetters: {},
        getters: {},
        ...overrides,
    }
}

describe('gui/console/actions', () => {
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

    it('clear emits db post, commits clear and root commits', () => {
        const c = ctx()
        actions.clear(c as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ namespace: 'mainsail', key: 'console.cleared_since' })
        )
        expect(c.commit).toHaveBeenCalledWith('clear', expect.objectContaining({ cleared_since: expect.any(Number) }))
        expect(c.commit).toHaveBeenCalledWith('server/clearGcodeStore', {}, { root: true })
        expect(c.commit).toHaveBeenCalledWith('server/setConsoleClearedThisSession', {}, { root: true })
    })

    it('saveSetting proxies to gui/saveSetting with console prefix', () => {
        const c = ctx()
        actions.saveSetting(c as never, { name: 'autoscroll', value: false } as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'gui/saveSetting',
            { name: 'console.autoscroll', value: false },
            { root: true }
        )
    })

    it('filterUpload emits db post for the filter id', () => {
        const c = ctx()
        const value = { name: 'f', bool: true, regex: 'x' }
        actions.filterUpload(c as never, { id: 'abc', value } as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ namespace: 'mainsail', key: 'console.consolefilters.abc' })
        )
    })

    it('filterStore commits with a generated id and uploads current state', () => {
        const values = { name: 'f', bool: true, regex: 'x' }
        const c = ctx({ state: { consolefilters: { stored: values } } })
        actions.filterStore(c as never, { values } as never)
        expect(c.commit).toHaveBeenCalledWith('filterStore', expect.objectContaining({ values }))
        const id = (c.commit as ReturnType<typeof vi.fn>).mock.calls[0][1].id as string
        expect(typeof id).toBe('string')
        expect(c.dispatch).toHaveBeenCalledWith('filterUpload', expect.objectContaining({ id }))
    })

    it('filterUpdate commits and uploads', () => {
        const stored = { name: 'f', bool: true, regex: 'x' }
        const c = ctx({ state: { consolefilters: { abc: stored } } })
        actions.filterUpdate(c as never, { id: 'abc', values: { name: 'g' } } as never)
        expect(c.commit).toHaveBeenCalledWith('filterUpdate', { id: 'abc', values: { name: 'g' } })
        expect(c.dispatch).toHaveBeenCalledWith('filterUpload', { id: 'abc', value: stored })
    })

    it('filterDelete commits and emits db delete', () => {
        const c = ctx()
        actions.filterDelete(c as never, 'abc' as never)
        expect(c.commit).toHaveBeenCalledWith('filterDelete', 'abc')
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.delete_item',
            expect.objectContaining({ key: 'console.consolefilters.abc' })
        )
    })
})
