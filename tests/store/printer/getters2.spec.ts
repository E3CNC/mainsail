import { describe, expect, it, vi } from 'vitest'
import { getters } from '@/store/printer/getters'
import type { PrinterState } from '@/store/printer/types'
import type { RootState } from '@/store/types'

describe('printer/getPrintPercent', () => {
    const state = {} as PrinterState
    const moduleGetters = {
        getPrintPercentByFilepositionRelative: 'relative',
        getPrintPercentByFilepositionAbsolute: 'absolute',
        getPrintPercentBySlicer: 'slicer',
        getPrintPercentByFilament: 'filament',
    } as unknown as Record<string, string>

    const withMode = (mode?: string) => ({ gui: { general: { calcPrintProgress: mode } } }) as unknown as RootState

    it('selects the progress source from calcPrintProgress', () => {
        expect(getters.getPrintPercent(state, moduleGetters, withMode('file-relative'), {} as never)).toBe('relative')
        expect(getters.getPrintPercent(state, moduleGetters, withMode('file-absolute'), {} as never)).toBe('absolute')
        expect(getters.getPrintPercent(state, moduleGetters, withMode('slicer'), {} as never)).toBe('slicer')
        expect(getters.getPrintPercent(state, moduleGetters, withMode('filament'), {} as never)).toBe('filament')
    })

    it('falls back to file-relative for unknown or missing settings', () => {
        expect(getters.getPrintPercent(state, moduleGetters, withMode('bogus'), {} as never)).toBe('relative')
        expect(getters.getPrintPercent(state, moduleGetters, {} as RootState, {} as never)).toBe('relative')
        expect(getters.getPrintPercent(state, moduleGetters, undefined as never, {} as never)).toBe('relative')
    })
})

describe('printer/print percent variants', () => {
    const baseFile = (overrides = {}) =>
        ({
            current_file: {
                filename: 'a.gcode',
                gcode_start_byte: 100,
                gcode_end_byte: 1100,
                ...((overrides as { current_file?: object }).current_file ?? {}),
            },
            print_stats: { filename: 'a.gcode', ...((overrides as { print_stats?: object }).print_stats ?? {}) },
            virtual_sdcard: { file_position: 600, progress: 0.25 },
            display_status: { progress: 0.75 },
            ...overrides,
        }) as unknown as PrinterState

    it('getPrintPercentByFilepositionRelative computes relative progress', () => {
        expect(getters.getPrintPercentByFilepositionRelative(baseFile())).toBeCloseTo(0.5)
    })

    it('getPrintPercentByFilepositionRelative clamps to 0 and 1', () => {
        expect(
            getters.getPrintPercentByFilepositionRelative(
                baseFile({ virtual_sdcard: { file_position: 50, progress: 0.2 } })
            )
        ).toBe(0)
        expect(
            getters.getPrintPercentByFilepositionRelative(
                baseFile({ virtual_sdcard: { file_position: 100, progress: 0.2 } })
            )
        ).toBe(0)
        expect(
            getters.getPrintPercentByFilepositionRelative(
                baseFile({ virtual_sdcard: { file_position: 1100, progress: 0.2 } })
            )
        ).toBe(1)
        expect(
            getters.getPrintPercentByFilepositionRelative(
                baseFile({ virtual_sdcard: { file_position: 9999, progress: 0.2 } })
            )
        ).toBe(1)
    })

    it('getPrintPercentByFilepositionRelative falls back to sdcard progress', () => {
        // filename mismatch
        expect(getters.getPrintPercentByFilepositionRelative(baseFile({ print_stats: { filename: 'b.gcode' } }))).toBe(
            0.25
        )
        // missing filename
        expect(
            getters.getPrintPercentByFilepositionRelative(
                baseFile({ current_file: { filename: '', gcode_start_byte: 100, gcode_end_byte: 1100 } })
            )
        ).toBe(0.25)
        // missing start/end bytes
        expect(getters.getPrintPercentByFilepositionRelative(baseFile({ current_file: { filename: 'a.gcode' } }))).toBe(
            0.25
        )
        // no virtual_sdcard at all
        expect(getters.getPrintPercentByFilepositionRelative({} as PrinterState)).toBe(0)
    })

    it('getPrintPercentByFilepositionAbsolute returns progress or 0', () => {
        expect(getters.getPrintPercentByFilepositionAbsolute({ virtual_sdcard: { progress: 0.33 } } as never)).toBe(
            0.33
        )
        expect(getters.getPrintPercentByFilepositionAbsolute({} as PrinterState)).toBe(0)
    })

    it('getPrintPercentBySlicer returns display progress or 0', () => {
        expect(getters.getPrintPercentBySlicer({ display_status: { progress: 0.66 } } as never)).toBe(0.66)
        expect(getters.getPrintPercentBySlicer({} as PrinterState)).toBe(0)
    })

    it('getPrintPercentByFilament covers ratio, clamp, zero-total and fallback', () => {
        const withFilament = (filament_used: number | null, filament_total: number | null, progress = 0.1) =>
            ({
                print_stats: { filament_used },
                current_file: { filament_total },
                virtual_sdcard: { progress },
            }) as unknown as PrinterState

        expect(getters.getPrintPercentByFilament(withFilament(50, 100))).toBe(0.5)
        expect(getters.getPrintPercentByFilament(withFilament(150, 100))).toBe(1)
        expect(getters.getPrintPercentByFilament(withFilament(10, 0))).toBe(0)
        expect(getters.getPrintPercentByFilament(withFilament(null, 100))).toBe(0.1)
        expect(getters.getPrintPercentByFilament(withFilament(10, null))).toBe(0.1)
        expect(getters.getPrintPercentByFilament({} as PrinterState)).toBe(0)
    })
})

