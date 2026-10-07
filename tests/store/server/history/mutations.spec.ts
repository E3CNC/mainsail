import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/server/history/mutations'
import { getDefaultState } from '@/store/server/history/index'
import type { ServerHistoryState } from '@/store/server/history/types'

function state(overrides = {}): ServerHistoryState {
    return { ...getDefaultState(), ...overrides }
}

const job = (id: string, status = 'completed') => ({ job_id: id, status, filename: `${id}.gcode` })

describe('server/history/mutations', () => {
    it('reset restores defaults', () => {
        const s = state({ jobs: [job('1')] })
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('resetJobs clears the list, setTotals stores totals', () => {
        const s = state({ jobs: [job('1')] })
        mutations.resetJobs(s)
        expect(s.jobs).toEqual([])
        mutations.setTotals(s, { total: 5 } as never)
        expect(s.job_totals).toEqual({ total: 5 })
        mutations.setAuxiliaryTotals(s, [{ name: 'filament' }] as never)
        expect(s.auxiliary_totals).toEqual([{ name: 'filament' }])
    })

    it('addJob appends, updateJob replaces, destroyJob removes', () => {
        const s = state()
        mutations.addJob(s, job('1') as never)
        mutations.addJob(s, job('2') as never)
        expect(s.jobs).toHaveLength(2)
        mutations.updateJob(s, { ...job('1'), status: 'error' } as never)
        expect(s.jobs[0].status).toBe('error')
        mutations.updateJob(s, { ...job('9'), status: 'error' } as never)
        expect(s.jobs).toHaveLength(2)
        mutations.destroyJob(s, '2')
        expect(s.jobs.map((j) => j.job_id)).toEqual(['1'])
        mutations.destroyJob(s, 'missing')
        expect(s.jobs).toHaveLength(1)
    })

    it('setHistoryNotes attaches notes to matching jobs', () => {
        const s = state({ jobs: [job('1')] })
        mutations.setHistoryNotes(s, { job_id: '1', text: 'good print' })
        expect(s.jobs[0].note).toBe('good print')
        mutations.setHistoryNotes(s, { job_id: 'missing', text: 'x' })
    })

    it('setAllLoaded flags completion', () => {
        const s = state()
        mutations.setAllLoaded(s)
        expect(s.all_loaded).toBe(true)
    })
})
