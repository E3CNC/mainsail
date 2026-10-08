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

    it('init pads short datasets and skips unknown attrs', () => {
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
            heater_bed: { temperatures: [22], unknown: [1] },
        })
        const source = c.commit.mock.calls.find(([name]) => name === 'setInitSource')?.[1] as Record<string, unknown>[]
        expect(source).toHaveLength(3)
        expect(source[0]).toHaveProperty('heater_bed-temperature', null)
        expect(source[2]).toHaveProperty('heater_bed-temperature', 22)
        expect(source[0]).not.toHaveProperty('heater_bed-unknown')
    })

    it('init adds missing heaters, fans and skips underscore sensors', () => {
        const c = ctx({
            rootGetters: {
                'printer/getAvailableHeaters': ['heater_bed'],
                'printer/getAvailableSensors': ['heater_bed', 'temperature_fan fan', 'temperature_sensor _hidden'],
                'printer/getAvailableMonitors': ['mcu_temp'],
                'printer/tempHistory/getTemperatureStoreSize': 2,
                'gui/getDatasetValue': () => null,
            },
        })
        actions.init(c as never, {
            requestParams: { id: 1 },
            heater_bed: { temperatures: [20, 21] },
        })
        const series = c.commit.mock.calls.find(([name]) => name === 'setInitSeries')?.[1] as { name: string }[]
        const names = series.map((s) => s.name)
        expect(names).toContain('heater_bed-temperature')
        expect(names).toContain('temperature_fan fan-temperature')
        expect(names).toContain('temperature_fan fan-target')
        expect(names).toContain('temperature_fan fan-speed')
        expect(names).toContain('mcu_temp-temperature')
        expect(names.some((n) => n.includes('_hidden'))).toBe(false)
    })

    it('init drops spaced sensors that no longer exist and underscore names', () => {
        const c = ctx({
            rootGetters: {
                'printer/getAvailableHeaters': [],
                'printer/getAvailableSensors': ['extruder'],
                'printer/getAvailableMonitors': [],
                'printer/tempHistory/getTemperatureStoreSize': 2,
                'gui/getDatasetValue': () => null,
            },
        })
        actions.init(c as never, {
            'temperature_sensor ghost': { temperatures: [1, 2] },
            'extruder _hidden': { temperatures: [1, 2] },
            extruder: { temperatures: [200, 201] },
        })
        const series = c.commit.mock.calls.find(([name]) => name === 'setInitSeries')?.[1] as { name: string }[]
        expect(series.map((s) => s.name)).toEqual(['extruder-temperature'])
    })

    it('init styles percent datasets on a second axis', () => {
        const c = ctx({
            rootGetters: {
                'printer/getAvailableHeaters': ['extruder'],
                'printer/getAvailableSensors': ['extruder'],
                'printer/getAvailableMonitors': [],
                'printer/tempHistory/getTemperatureStoreSize': 2,
                'gui/getDatasetValue': () => null,
            },
        })
        actions.init(c as never, {
            extruder: { temperatures: [200, 201], powers: [0.5, 0.6], targets: [210, 210] },
        })
        const series = c.commit.mock.calls.find(([name]) => name === 'setInitSeries')?.[1] as {
            name: string
            yAxisIndex: number
            lineStyle: { type?: string }
        }[]
        const power = series.find((s) => s.name === 'extruder-power')
        expect(power?.yAxisIndex).toBe(1)
        expect(power?.lineStyle.type).toBe('dotted')
        const target = series.find((s) => s.name === 'extruder-target')
        expect(target?.yAxisIndex).toBe(0)
    })

    it('init uses heater_bed, chamber and random color fallbacks', () => {
        const mk = (size: number) => ({
            rootGetters: {
                'printer/getAvailableHeaters': [],
                'printer/getAvailableSensors': ['heater_bed', 'temperature_sensor chamber'],
                'printer/getAvailableMonitors': [],
                'printer/tempHistory/getTemperatureStoreSize': size,
                'gui/getDatasetValue': () => null,
            },
        })
        const c = ctx(mk(2))
        actions.init(c as never, {
            heater_bed: { temperatures: [20, 21] },
            'temperature_sensor chamber': { temperatures: [30, 31] },
        })
        const series = c.commit.mock.calls.find(([name]) => name === 'setInitSeries')?.[1] as {
            name: string
            color: string
        }[]
        expect(series.find((s) => s.name === 'heater_bed-temperature')?.color).toBe('#2196F3')
        expect(series.find((s) => s.name === 'temperature_sensor chamber-temperature')?.color).toBe('#4CAF50')
    })

    it('init interval dispatches updateSource', () => {
        const c = ctx({
            rootGetters: {
                'printer/getAvailableHeaters': ['extruder'],
                'printer/getAvailableSensors': ['extruder'],
                'printer/getAvailableMonitors': [],
                'printer/tempHistory/getTemperatureStoreSize': 2,
                'gui/getDatasetValue': () => 'red',
            },
        })
        actions.init(c as never, { extruder: { temperatures: [200, 201] } })
        expect(c.commit).toHaveBeenCalledWith('setUpdateSourceInterval', expect.anything())
        c.dispatch.mockClear()
        vi.advanceTimersByTime(1000)
        expect(c.dispatch).toHaveBeenCalledWith('updateSource')
    })

    it('updateSource skips unknown printer objects and null values', async () => {
        const c = ctx({
            state: { source: [], series: [] },
            rootState: {
                printer: {
                    extruder: { temperature: 200, power: null },
                    ghost: { temperature: 10 },
                },
            } as unknown as RootState,
            rootGetters: {
                'printer/getAvailableSensors': ['extruder', 'ghost', 'missing'],
                'printer/getAvailableMonitors': [],
                'printer/tempHistory/getTemperatureStoreSize': 1200,
            },
        })
        await actions.updateSource(c as never)
        const payload = c.commit.mock.calls.find(([name]) => name === 'addToSource')?.[1] as {
            data: Record<string, unknown>
        }
        expect(payload.data['extruder-temperature']).toBe(200)
        expect(payload.data['extruder-power']).toBe(0)
        expect(payload.data['ghost-temperature']).toBeDefined()
        expect('missing-temperature' in payload.data).toBe(false)
    })

    it('updateSource no-ops with no sensors', async () => {
        const c = ctx({
            rootGetters: {
                'printer/getAvailableSensors': [],
                'printer/getAvailableMonitors': [],
                'printer/tempHistory/getTemperatureStoreSize': 1200,
            },
        })
        await actions.updateSource(c as never)
        expect(c.commit).not.toHaveBeenCalled()
    })
})