describe('printer/layers', () => {
    it('getPrintMaxLayers prefers total_layer, then layer_count, then computed, then 0', () => {
        expect(getters.getPrintMaxLayers({ print_stats: { info: { total_layer: 42 } } } as never)).toBe(42)
        expect(
            getters.getPrintMaxLayers({
                print_stats: { info: {} },
                current_file: { layer_count: 10 },
            } as never)
        ).toBe(10)
        expect(
            getters.getPrintMaxLayers({
                print_stats: {},
                current_file: { first_layer_height: 0.2, layer_height: 0.2, object_height: 1 },
            } as never)
        ).toBe(5)
        // computed max <= 0
        expect(
            getters.getPrintMaxLayers({
                print_stats: {},
                current_file: { first_layer_height: 0.2, layer_height: 0.2, object_height: -1 },
            } as never)
        ).toBe(0)
        // missing fields
        expect(getters.getPrintMaxLayers({ print_stats: {}, current_file: {} } as never)).toBe(0)
        expect(getters.getPrintMaxLayers({} as PrinterState)).toBe(0)
    })

    it('getPrintCurrentLayer prefers info.current_layer', () => {
        expect(
            getters.getPrintCurrentLayer(
                { print_stats: { info: { current_layer: 7 } } } as never,
                { getPrintMaxLayers: 10 } as never
            )
        ).toBe(7)
    })

    it('getPrintCurrentLayer computes from z, caps at max, floors at 0', () => {
        const mk = (z: number) =>
            ({
                print_stats: { info: {}, print_duration: 5 },
                current_file: { first_layer_height: 0.2, layer_height: 0.2 },
                gcode_move: { gcode_position: [0, 0, z] },
            }) as never
        // z=0.6 -> ceil((0.6-0.2)/0.2+1)=3
        expect(getters.getPrintCurrentLayer(mk(0.6), { getPrintMaxLayers: 10 } as never)).toBe(3)
        // above max -> capped
        expect(getters.getPrintCurrentLayer(mk(50), { getPrintMaxLayers: 10 } as never)).toBe(10)
        // below first layer -> 0
        expect(getters.getPrintCurrentLayer(mk(-5), { getPrintMaxLayers: 10 } as never)).toBe(0)
        // missing gcode_move defaults z to 0 -> ceil((0-0.2)/0.2+1)=0 -> 0
        expect(
            getters.getPrintCurrentLayer(
                {
                    print_stats: { info: {}, print_duration: 5 },
                    current_file: { first_layer_height: 0.2, layer_height: 0.2 },
                } as never,
                { getPrintMaxLayers: 10 } as never
            )
        ).toBe(0)
    })

    it('getPrintCurrentLayer returns 0 when duration or heights are missing', () => {
        expect(
            getters.getPrintCurrentLayer(
                {
                    print_stats: { info: {}, print_duration: 0 },
                    current_file: { first_layer_height: 0.2, layer_height: 0.2 },
                } as never,
                { getPrintMaxLayers: 10 } as never
            )
        ).toBe(0)
        expect(
            getters.getPrintCurrentLayer(
                { print_stats: { info: {}, print_duration: 5 }, current_file: {} } as never,
                { getPrintMaxLayers: 10 } as never
            )
        ).toBe(0)
        expect(getters.getPrintCurrentLayer({} as PrinterState, { getPrintMaxLayers: 0 } as never)).toBe(0)
    })
})

