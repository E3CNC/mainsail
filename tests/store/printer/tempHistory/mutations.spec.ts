import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/printer/tempHistory/mutations'
import type { PrinterTempHistoryState } from '@/store/printer/tempHistory/types'

function serie(name: string) {
    return {
        name,
        color: 'red',
        lineStyle: { color: 'red' },
        emphasis: { lineStyle: { color: 'red' } },
    }
}

function state(overrides = {}): PrinterTempHistoryState {
    return {
        source: [],
        series: [],
        timeLastUpdate: null,
        updateSourceInterval: null,
        ...overrides,
    } as PrinterTempHistoryState
}

describe('printer/tempHistory/mutations', () => {
    it('reset restores the default state', () => {
        const s = state({ source: [{ date: new Date() }], series: [serie('a')] })
        mutations.reset(s)
        expect(s.source).toEqual([])
        expect(s.series).toEqual([])
    })

    it('setInitSource / setInitSeries replace wholesale', () => {
        const s = state()
        const source = [{ date: new Date() }]
        mutations.setInitSource(s, source)
        expect(s.source).toBe(source)
        const series = [serie('extruder-temperature')]
        mutations.setInitSeries(s, series)
        expect(s.series).toBe(series)
    })

    it('addToSource appends and trims to maxHistory', () => {
        const s = state({ source: [{ n: 1 }, { n: 2 }] })
        mutations.addToSource(s, { data: { n: 3 }, maxHistory: 3 })
        expect(s.source).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }])
        mutations.addToSource(s, { data: { n: 4 }, maxHistory: 3 })
        expect(s.source).toEqual([{ n: 2 }, { n: 3 }, { n: 4 }])
    })

    it('saveLastDate and setUpdateSourceInterval store their payload', () => {
        const s = state()
        mutations.saveLastDate(s, 12345)
        expect(s.timeLastUpdate).toBe(12345)
        mutations.setUpdateSourceInterval(s, 99)
        expect(s.updateSourceInterval).toBe(99)
    })

    it('setColor recolors matching series and their target area', () => {
        const s = state({
            series: [
                { ...serie('extruder-temperature') },
                {
                    ...serie('extruder-target'),
                    areaStyle: { color: 'red' },
                    emphasis: { lineStyle: { color: 'red' }, areaStyle: { color: 'red' } },
                },
                { ...serie('heater_bed-temperature') },
            ],
        })
        mutations.setColor(s, { name: 'extruder', value: 'blue' })
        expect(s.series[0].color).toBe('blue')
        expect(s.series[0].lineStyle.color).toBe('blue')
        expect(s.series[1].areaStyle?.color).toBe('blue')
        expect(s.series[1].emphasis.areaStyle?.color).toBe('blue')
        expect(s.series[2].color).toBe('red')
    })
})
