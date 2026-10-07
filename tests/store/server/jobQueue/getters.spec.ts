import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit }),
}))

import { getters } from '@/store/server/jobQueue/getters'
import { getDefaultState } from '@/store/server/jobQueue/index'

describe('server/jobQueue/getters', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
    })

    it('getJobsCount returns the queue length', () => {
        const s = { ...getDefaultState(), queued_jobs: [{}, {}] }
        expect(getters.getJobsCount(s as never, undefined as never, undefined as never, undefined as never)).toBe(2)
    })

    it('getJobs attaches metadata and combines repeated filenames', () => {
        const s = {
            ...getDefaultState(),
            queued_jobs: [
                { job_id: 'a', filename: 'benchy.gcode' },
                { job_id: 'b', filename: 'benchy.gcode' },
                { job_id: 'c', filename: 'cube.gcode' },
            ],
        }
        const rootGetters = {
            'files/getFile': () => ({ filename: 'x', metadataPulled: true }),
        }
        const jobs = getters.getJobs(s as never, {}, undefined as never, rootGetters as never)
        expect(jobs).toHaveLength(2)
        expect(jobs[0].combinedIds).toEqual(['b'])
        expect(jobs[1].combinedIds).toEqual([])
        expect(mocks.emit).not.toHaveBeenCalled()
    })

    it('getJobs requests metadata for files without it', () => {
        const s = { ...getDefaultState(), queued_jobs: [{ job_id: 'a', filename: 'benchy.gcode' }] }
        const rootGetters = { 'files/getFile': () => undefined }
        const jobs = getters.getJobs(s as never, {}, undefined as never, rootGetters as never)
        expect(jobs[0].metadata).toBeUndefined()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.metadata',
            { filename: 'benchy.gcode' },
            { action: 'files/getMetadata' }
        )
    })
})