describe('printer/objects and macros', () => {
    it('getPrinterObjects splits type/name and filters by supported types', () => {
        const state = {
            fan: { speed: 0.5 },
            'fan_generic myfan': { speed: 1 },
            extruder: { temperature: 200 },
            configfile: {
                config: { fan: { kick_start_time: 0.5 } },
                settings: { fan: { max_power: 1 } },
            },
        } as unknown as PrinterState

        const all = getters.getPrinterObjects(state)(['fan', 'fan_generic', 'extruder'])
        expect(all).toHaveLength(3)
        expect(all.find((o: { name: string }) => o.name === 'fan')).toMatchObject({ type: 'fan' })
        expect(all.find((o: { name: string }) => o.name === 'myfan')).toMatchObject({
            type: 'fan_generic',
            config: {},
        })
        // key without space: type and name both equal the key
        expect(all.find((o: { name: string }) => o.name === 'extruder')).toMatchObject({
            type: 'extruder',
            config: {},
            settings: {},
        })
        expect(getters.getPrinterObjects(state)(['heater_bed'])).toEqual([])
    })

    it('getPrinterObjects works without configfile', () => {
        const state = { fan: { speed: 0 } } as unknown as PrinterState
        expect(getters.getPrinterObjects(state)(['fan'])).toEqual([
            { name: 'fan', type: 'fan', state: { speed: 0 }, config: {}, settings: {} },
        ])
    })

    it('getMacros filters hidden, renamed and unknown commands', () => {
        const state = {
            'gcode_macro MYMACRO': { myvar: 1 },
            'gcode_macro _HIDDEN': {},
            'gcode_macro RENAMED': {},
            'GCODE_MACRO UPPER': {},
            extruder: {},
            gcode: { commands: { MYMACRO: { help: 'does things' } } },
            configfile: {
                settings: {
                    'gcode_macro mymacro': { gcode: 'M117 hi {params.X|int|default(5)}' },
                    'gcode_macro renamed': { rename_existing: 'RENAMED_BASE', gcode: 'M117 x' },
                    'gcode_macro upper': { gcode: 'M117 up' },
                },
            },
        } as unknown as PrinterState

        const macros = getters.getMacros(state)
        expect(macros.map((m: { name: string }) => m.name)).toEqual(['MYMACRO', 'UPPER'])
        const mine = macros.find((m: { name: string }) => m.name === 'MYMACRO')
        expect(mine.description).toBe('does things')
        expect(mine.variables).toEqual({ myvar: 1 })
        expect(mine.params).toMatchObject({ X: { type: 'int', default: '5' } })
        const upper = macros.find((m: { name: string }) => m.name === 'UPPER')
        expect(upper.description).toBeNull()
        expect(upper.prop).toEqual({ gcode: 'M117 up' })
    })

    it('getMacros works without gcode commands and with empty settings', () => {
        const state = {
            'gcode_macro SOLO': { a: 1 },
            configfile: { settings: {} },
        } as unknown as PrinterState
        const macros = getters.getMacros(state)
        expect(macros).toHaveLength(1)
        expect(macros[0]).toMatchObject({ name: 'SOLO', description: null, variables: { a: 1 } })
    })

    it('getMacro finds case-insensitively and returns undefined when missing', () => {
        const moduleGetters = {
            getMacros: [{ name: 'MyMacro' }, { name: 'Other' }],
        } as never
        expect(getters.getMacro({} as PrinterState, moduleGetters)('mymacro')).toEqual({ name: 'MyMacro' })
        expect(getters.getMacro({} as PrinterState, moduleGetters)('nope')).toBeUndefined()
    })
})

