import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit }),
}))

import { actions } from '@/store/server/jobQueue/actions'

function ctx(overrides = {}) {
    return { commit: vi.fn(), dispatch: vi.fn(), getters: {}, ...overrides }
}

describe('server/jobQueue/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
    })

    it('init requests the queue status', () => {
        actions.init({} as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.job_queue.status', {}, { action: 'server/jobQueue/getStatus' })
    })

    it('getEvent commits queue and state when present', () => {
        const c = ctx()
        actions.getEvent(c as never, { updated_queue: [{ job_id: '1' }], queue_state: 'ready' } as never)
        expect(c.commit).toHaveBeenCalledWith('setQueuedJobs', [{ job_id: '1' }])
        expect(c.commit).toHaveBeenCalledWith('setQueueState', 'ready')
        const c2 = ctx()
        actions.getEvent(c2 as never, { updated_queue: null } as never)
        expect(c2.commit).not.toHaveBeenCalled()
    })

    it('getStatus commits and clears the init module', async () => {
        const c = ctx()
        await actions.getStatus(c as never, { queued_jobs: [], queue_state: 'ready' })
        expect(c.commit).toHaveBeenCalledWith('setQueuedJobs', [])
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/jobQueue/init', { root: true })
    })

    it('addToQueue posts filenames', async () => {
        await actions.addToQueue({} as never, ['a.gcode'])
        expect(mocks.emit).toHaveBeenCalledWith('server.job_queue.post_job', { filenames: ['a.gcode'] })
    })

    it('changeCount resizes combinedIds and resends', () => {
        const c = ctx({ getters: { getJobs: [{ job_id: 'a', filename: 'a.gcode', combinedIds: [] }] } })
        actions.changeCount(c as never, { job_id: 'a', count: 3 })
        expect(c.dispatch).toHaveBeenCalledWith(
            'sendNewQueueList',
            expect.objectContaining({ jobs: [expect.objectContaining({ combinedIds: ['a', 'a'] })] })
        )
        actions.changeCount(c as never, { job_id: 'missing', count: 2 })
    })

    it('changePosition moves jobs and resends', () => {
        const c = ctx({ getters: { getJobs: [{ job_id: 'a' }, { job_id: 'b' }] } })
        actions.changePosition(c as never, { oldIndex: 1, newIndex: 0 })
        expect(c.dispatch).toHaveBeenCalledWith(
            'sendNewQueueList',
            expect.objectContaining({ jobs: [{ job_id: 'b' }, { job_id: 'a' }] })
        )
    })

    it('startByJobId moves the job to the front with printStart', () => {
        const c = ctx({ getters: { getJobs: [{ job_id: 'a' }, { job_id: 'b' }] } })
        actions.startByJobId(c as never, 'b')
        expect(c.dispatch).toHaveBeenCalledWith(
            'sendNewQueueList',
            expect.objectContaining({ jobs: [{ job_id: 'b' }, { job_id: 'a' }], printStart: true })
        )
        actions.startByJobId(c as never, 'missing')
    })

    it('sendNewQueueList expands combined jobs to filenames', () => {
        actions.sendNewQueueList(
            {} as never,
            {
                jobs: [
                    { filename: 'a.gcode', combinedIds: [] },
                    { filename: 'b.gcode', combinedIds: ['x'] },
                ],
            } as never
        )
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.job_queue.post_job',
            { filenames: ['a.gcode', 'b.gcode', 'b.gcode'], reset: true },
            {}
        )
    })

    it('delete, clear, start and pause emit', () => {
        actions.deleteFromQueue({} as never, ['a'])
        expect(mocks.emit).toHaveBeenCalledWith('server.job_queue.delete_job', { job_ids: ['a'] })
        actions.clearQueue({} as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.job_queue.delete_job', { all: true })
        actions.start({} as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.job_queue.start', {}, { loading: 'startJobqueue' })
        actions.pause({} as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.job_queue.pause', {}, { loading: 'pauseJobqueue' })
    })
})
