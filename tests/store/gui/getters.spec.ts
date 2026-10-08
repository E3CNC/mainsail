import { describe, expect, it } from 'vitest'
import { getters } from '@/store/gui/getters'
import { getDefaultState } from '@/store/gui/index'
import type { GuiState } from '@/store/gui/types'
import { allDashboardPanels } from '@/store/variables'

function state(overrides = {}): GuiState {
    return { ...getDefaultState(), ...overrides }
}

describe('gui/getters', () => {
    it('theme returns the state theme or the default for unknown themes', () => {
        expect(getters.theme(state(), undefined as never, undefined as never, undefined as never)).toBe('e3cnc')
        const s = state({ uiSettings: { ...getDefaultState().uiSettings, theme: 'nope' } })
        expect(getters.theme(s, undefined as never, undefined as never, undefined as never)).toBe('e3cnc')
    })

    it('getTheme resolves the theme object', () => {
        const run = getters.getTheme(state(), { theme: 'e3cnc' }, undefined as never, undefined as never)
        expect(run.name).toBe('e3cnc')
        const fallback = getters.getTheme(state(), { theme: 'unknown-theme' }, undefined as never, undefined as never)
        expect(fallback).toBeDefined()
    })

    it('getDatasetValue reads settings and falls back for temperature/target', () => {
        const s = state({
            view: {
                ...getDefaultState().view,
                tempchart: {
                    ...getDefaultState().view.tempchart,
                    datasetSettings: { extruder: { temperature: false } },
                },
            },
        })
        const run = getters.getDatasetValue(s, undefined as never, undefined as never, undefined as never)
        expect(run({ name: 'extruder', type: 'temperature' })).toBe(false)
        expect(run({ name: 'extruder', type: 'target' })).toBe(true)
        expect(run({ name: 'missing', type: 'power' })).toBe(false)
    })

    it('getDatasetAdditionalSensorValue returns stored or true fallback', () => {
        const s = state({
            view: {
                ...getDefaultState().view,
                tempchart: {
                    ...getDefaultState().view.tempchart,
                    datasetSettings: { extruder: { additionalSensors: { sensor2: false } } },
                },
            },
        })
        const run = getters.getDatasetAdditionalSensorValue(
            s,
            undefined as never,
            undefined as never,
            undefined as never
        )
        expect(run({ name: 'extruder', sensor: 'sensor2' })).toBe(false)
        expect(run({ name: 'extruder', sensor: 'missing' })).toBe(true)
        expect(run({ name: 'missing', sensor: 'x' })).toBe(true)
        const noSensors = state()
        const run2 = getters.getDatasetAdditionalSensorValue(
            noSensors,
            undefined as never,
            undefined as never,
            undefined as never
        )
        expect(run2({ name: 'missing', sensor: 'x' })).toBe(true)
    })

    it('getPanelExpand reflects nonExpandPanels', () => {
        const s = state({
            dashboard: { ...getDefaultState().dashboard, nonExpandPanels: { widescreen: ['temperature'] } },
        })
        const run = getters.getPanelExpand(s, undefined as never, undefined as never, undefined as never)
        expect(run('temperature', 'widescreen')).toBe(false)
        expect(run('other', 'widescreen')).toBe(true)
        expect(run('temperature', 'unknown')).toBe(true)
    })

    it('getAllPossiblePanels keeps all panels by default', () => {
        const out = getters.getAllPossiblePanels(
            state(),
            { 'webcams/getWebcams': [{ id: 1 }] },
            { printer: { heaters: { available_sensors: ['a'] }, 'led_effect led': {} } } as never,
            {}
        )
        expect(out).toEqual(expect.arrayContaining(allDashboardPanels))
    })

    it('getAllPossiblePanels drops webcam and led-effects when absent', () => {
        const out = getters.getAllPossiblePanels(
            state(),
            {},
            { printer: { heaters: { available_sensors: ['a'] } } } as never,
            {}
        )
        expect(out).not.toContain('webcam')
        expect(out).not.toContain('led-effects')
        expect(out).toContain('temperature')
    })

    it('getAllPossiblePanels filters by macro mode, kinematics, sensors, webcams and leds', () => {
        const out = getters.getAllPossiblePanels(
            state({
                macros: {
                    mode: 'expert',
                    hiddenMacros: [],
                    macrogroups: {
                        g1: {
                            id: 'g1',
                            name: 'G',
                            color: 'primary',
                            showInStandby: true,
                            showInPrinting: true,
                            showInPause: true,
                        },
                    },
                },
            }),
            { 'macros/getAllMacrogroups': [{ id: 'g1' }], 'webcams/getWebcams': [] },
            { printer: { heaters: { available_sensors: [] } } } as never,
            { 'printer/getKinematics': 'none' }
        )
        expect(out).toContain('macrogroup_g1')
        expect(out).not.toContain('macros')
        expect(out).not.toContain('machine-settings')
        expect(out).not.toContain('temperature')
        expect(out).not.toContain('webcam')
        expect(out).not.toContain('led-effects')
    })

    it('getAllPossiblePanels keeps webcam and led-effects when present', () => {
        const out = getters.getAllPossiblePanels(
            state(),
            { 'webcams/getWebcams': [{ id: 1 }] },
            { printer: { heaters: { available_sensors: ['a'] }, 'led_effect led': {} } } as never,
            {}
        )
        expect(out).toContain('webcam')
        expect(out).toContain('led-effects')
    })

    it('getPanels appends missing panels, filters invisible and enforces allowlists', () => {
        const s = state({
            dashboard: {
                ...getDefaultState().dashboard,
                desktopLayout1: [{ name: 'temperature', visible: true }],
                desktopLayout2: [{ name: 'temperature', visible: true }],
            },
            macros: { mode: 'simple', hiddenMacros: [], macrogroups: {} },
        })
        const localGetters = {
            getAllPossiblePanels: ['temperature', 'webcam'],
            getAllPanelsFromViewport: () => [{ name: 'temperature', visible: true }],
        }
        const run = getters.getPanels(
            s,
            localGetters,
            { gui: { macros: { mode: 'simple' } } } as never,
            undefined as never
        )
        const all = run('desktop', 1, false)
        expect(all.map((p: { name: string }) => p.name)).toContain('webcam')
        const visible = run('desktop', 2, true)
        expect(visible.every((p: { visible: boolean }) => p.visible)).toBe(true)
    })

    it('getPanels in expert mode filters macros and stale macrogroups', () => {
        const s = state({
            dashboard: {
                ...getDefaultState().dashboard,
                desktopLayout1: [
                    { name: 'macros', visible: true },
                    { name: 'macrogroup_gone', visible: true },
                    { name: 'macrogroup_g1', visible: true },
                ],
                desktopLayout2: [{ name: 'temperature', visible: true }],
            },
            macros: { mode: 'expert', hiddenMacros: [], macrogroups: {} },
        })
        const localGetters = {
            getAllPossiblePanels: ['macrogroup_g1', 'temperature'],
            getAllPanelsFromViewport: () => [],
            'macros/getAllMacrogroups': [{ id: 'g1' }],
        }
        const run = getters.getPanels(
            s,
            localGetters,
            { gui: { macros: { mode: 'expert' } } } as never,
            undefined as never
        )
        const names = run('desktop', 1, false).map((p: { name: string }) => p.name)
        expect(names).not.toContain('macros')
        expect(names).not.toContain('macrogroup_gone')
        expect(names).toContain('macrogroup_g1')
    })

    it('getAllPanelsFromViewport concatenates numbered layouts', () => {
        const s = state()
        const run = getters.getAllPanelsFromViewport(s, undefined as never, undefined as never, undefined as never)
        expect(run('desktop').length).toBeGreaterThan(0)
        expect(run('unknown')).toEqual([])
    })

    it('getDefaultControlActionButton prefers qgl when available', () => {
        expect(
            getters.getDefaultControlActionButton(state(), {}, undefined as never, { 'printer/existsQGL': true })
        ).toBe('qgl')
        expect(
            getters.getDefaultControlActionButton(state(), {}, undefined as never, { 'printer/existsQGL': false })
        ).toBe('m84')
    })

    it('getHours12Format follows the setting or locale fallback', () => {
        const h12 = state({ general: { ...getDefaultState().general, timeFormat: '12hours' } })
        expect(getters.getHours12Format(h12, undefined as never, undefined as never, undefined as never)).toBe(true)
        const h24 = state({ general: { ...getDefaultState().general, timeFormat: '24hours' } })
        expect(getters.getHours12Format(h24, undefined as never, undefined as never, undefined as never)).toBe(false)
        const auto = state({ general: { ...getDefaultState().general, timeFormat: null } })
        expect(typeof getters.getHours12Format(auto, undefined as never, undefined as never, undefined as never)).toBe(
            'boolean'
        )
    })
})