describe('printer/fans and miscellaneous', () => {
    it('getPartFanSpeed returns fan speed or 0', () => {
        expect(getters.getPartFanSpeed({ fan: { speed: 0.8 } } as never)).toBe(0.8)
        expect(getters.getPartFanSpeed({} as PrinterState)).toBe(0)
    })

    it('getFans maps controllable flags, defaults speed and sorts', () => {
        const moduleGetters = {
            getPrinterObjects: () => [
                { name: 'zebra', type: 'temperature_fan', state: {} },
                { name: 'alpha', type: 'fan', state: { speed: 0.5 } },
                { name: 'beta', type: 'fan_generic', state: { speed: 0.2 } },
                { name: 'aardvark', type: 'fan_generic', state: { speed: 0.9 } },
            ],
        } as never
        const fans = getters.getFans({} as PrinterState, moduleGetters)
        // controllable first, then sorted by name within each group
        expect(fans.map((f: { name: string }) => f.name)).toEqual(['aardvark', 'alpha', 'beta', 'zebra'])
        expect(fans.find((f: { name: string }) => f.name === 'zebra')).toMatchObject({
            controllable: false,
            speed: 0,
        })
        expect(fans.find((f: { name: string }) => f.name === 'alpha')).toMatchObject({
            controllable: true,
            speed: 0.5,
        })
    })

    it('getFans sort comparator covers both name directions and equality', () => {
        const mk = (names: { name: string; type: string }[]) =>
            ({
                getPrinterObjects: () => names.map((n) => ({ ...n, state: { speed: 1 } })),
            }) as never
        // nameB < nameA branch
        expect(
            getters
                .getFans(
                    {} as PrinterState,
                    mk([
                        { name: 'b', type: 'fan' },
                        { name: 'a', type: 'fan' },
                    ])
                )
                .map((f: { name: string }) => f.name)
        ).toEqual(['a', 'b'])
        // fully equal entries hit the return-0 branch
        const equal = getters.getFans(
            {} as PrinterState,
            mk([
                { name: 'a', type: 'fan' },
                { name: 'a', type: 'fan' },
            ])
        )
        expect(equal).toHaveLength(2)
    })

    it('getMiscellaneous maps power sources, scales, pwm flags and sorting', () => {
        const state = {
            fan: { speed: 0.5, rpm: 1000 },
            'fan_generic myfan': { speed: 0.25 },
            'heater_fan hotend': { speed: 1 },
            'controller_fan board': { speed: 0.5 },
            'output_pin pin1': { value: 0.7 },
            'pwm_tool tool1': { value: 0.3 },
            'pwm_cycle_time cycle1': { value: 0 },
            'temperature_sensor ignored': { temperature: 20 },
            'fan_generic _hidden': { speed: 1 },
            norpm: {},
            configfile: {
                settings: {
                    fan: {},
                    'fan_generic myfan': {},
                    'heater_fan hotend': {},
                    'controller_fan board': {},
                    'output_pin pin1': { pwm: false, scale: 2, off_below: 0.1, max_power: 0.9 },
                    'pwm_tool tool1': {},
                    'pwm_cycle_time cycle1': {},
                },
            },
        } as unknown as PrinterState

        const misc = getters.getMiscellaneous(state)
        const byName = (n: string) => misc.find((m: { name: string }) => m.name === n)
        // fan comes first in sort order
        expect(misc[0].type).toBe('fan')
        expect(byName('fan')).toMatchObject({ power: 0.5, scale: 255, rpm: 1000, controllable: true })
        expect(byName('myfan')).toMatchObject({ power: 0.25, controllable: true })
        // value-based power, pwm from settings, off_below/max_power picked up
        expect(byName('pin1')).toMatchObject({
            power: 0.7,
            controllable: true,
            pwm: false,
            scale: 2,
            off_below: 0.1,
            max_power: 0.9,
        })
        // pwm_tool forces pwm true
        expect(byName('tool1')).toMatchObject({ controllable: true, pwm: true })
        expect(byName('cycle1')).toMatchObject({ pwm: true })
        // missing rpm defaults to null, missing power defaults to 0
        expect(byName('hotend')).toMatchObject({ rpm: null })
        expect(byName('board')).toBeDefined()
        // hidden and unsupported entries are skipped
        expect(misc.some((m: { name: string }) => m.name === '_hidden')).toBe(false)
        expect(misc.some((m: { name: string }) => m.name === 'ignored')).toBe(false)
    })

    it('getMiscellaneous works without configfile and hits equal-sort branch', () => {
        const state = {
            'heater_fan dup': { speed: 1 },
            'controller_fan dup': { speed: 1 },
            'output_pin solo': {},
        } as unknown as PrinterState
        const misc = getters.getMiscellaneous(state)
        expect(misc).toHaveLength(3)
        expect(misc.find((m: { name: string }) => m.name === 'solo')).toMatchObject({
            power: 0,
            rpm: null,
            pwm: false,
            config: {},
        })
    })

    it('getMiscellaneousSensors covers load cells, units and skips', () => {
        const state = {
            'load_cell probe': { force_g: 12.5 },
            'load_cell broken': {},
            'load_cell _hidden': { force_g: 1 },
            other_thing: { value: 1 },
        } as unknown as PrinterState
        const sensors = getters.getMiscellaneousSensors(state)
        expect(sensors).toEqual([
            { name: 'broken', type: 'load_cell', value: NaN, unit: 'g' },
            { name: 'probe', type: 'load_cell', value: 12.5, unit: 'g' },
        ])
    })

    it('getAvailableHeaters/Sensors/Monitors default to empty arrays', () => {
        const full = {
            heaters: { available_heaters: ['a'], available_sensors: ['b'], available_monitors: ['c'] },
        } as never
        expect(getters.getAvailableHeaters(full)).toEqual(['a'])
        expect(getters.getAvailableSensors(full)).toEqual(['b'])
        expect(getters.getAvailableMonitors(full)).toEqual(['c'])
        expect(getters.getAvailableHeaters({} as PrinterState)).toEqual([])
        expect(getters.getAvailableSensors({} as PrinterState)).toEqual([])
        expect(getters.getAvailableMonitors({} as PrinterState)).toEqual([])
    })

    it('getFilamentSensors collects all sensor types and defaults the name', () => {
        const state = {
            'filament_switch_sensor fs': { enabled: true, filament_detected: true },
            'filament_motion_sensor ms': { enabled: false, filament_detected: false, Diameter: 1.75 },
            hall_filament_width_sensor: { enabled: true, filament_detected: true },
            extruder: {},
        } as unknown as PrinterState
        const sensors = getters.getFilamentSensors(state)
        expect(sensors.map((s: { name: string }) => s.name)).toEqual(['fs', 'hall_filament_width_sensor', 'ms'])
        expect(sensors.find((s: { name: string }) => s.name === 'ms')).toMatchObject({
            type: 'filament_motion_sensor',
            filament_diameter: 1.75,
        })
        expect(getters.getFilamentSensors({} as PrinterState)).toEqual([])
    })
})

