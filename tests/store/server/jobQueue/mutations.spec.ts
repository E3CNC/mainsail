import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/server/jobQueue/mutations'
import { getDefaultState } from '@/store/server/jobQueue/index'

describe('server/jobQueue/mutations', () => {
    it('reset restores defaults', () => {
        const s = { ...getDefaultState(), queued_jobs: [{ job_id: '1' }] } as never
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('setQueuedJobs and setQueueState store their payload', () => {
        const s = getDefaultState()
        mutations.setQueuedJobs(s, [{ job_id: '1' }] as never)
        expect(s.queued_jobs).toEqual([{ job_id: '1' }])
        mutations.setQueueState(s, 'running')
        expect(s.queue_state).toBe('running')
    })
})
