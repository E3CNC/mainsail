import { describe, expect, it } from 'vitest'
import { getters } from '@/store/printer/tempHistory/getters'
import type { PrinterTempHistoryState } from '@/store/printer/tempHistory/types'
import type { RootState } from '@/store/types'

function state(overrides = {}): PrinterTempHistoryState {
    return {
        source: [],
        series: [{ name: 'extruder-temperature' }, { name: 'extruder-target' }],
        timeLastUpdate: null,
        updateSourceInterval: null,
        ...overrides,
    } as unknown as PrinterTempHistoryState
}

function rootState(overrides = {}): RootState {
    return {
        printer: {
            heaters: { available_heaters: [], available_sensors: [], available_monitors: [] },
            configfile: { settings: {} },
        },
        gui: { view: { tempchart: { datasetSettings: {} } } },
        ...overrides,
    } as unknown as RootState
}

describe('printer/tempHistory/getters', () => {
    it('getSeries finds a serie by name', () => {
        expect(
            getters.getSeries(state(), undefined as never, undefined as never, undefined as never)('extruder-target')
        ).toBeTruthy()
        expect(
            getters.getSeries(state(), undefined as never, undefined as never, undefined as never)('missing')
        ).toBeUndefined()
    })

    it('getSerieNames strips the dataset prefix', () => {
        const names = getters.getSerieNames(
            state(),
            undefined as never,
            undefined as never,
            undefined as never
        )('extruder')
        expect(names).toEqual(['temperature', 'target'])
    })

    it('getDatasetColor reads the temperature serie color', () => {
        const s = state()
        s.series = [
            { name: 'extruder-temperature', lineStyle: { color: 'green', width: 2, opacity: 0.9 } },
        ] as unknown as PrinterTempHistoryState['series']
        const moduleGetters = {
            getSeries: getters.getSeries(s, undefined as never, undefined as never, undefined as never),
        }
        expect(getters.getDatasetColor(s, moduleGetters, undefined as never, undefined as never)('extruder')).toBe(
            'green'
        )
        expect(getters.getDatasetColor(s, moduleGetters, undefined as never, undefined as never)('missing')).toBeNull()
    })

    it('getBoolDisplayPwmAxis detects power/speed legends', () => {
        const withPower = { 'extruder-power': true, 'extruder-temperature': false }
        expect(
            getters.getBoolDisplayPwmAxis(
                state(),
                { getSelectedLegends: withPower },
                undefined as never,
                undefined as never
            )
        ).toBe(true)
        const without = { 'extruder-temperature': true }
        expect(
            getters.getBoolDisplayPwmAxis(
                state(),
                { getSelectedLegends: without },
                undefined as never,
                undefined as never
            )
        ).toBe(false)
    })

    it('getAvg averages recent numeric values, scaling percents', () => {
        const now = new Date()
        const s = state({
            source: [
                { date: new Date(now.getTime() - 1000), extruder: 200, 'extruder-power': 0.5 },
                { date: new Date(now.getTime() - 2000), extruder: 210, 'extruder-power': 0.7 },
                { date: new Date(now.getTime() - 1000 * 3600), extruder: 20, 'extruder-power': 0.1 },
            ],
        })
        const avg = getters.getAvg(s, undefined as never, undefined as never, undefined as never)
        expect(avg('extruder', 'temperature')).toBe(205)
        expect(avg('extruder', 'power')).toBe(60)
        expect(avg('extruder', 'missing')).toBe(0)
    })

    it('getAvgPower / getAvgSpeed delegate to getAvg', () => {
        const avg = vi_getAvg()
        expect(getters.getAvgPower(state(), { getAvg: avg }, undefined as never, undefined as never)('extruder')).toBe(
            'power!'
        )
        expect(getters.getAvgSpeed(state(), { getAvg: avg }, undefined as never, undefined as never)('extruder')).toBe(
            'speed!'
        )
    })

    it('getHostMcuSensors filters to mcu/host sensors only', () => {
        const rs = rootState({
            printer: {
                heaters: {
                    available_heaters: ['extruder'],
                    available_sensors: ['extruder', 'temperature_sensor chamber', 'mcu_temp', 'temperature_fan fan'],
                },
                configfile: {
                    settings: {
                        'temperature_sensor chamber': { sensor_type: 'temperature_host' },
                        mcu_temp: { sensor_type: 'temperature_mcu' },
                        temperature_fan_fan: { sensor_type: 'temperature_fan' },
                    },
                },
            },
        })
        expect(getters.getHostMcuSensors(state(), undefined as never, rs, undefined as never)).toEqual([
            'temperature_sensor chamber',
            'mcu_temp',
        ])
    })

    it('getSelectedLegends combines view settings with serie defaults', () => {
        const s = state()
        const rs = rootState({
            printer: {
                heaters: {
                    available_sensors: ['extruder'],
                    available_monitors: [],
                },
            },
            gui: {
                view: {
                    tempchart: {
                        datasetSettings: { extruder: { temperature: false } },
                    },
                },
            },
        })
        const selected = getters.getSelectedLegends(s, {}, rs, undefined as never)
        expect(selected['extruder-temperature']).toBe(false)
        // target is a non-percent serie -> visible by default
        expect(selected['extruder-target']).toBe(true)
    })

    it('getTemperatureStoreSize falls back to 1200', () => {
        const rootGetters = { 'server/getConfig': () => undefined }
        expect(getters.getTemperatureStoreSize(state(), undefined as never, rootState(), rootGetters)).toBe(1200)
        const withSize = { 'server/getConfig': () => 600 }
        expect(getters.getTemperatureStoreSize(state(), undefined as never, rootState(), withSize)).toBe(600)
    })
})

function vi_getAvg() {
    return (name: string, serie: string) => `${serie}!` as unknown as number
}