describe('printer/mcus and temp sensors', () => {
    const tempState = (overrides = {}) =>
        ({
            'temperature_sensor mcu_temp': { temperature: 45.6, measured_min_temp: 20.1, measured_max_temp: 60.9 },
            'temperature_sensor host_temp': { temperature: 55.4, measured_min_temp: 21, measured_max_temp: 61 },
            'temperature_fan fan_temp': { temperature: 40 },
            configfile: {
                settings: {
                    'temperature_sensor mcu_temp': { sensor_type: 'temperature_mcu', sensor_mcu: 'mcu' },
                    'temperature_sensor host_temp': { sensor_type: 'temperature_host' },
                    'temperature_fan fan_temp': { sensor_type: 'rpi_temperature' },
                    ...((overrides as { settings?: object }).settings ?? {}),
                },
            },
            ...overrides,
        }) as unknown as PrinterState

    it('getMcus maps versions, apps, load colors and temp sensors', () => {
        const state = {
            mcu: {
                mcu_version: 'v0.12.0-100-gabc',
                app: 'Klipper',
                mcu_constants: { MCU: 'atmega2560' },
                last_stats: { freq: 16000000, mcu_task_avg: 0.0001, mcu_task_stddev: 0.00001, mcu_awake: 1 },
            },
            'mcu extra': {
                mcu_version: 'v0.12.0-100-gdef',
                app: 'Katapult',
                mcu_constants: { MCU: 'rp2040' },
                last_stats: { freq: 12000000, mcu_task_avg: 0.002, mcu_task_stddev: 0.001, mcu_awake: 2 },
            },
            extruder: {},
        } as unknown as PrinterState
        const mcus = getters.getMcus(state, { getMcuTempSensor: () => null } as never)
        expect(mcus).toHaveLength(2)
        expect(mcus[0]).toMatchObject({
            name: 'mcu',
            version: 'v0.12.0-100-gabc',
            chip: 'atmega2560',
            loadProgressColor: 'primary',
        })
        expect(mcus[1].version.startsWith('Katapult')).toBe(true)
        expect(mcus[1].loadProgressColor).toBe('error')
        expect(mcus[0].loadPercent).toBeLessThan(100)
        expect(mcus[1].loadPercent).toBe(100)
        expect(mcus[0].freqFormat).toBe('16 MHz')
        expect(mcus[0].awake).toBe('0.20')
    })

    it('getMcus covers warning color, unknown version and missing stats', () => {
        const state = {
            'mcu warn': {
                last_stats: { freq: 8000000, mcu_task_avg: 0.001, mcu_task_stddev: 0.0007, mcu_awake: 5 },
                mcu_constants: {},
            },
            'mcu bare': {},
        } as unknown as PrinterState
        const mcus = getters.getMcus(state, { getMcuTempSensor: () => ({ temperature: '40' }) } as never)
        expect(mcus.find((m: { name: string }) => m.name === 'mcu warn')).toMatchObject({
            version: 'unknown',
            chip: null,
            loadProgressColor: 'warning',
        })
        expect(mcus.find((m: { name: string }) => m.name === 'mcu bare')).toMatchObject({
            version: 'unknown',
            freq: null,
            awake: '0.00',
            load: '0.00',
            loadPercent: 0,
            loadProgressColor: 'primary',
        })
    })

    it('getPrinterObject returns the object or null', () => {
        const state = { extruder: { temperature: 200 } } as unknown as PrinterState
        expect(getters.getPrinterObject(state)('extruder')).toEqual({ temperature: 200 })
        expect(getters.getPrinterObject(state)('missing')).toBeNull()
    })

    it('getHostTempSensor finds host sensors case-insensitively', () => {
        const moduleGetters = {
            getPrinterConfigObjects: () => ({
                'temperature_sensor host_temp': { sensor_type: 'temperature_host' },
            }),
        } as never
        const out = getters.getHostTempSensor(tempState(), moduleGetters)
        expect(out).toEqual({ temperature: '55', measured_min_temp: '21.0', measured_max_temp: '61.0' })
    })

    it('getHostTempSensor returns null for non-host or malformed settings', () => {
        const withObjects = (objects: object) => ({ getPrinterConfigObjects: () => objects }) as never
        const state = tempState()
        expect(
            getters.getHostTempSensor(state, withObjects({ 'temperature_sensor x': { sensor_type: 'NTC 100K' } }))
        ).toBeNull()
        expect(
            getters.getHostTempSensor(state, withObjects({ 'temperature_sensor x': { sensor_type: 42 } }))
        ).toBeNull()
        // case key not present in state
        expect(
            getters.getHostTempSensor(
                state,
                withObjects({ 'temperature_sensor ghost': { sensor_type: 'rpi_temperature' } })
            )
        ).toBeNull()
        expect(getters.getHostTempSensor(state, withObjects({}))).toBeNull()
    })

    it('getMcuTempSensors collects mcu sensors and defaults missing objects', () => {
        const moduleGetters = {
            getPrinterConfigObjects: () => ({
                'temperature_sensor mcu_temp': { sensor_type: 'temperature_mcu', sensor_mcu: 'mcu' },
                'temperature_sensor other': { sensor_type: 'NTC 100K', sensor_mcu: 'mcu' },
                'temperature_sensor nosettings': { sensor_type: 'temperature_mcu' },
                'temperature_sensor ghost': { sensor_type: 'temperature_mcu', sensor_mcu: 'mcu' },
            }),
        } as never
        const out = getters.getMcuTempSensors(tempState(), moduleGetters)
        expect(out).toHaveLength(2)
        expect(out.find((s: { key: string }) => s.key === 'temperature_sensor mcu_temp')).toMatchObject({
            settings: { sensor_mcu: 'mcu' },
            object: { temperature: 45.6 },
        })
        // 'ghost' has no state entry: caseKey falls back to '' and object to {}
        expect(out.find((s: { key: string }) => s.key === '')).toMatchObject({ object: {} })
    })

    it('getMcuTempSensor matches by mcu suffix and handles missing min/max', () => {
        const moduleGetters = {
            getMcuTempSensors: [
                { settings: { sensor_mcu: 'mcu' }, object: { temperature: 45.6 } },
                { settings: { sensor_mcu: 'extra' }, object: { temperature: 'hot' } },
                { settings: {}, object: { temperature: 10 } },
            ],
        } as never
        expect(getters.getMcuTempSensor({} as PrinterState, moduleGetters)('mcu')).toEqual({
            temperature: '46',
            measured_min_temp: null,
            measured_max_temp: null,
        })
        expect(getters.getMcuTempSensor({} as PrinterState, moduleGetters)('unknown_board')).toBeNull()
        expect(getters.getMcuTempSensor({} as PrinterState, { getMcuTempSensors: [] } as never)('mcu')).toBeNull()
    })
})

