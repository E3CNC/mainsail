import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit }),
}))

import { actions } from '@/store/server/history/actions'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { jobs: [] },
        rootState: {},
        ...overrides,
    }
}

const job = (id: string) => ({ job_id: id, status: 'completed' })

describe('server/history/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
    })

    it('init requests the list and totals', () => {
        actions.init({} as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.history.list',
            { start: 0, limit: 50, max: 100 },
            { action: 'server/history/getHistory' }
        )
        expect(mocks.emit).toHaveBeenCalledWith('server.history.totals', {}, { action: 'server/history/getTotals' })
    })

    it('getTotals commits totals and auxiliary totals', () => {
        const c = ctx()
        actions.getTotals(c as never, { job_totals: { total: 1 }, auxiliary_totals: [{ n: 1 }] } as never)
        expect(c.commit).toHaveBeenCalledWith('setTotals', { total: 1 })
        expect(c.commit).toHaveBeenCalledWith('setAuxiliaryTotals', [{ n: 1 }])
        const c2 = ctx()
        actions.getTotals(c2 as never, { job_totals: {} } as never)
        expect(c2.commit).not.toHaveBeenCalledWith('setAuxiliaryTotals', expect.anything())
    })

    it('getHistory resets on first page and adds new jobs', async () => {
        const c = ctx()
        await actions.getHistory(c as never, {
            requestParams: { start: 0, limit: 2 },
            jobs: [job('1'), job('2')],
        })
        expect(c.commit).toHaveBeenCalledWith('resetJobs')
        expect(c.commit).toHaveBeenCalledWith('addJob', job('1'))
        // full page -> requests the next page and stops
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.history.list',
            { start: 2, limit: 2, max: null },
            { action: 'server/history/getHistory' }
        )
        expect(c.dispatch).not.toHaveBeenCalledWith('loadHistoryNotes')
    })

    it('getHistory skips duplicates and finishes short pages', async () => {
        const c = ctx({ state: { jobs: [job('1')] } })
        await actions.getHistory(c as never, {
            requestParams: { start: 0, limit: 50 },
            jobs: [job('1'), job('2')],
        })
        expect(c.commit).toHaveBeenCalledTimes(3) // resetJobs + addJob(2) + setAllLoaded
        expect(c.commit).toHaveBeenCalledWith('setAllLoaded')
        expect(c.dispatch).toHaveBeenCalledWith('loadHistoryNotes')
    })

    it('loadHistoryNotes branches on the history_notes namespace', () => {
        const withNs = ctx({ rootState: { server: { dbNamespaces: ['history_notes'] } } })
        actions.loadHistoryNotes(withNs as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.get_item',
            { namespace: 'history_notes' },
            { action: 'server/history/initHistoryNotes' }
        )
        const withoutNs = ctx({ rootState: { server: { dbNamespaces: [] } } })
        actions.loadHistoryNotes(withoutNs as never)
        expect(withoutNs.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/history/init', {
            root: true,
        })
    })

    it('initHistoryNotes stores each note', async () => {
        const c = ctx()
        await actions.initHistoryNotes(c as never, { value: { j1: { text: 'nice' } } })
        expect(c.commit).toHaveBeenCalledWith('setHistoryNotes', { job_id: 'j1', text: 'nice' })
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/history/init', { root: true })
    })

    it('getChanged adds, updates and refreshes totals', () => {
        const c = ctx()
        actions.getChanged(c as never, { action: 'added', job: job('1') } as never)
        expect(c.commit).toHaveBeenCalledWith('addJob', job('1'))
        actions.getChanged(c as never, { action: 'finished', job: job('1') } as never)
        expect(c.commit).toHaveBeenCalledWith('updateJob', job('1'))
        expect(mocks.emit).toHaveBeenCalledWith('server.history.totals', {}, { action: 'server/history/getTotals' })
    })

    it('getDeletedJobs destroys listed jobs', () => {
        const c = ctx()
        actions.getDeletedJobs(c as never, { deleted_jobs: ['a', 'b'] })
        expect(c.commit).toHaveBeenCalledWith('destroyJob', 'a')
        expect(c.commit).toHaveBeenCalledWith('destroyJob', 'b')
        actions.getDeletedJobs(c as never, {})
    })

    it('saveHistoryNote posts and commits', () => {
        const c = ctx()
        actions.saveHistoryNote(c as never, { job_id: 'j1', note: 'nice' })
        expect(mocks.emit).toHaveBeenCalledWith('server.database.post_item', {
            namespace: 'history_notes',
            key: 'j1',
            value: { text: 'nice' },
        })
        expect(c.commit).toHaveBeenCalledWith('setHistoryNotes', { job_id: 'j1', text: 'nice' })
    })
})
