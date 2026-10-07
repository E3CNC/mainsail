import { describe, expect, it } from 'vitest'
import { getters } from '@/store/server/history/getters'
import { getDefaultState } from '@/store/server/history/index'
import type { ServerHistoryState } from '@/store/server/history/types'
import type { RootState } from '@/store/types'

function state(overrides = {}): ServerHistoryState {
    return { ...getDefaultState(), ...overrides }
}

const job = (id: string, status = 'completed', duration = 100, filament = 50) => ({
    job_id: id,
    status,
    filename: `${id}.gcode`,
    print_duration: duration,
    filament_used: filament,
    metadata: {},
})

function jobsState() {
    return state({ jobs: [job('1', 'completed', 100, 50), job('2', 'error', 200, 70), job('3', 'completed', 300, 30)] })
}

describe('server/history/getters', () => {
    it('aggregates time, filament and counts', () => {
        const s = jobsState()
        const none = undefined as never
        expect(getters.getTotalPrintTime(s, none, none, none)).toBe(600)
        expect(getters.getTotalCompletedPrintTime(s, none, none, none)).toBe(400)
        expect(getters.getLongestPrintTime(s, none, none, none)).toBe(300)
        expect(getters.getTotalFilamentUsed(s, none, none, none)).toBe(150)
        expect(getters.getTotalJobsCount(s, none, none, none)).toBe(3)
        expect(getters.getTotalCompletedJobsCount(s, none, none, none)).toBe(2)
    })

    it('getAvgPrintTime averages completed jobs', () => {
        const s = jobsState()
        const moduleGetters = { getTotalCompletedPrintTime: 400, getTotalCompletedJobsCount: 2 }
        expect(getters.getAvgPrintTime(s, moduleGetters, undefined as never, undefined as never)).toBe(200)
        expect(
            getters.getAvgPrintTime(
                s,
                { getTotalCompletedPrintTime: 0, getTotalCompletedJobsCount: 0 },
                undefined as never,
                undefined as never
            )
        ).toBe(0)
    })

    it('getPrintStatus and getPrintJobById look up by id', () => {
        const s = jobsState()
        const none = undefined as never
        expect(getters.getPrintStatus(s, none, none, none)('2')).toBe('error')
        expect(getters.getPrintStatus(s, none, none, none)('missing')).toBe('')
        expect(getters.getPrintStatus(state(), none, none, none)('1')).toBe('')
        expect(getters.getPrintJobById(s, none, none, none)('1')?.job_id).toBe('1')
        expect(getters.getPrintJobById(state(), none, none, none)('1')).toBeUndefined()
    })

    it('getPrintJobsForGcodes matches uuid, then metadata, then job id', () => {
        const withMeta = state({
            jobs: [
                { ...job('1'), metadata: { uuid: 'u1', size: 100, modified: 10 } },
                { ...job('2'), metadata: { uuid: 'u2', size: 200, modified: 20 } },
            ],
        })
        const none = undefined as never
        expect(getters.getPrintJobsForGcodes(withMeta, none, none, none)('x', 0, 0, 'u1', null)).toHaveLength(1)
        expect(getters.getPrintJobsForGcodes(withMeta, none, none, none)('x', 10000, 100, null, null)).toHaveLength(1)
        expect(getters.getPrintJobsForGcodes(state(), none, none, none)('x', 0, 0, null, null)).toEqual([])
    })

    it('getPrintStatusByFilename matches filename and modified', () => {
        const withMeta = state({ jobs: [{ ...job('1'), metadata: { modified: 10 } }] })
        const none = undefined as never
        expect(getters.getPrintStatusByFilename(withMeta, none, none, none)('1.gcode', 10000)).toBe('completed')
        expect(getters.getPrintStatusByFilename(withMeta, none, none, none)('other.gcode', 10000)).toBe('')
        expect(getters.getPrintStatusByFilename(state(), none, none, none)('1.gcode', 10000)).toBe('')
    })

    it('getFilteredJobList hides configured statuses', () => {
        const s = jobsState()
        const rs = { gui: { view: { history: { hidePrintStatus: ['error'] } } } } as unknown as RootState
        const filtered = getters.getFilteredJobList(s, {}, rs, undefined as never)
        expect(filtered.map((j: { job_id: string }) => j.job_id)).toEqual(['1', '3'])
    })
})