describe('printer/extruders and config', () => {
    it('getExtruders lists extruders sorted with display names', () => {
        const state = {
            configfile: {
                settings: {
                    extruder1: {
                        filament_diameter: 1.75,
                        nozzle_diameter: 0.4,
                        min_extrude_temp: 170,
                        max_extrude_only_distance: 50,
                    },
                    extruder: {
                        filament_diameter: 1.75,
                        nozzle_diameter: 0.6,
                        min_extrude_temp: 170,
                        max_extrude_only_distance: 100,
                    },
                    heater_bed: {},
                },
            },
        } as unknown as PrinterState
        expect(getters.getExtruders(state)).toEqual([
            {
                key: 'extruder',
                name: 'Extruder 0',
                filamentDiameter: 1.75,
                nozzleDiameter: 0.6,
                minExtrudeTemp: 170,
                maxExtrudeOnlyDistance: 100,
            },
            {
                key: 'extruder1',
                name: 'Extruder 1',
                filamentDiameter: 1.75,
                nozzleDiameter: 0.4,
                minExtrudeTemp: 170,
                maxExtrudeOnlyDistance: 50,
            },
        ])
        expect(getters.getExtruders({} as PrinterState)).toEqual([])
    })

    it('getExtruderSteppers lists steppers sorted', () => {
        const state = {
            configfile: {
                settings: {
                    'extruder_stepper b': { extruder: 'extruder1' },
                    'extruder_stepper a': { extruder: 'extruder' },
                    extruder: {},
                },
            },
        } as unknown as PrinterState
        expect(getters.getExtruderSteppers(state)).toEqual([
            { key: 'extruder_stepper a', name: 'a', extruder: 'extruder' },
            { key: 'extruder_stepper b', name: 'b', extruder: 'extruder1' },
        ])
        expect(getters.getExtruderSteppers({} as PrinterState)).toEqual([])
    })

    it('getExtrudePossible reads the active extruder with fallback', () => {
        expect(
            getters.getExtrudePossible({
                toolhead: { extruder: 'extruder1' },
                extruder1: { can_extrude: true },
            } as never)
        ).toBe(true)
        expect(getters.getExtrudePossible({ toolhead: { extruder: 'extruder1' } } as never)).toBe(false)
        expect(getters.getExtrudePossible({ extruder: { can_extrude: true } } as never)).toBe(true)
        expect(getters.getExtrudePossible({} as PrinterState)).toBe(false)
    })

    it('getMaxTemp picks the max sensor temp plus margin', () => {
        const state = {
            heaters: { available_sensors: ['extruder', 'heater_bed', 'missing', 'huge'] },
            configfile: {
                settings: {
                    extruder: { max_temp: 270.4 },
                    heater_bed: { max_temp: 120 },
                    huge: { max_temp: 15000 },
                    notemp: {},
                },
            },
        } as unknown as PrinterState
        expect(getters.getMaxTemp(state)).toBe(280)
        expect(getters.getMaxTemp({} as PrinterState)).toBe(300)
        expect(
            getters.getMaxTemp({
                heaters: { available_sensors: ['notemp'] },
                configfile: { settings: { notemp: {} } },
            } as never)
        ).toBe(300)
    })

    it('existPrinterConfig and checkConfig', () => {
        expect(getters.existPrinterConfig({ configfile: { config: { a: 1 } } } as never)).toBe(true)
        expect(getters.existPrinterConfig({ configfile: { config: {} } } as never)).toBe(false)
        expect(getters.existPrinterConfig({} as PrinterState)).toBe(false)
        const state = { configfile: { config: { probe: {}, Display: {} } } } as unknown as PrinterState
        expect(getters.checkConfig(state)('PROBE')).toBe(true)
        expect(getters.checkConfig(state)('display')).toBe(true)
        expect(getters.checkConfig(state)('nope')).toBe(false)
        expect(getters.checkConfig({ configfile: { config: {} } } as never)('probe')).toBe(false)
    })

    it('checkNecessaryConfig reports missing modules and display_status fallback', () => {
        const none = { checkConfig: () => false } as never
        expect(getters.checkNecessaryConfig({} as PrinterState, none)).toHaveLength(6)
        const all = { checkConfig: () => true } as never
        expect(getters.checkNecessaryConfig({} as PrinterState, all)).toEqual([])
        // display present, display_status absent -> no extra entry
        const displayOnly = {
            checkConfig: (name: string) => name === 'display',
        } as never
        expect(getters.checkNecessaryConfig({} as PrinterState, displayOnly)).not.toContain('display_status')
    })

    it('getKinematics returns kinematics, none or false', () => {
        expect(
            getters.getKinematics({ configfile: { settings: { printer: { kinematics: 'corexy' } } } } as never)
        ).toBe('corexy')
        expect(getters.getKinematics({ configfile: { settings: { printer: {} } } } as never)).toBe('none')
        expect(getters.getKinematics({ configfile: { settings: {} } } as never)).toBe(false)
        expect(getters.getKinematics({} as PrinterState)).toBe(false)
    })

    it('exists helpers return true when the section exists', () => {
        const state = {
            configfile: { settings: { quad_gantry_level: {}, delta_calibrate: {}, firmware_retraction: {} } },
        } as unknown as PrinterState
        expect(getters.existsQGL(state)).toBe(true)
        expect(getters.existsDeltaCalibrate(state)).toBe(true)
        expect(getters.existsFirmwareRetraction(state)).toBe(true)
        const empty = { configfile: { settings: {} } } as unknown as PrinterState
        expect(getters.existsQGL(empty)).toBe(false)
        expect(getters.existsDeltaCalibrate(empty)).toBe(false)
        expect(getters.existsFirmwareRetraction(empty)).toBe(false)
    })
})

