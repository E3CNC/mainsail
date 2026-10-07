import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { state: Record<string, any> } = { state: {} }

vi.mock('vuex', () => ({
    useStore: () => store,
}))

vi.mock('@/plugins/i18n', () => ({
    default: { global: { te: () => false, t: (key: string) => key } },
}))

import { useHistoryStats } from '@/composables/useHistoryStats'

function defaultState() {
    return {
        gui: {
            view: {
                history: {
                    hidePrintStatus: [],
                    selectedJobs: [],
                },
            },
        },
        server: {
            history: {
                jobs: [
                    { filename: 'a.gcode', status: 'completed', filament_used: 100, total_duration: 60 },
                    { filename: 'b.gcode', status: 'completed', filament_used: 200, total_duration: 120 },
                    { filename: 'c.gcode', status: 'error', filament_used: 10, total_duration: 5 },
                ],
            },
            config: { config: {} },
        },
    }
}

describe('useHistoryStats', () => {
    beforeEach(() => {
        store.state = reactive(defaultState())
    })

    it('allPrintStati deduplicates job statuses', () => {
        expect(useHistoryStats('jobs').allPrintStati.value).toEqual(['completed', 'error'])
    })

    it('printStatusArray counts jobs and flags hidden statuses', () => {
        const arr = useHistoryStats('jobs').printStatusArray.value
        expect(arr.find((e) => e.name === 'completed')?.value).toBe(2)
        expect(arr.find((e) => e.name === 'error')?.value).toBe(1)
        expect(arr.every((e) => e.showInTable)).toBe(true)

        store.state.gui.view.history.hidePrintStatus = ['error']
        const arr2 = useHistoryStats('jobs').printStatusArray.value
        expect(arr2.find((e) => e.name === 'error')?.showInTable).toBe(false)
    })

    it('colors known statuses and falls back for unknown ones', () => {
        const arr = useHistoryStats('jobs').printStatusArray.value
        expect(arr.find((e) => e.name === 'completed')?.itemStyle.color).toContain('0.6)')
        expect(arr.find((e) => e.name === 'error')?.itemStyle.color).toContain('0.26')
    })

    it('filament chart sums filament per status', () => {
        const chart = useHistoryStats('filament').printStatusArrayChart.value
        expect(chart.find((e) => e.name === 'completed')?.value).toBe(300)
        expect(chart.find((e) => e.name === 'error')?.value).toBe(10)
    })

    it('time chart sums durations per status', () => {
        const chart = useHistoryStats('time').printStatusArrayChart.value
        expect(chart.find((e) => e.name === 'completed')?.value).toBe(180)
    })

    it('grouped chart merges small entries into Others', () => {
        store.state.server.history.jobs = [
            ...Array.from({ length: 100 }, (_, i) => ({
                filename: `p${i}.gcode`,
                status: 'completed',
                filament_used: 10,
                total_duration: 10,
            })),
            { filename: 'e1.gcode', status: 'error', filament_used: 1, total_duration: 1 },
            { filename: 'e2.gcode', status: 'cancelled', filament_used: 1, total_duration: 1 },
        ]
        const grouped = useHistoryStats('jobs').groupedPrintStatusArray.value
        const others = grouped.find((e) => e.name.includes('Others'))
        expect(others?.value).toBe(2)
        expect(grouped.find((e) => e.name === 'error')).toBeUndefined()
    })

    it('grouped chart keeps entries when fewer than two are small', () => {
        const grouped = useHistoryStats('jobs').groupedPrintStatusArray.value
        expect(grouped.find((e) => e.name.includes('Others'))).toBeUndefined()
        expect(grouped).toHaveLength(2)
    })
})
