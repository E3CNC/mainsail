import { GetterTree } from 'vuex'
import type { ServerJobQueueState, ServerJobQueueStateJob } from '@/store/server/jobQueue/types'
import type { FileStateFile } from '@/store/files/types'
import { RootState } from '@/store/types'
import { getSocket } from '@/store/runtime'

interface JobQueueGettersProxy {
    [key: string]: unknown
}

interface JobQueueRootGetters {
    'files/getFile': (path: string) => (FileStateFile & { metadataPulled?: boolean }) | undefined
}

export const getters: GetterTree<ServerJobQueueState, RootState> = {
    getJobs: (
        state: ServerJobQueueState,
        getters: JobQueueGettersProxy,
        rootState: RootState,
        rootGetters: JobQueueRootGetters
    ) => {
        const jobs: ServerJobQueueStateJob[] = []

        state.queued_jobs.forEach((queuedJob) => {
            const job = { ...queuedJob }

            if (jobs.length && jobs[jobs.length - 1].filename === job.filename) {
                jobs[jobs.length - 1].combinedIds?.push(job.job_id)
                return
            }

            const file = rootGetters['files/getFile']('gcodes/' + job.filename)
            if (!file?.metadataPulled)
                getSocket().emit('server.files.metadata', { filename: job.filename }, { action: 'files/getMetadata' })
            job.metadata = file
            job.combinedIds = []

            jobs.push(job)
        })

        return jobs
    },

    getJobsCount: (state: ServerJobQueueState) => {
        return state.queued_jobs.length
    },
}