describe('printer/estimated times', () => {
    it('getEstimatedTimeFile computes remaining time or 0', () => {
        const ok = () =>
            ({
                print_stats: { print_duration: 100 },
            }) as never
        expect(getters.getEstimatedTimeFile(ok(), { getPrintPercent: 0.5 } as never)).toBe('100')
        expect(getters.getEstimatedTimeFile(ok(), { getPrintPercent: 0 } as never)).toBe(0)
        expect(
            getters.getEstimatedTimeFile(
                { print_stats: { print_duration: 0 } } as never,
                { getPrintPercent: 0.5 } as never
            )
        ).toBe(0)
        expect(getters.getEstimatedTimeFile({} as PrinterState, { getPrintPercent: 0.5 } as never)).toBe(0)
    })

    it('getEstimatedTimeFilament computes remaining time or 0', () => {
        const ok = {
            print_stats: { print_duration: 100, filament_used: 50 },
            current_file: { filament_total: 100 },
        } as never
        expect(getters.getEstimatedTimeFilament(ok)).toBe('100')
        // total <= used -> 0
        expect(
            getters.getEstimatedTimeFilament({
                print_stats: { print_duration: 100, filament_used: 100 },
                current_file: { filament_total: 100 },
            } as never)
        ).toBe(0)
        // zero total -> 0
        expect(
            getters.getEstimatedTimeFilament({
                print_stats: { print_duration: 100, filament_used: 10 },
                current_file: { filament_total: 0 },
            } as never)
        ).toBe(0)
        expect(getters.getEstimatedTimeFilament({} as PrinterState)).toBe(0)
    })

    it('getEstimatedTimeSlicer computes remaining time or 0', () => {
        expect(
            getters.getEstimatedTimeSlicer({
                print_stats: { print_duration: 100 },
                current_file: { estimated_time: 500 },
            } as never)
        ).toBe('400')
        expect(
            getters.getEstimatedTimeSlicer({
                print_stats: { print_duration: 100 },
                current_file: { estimated_time: 0 },
            } as never)
        ).toBe(0)
        expect(getters.getEstimatedTimeSlicer({} as PrinterState)).toBe(0)
    })

    it('getEstimatedTimeAvg averages enabled sources or returns 0', () => {
        const root = (calc: string[] | undefined) =>
            ({ gui: { general: { calcEstimateTime: calc } } }) as unknown as RootState
        const both = { getEstimatedTimeFile: '100', getEstimatedTimeFilament: '200' } as never
        expect(getters.getEstimatedTimeAvg({} as PrinterState, both, root(['file', 'filament']))).toBe(150)
        expect(getters.getEstimatedTimeAvg({} as PrinterState, both, root(['file']))).toBe(100)
        // zero-valued sources are skipped
        expect(
            getters.getEstimatedTimeAvg(
                {} as PrinterState,
                { getEstimatedTimeFile: 0, getEstimatedTimeFilament: 0 } as never,
                root(['file', 'filament'])
            )
        ).toBe(0)
        // nothing enabled
        expect(getters.getEstimatedTimeAvg({} as PrinterState, both, root([]))).toBe(0)
        expect(getters.getEstimatedTimeAvg({} as PrinterState, both, {} as RootState)).toBe(0)
    })

    it('getEstimatedTimeETA combines enabled sources into a timestamp', () => {
        vi.useFakeTimers()
        try {
            const now = new Date(2024, 0, 1, 10, 0, 0).getTime()
            vi.setSystemTime(now)
            const root = (calc: string[]) => ({ gui: { general: { calcEtaTime: calc } } }) as unknown as RootState
            const all = {
                getEstimatedTimeFile: '100',
                getEstimatedTimeFilament: '200',
                getEstimatedTimeSlicer: '300',
            } as never
            expect(getters.getEstimatedTimeETA({} as PrinterState, all, root(['file', 'filament', 'slicer']))).toBe(
                now + 200 * 1000
            )
            expect(getters.getEstimatedTimeETA({} as PrinterState, all, root(['slicer']))).toBe(now + 300 * 1000)
            expect(
                getters.getEstimatedTimeETA(
                    {} as PrinterState,
                    { getEstimatedTimeFile: 0, getEstimatedTimeFilament: 0, getEstimatedTimeSlicer: 0 } as never,
                    root(['file', 'filament', 'slicer'])
                )
            ).toBe(0)
            expect(getters.getEstimatedTimeETA({} as PrinterState, all, root([]))).toBe(0)
        } finally {
            vi.useRealTimers()
        }
    })
})
