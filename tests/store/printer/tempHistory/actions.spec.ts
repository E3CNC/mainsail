import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { actions } from '@/store/printer/tempHistory/actions'
import type { RootState } from '@/store/types'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { source: [], series: [], timeLastUpdate: null, updateSourceInterval: null },
        rootState: { printer: {} },
        rootGetters: {
            'printer/getAvailableHeaters': [],
            'printer/getAvailableSensors': [],
            'printer/getAvailableMonitors': [],
            'printer/tempHistory/getTemperatureStoreSize': 1200,
        },
        ...overrides,
    }
}

describe('printer/tempHistory/actions', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('reset clears the interval and commits reset', () => {
        const c = ctx({ state: { updateSourceInterval: 123 } })
        const clear = vi.spyOn(global, 'clearInterval')
        actions.reset(c as never)
        expect(clear).toHaveBeenCalledWith(123)
        expect(c.commit).toHaveBeenCalledWith('reset')
        clear.mockRestore()
    })

    it('init without payload removes the init module', () => {
        const c = ctx()
        actions.init(c as never, undefined)
        expect(c.dispatch).toHaveBeenCalledWith('reset')
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'printer/initTempHistory', {
            root: true,
        })
    })

    it('init builds source and series from the payload', () => {
        const c = ctx({
            rootGetters: {
                'printer/getAvailableHeaters': ['heater_bed'],
                'printer/getAvailableSensors': ['heater_bed'],
                'printer/getAvailableMonitors': [],
                'printer/tempHistory/getTemperatureStoreSize': 3,
                'gui/getDatasetValue': () => null,
            },
        })
        actions.init(c as never, {
            heater_bed: { temperatures: [20, 21, 22], targets: [60, 60, 60] },
        })
        expect(c.commit).toHaveBeenCalledWith('setInitSource', expect.any(Array))
        const source = c.commit.mock.calls.find(([name]) => name === 'setInitSource')?.[1] as unknown[]
        expect(source).toHaveLength(3)
        expect(c.commit).toHaveBeenCalledWith('setInitSeries', expect.any(Array))
        const series = c.commit.mock.calls.find(([name]) => name === 'setInitSeries')?.[1] as {
            name: string
        }[]
        expect(series.map((s) => s.name)).toEqual(['heater_bed-temperature', 'heater_bed-target'])
        expect(c.commit).toHaveBeenCalledWith('setUpdateSourceInterval', expect.anything())
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'printer/initTempHistory', {
            root: true,
        })
    })

    it('init drops sensors that no longer exist', () => {
        const c = ctx({
            rootGetters: {
                'printer/getAvailableHeaters': [],
                'printer/getAvailableSensors': ['extruder'],
                'printer/getAvailableMonitors': [],
                'printer/tempHistory/getTemperatureStoreSize': 2,
                'gui/getDatasetValue': () => 'red',
            },
        })
        actions.init(c as never, {
            extruder: { temperatures: [200, 201] },
            ghost: { temperatures: [1, 2] },
        })
        const series = c.commit.mock.calls.find(([name]) => name === 'setInitSeries')?.[1] as {
            name: string
        }[]
        expect(series.map((s) => s.name)).toEqual(['extruder-temperature'])
    })

    it('updateSource appends a rounded entry for known objects', async () => {
        const c = ctx({
            state: { source: [], series: [] },
            rootState: {
                printer: { extruder: { temperature: 200.05, power: 0.51234, unknown_attr: 1 } },
            } as unknown as RootState,
            rootGetters: {
                'printer/getAvailableSensors': ['extruder'],
                'printer/getAvailableMonitors': [],
                'printer/tempHistory/getTemperatureStoreSize': 1200,
            },
        })
        await actions.updateSource(c as never)
        expect(c.commit).toHaveBeenCalledWith(
            'addToSource',
            expect.objectContaining({
                maxHistory: 1200,
                data: expect.objectContaining({
                    'extruder-temperature': 200.1,
                    'extruder-power': 0.512,
                }),
            })
        )
    })

    it('updateSource skips when the last entry is from the same second', async () => {
        const c = ctx({
            state: { source: [{ date: new Date() }], series: [] },
            rootGetters: {
                'printer/getAvailableSensors': ['extruder'],
                'printer/getAvailableMonitors': [],
                'printer/tempHistory/getTemperatureStoreSize': 1200,
            },
        })
        await actions.updateSource(c as never)
        expect(c.commit).not.toHaveBeenCalled()
    })

    it('setColor commits through', () => {
        const c = ctx()
        actions.setColor(c as never, { name: 'extruder', value: 'blue' })
        expect(c.commit).toHaveBeenCalledWith('setColor', { name: 'extruder', value: 'blue' })
    })
})
