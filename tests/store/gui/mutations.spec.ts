import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/gui/mutations'
import { getDefaultState } from '@/store/gui/index'
import type { GuiState } from '@/store/gui/types'

function state(overrides = {}): GuiState {
    const base = getDefaultState()
    return { ...base, ...overrides }
}

describe('gui/mutations', () => {
    it('reset restores defaults', () => {
        const s = state({ general: { ...getDefaultState().general, printername: 'changed' } })
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('setData deep-merges payload', () => {
        const s = state()
        mutations.setData(s, { general: { printername: 'E3' } })
        expect(s.general.printername).toBe('E3')
    })

    it('saveSetting writes nested keys', () => {
        const s = state()
        mutations.saveSetting(s, { name: 'general.printername', value: 'E3' })
        expect(s.general.printername).toBe('E3')
    })

    it('setHeaterChartVisibility adds and removes hidden entries', () => {
        const s = state()
        mutations.setHeaterChartVisibility(s, { name: 'extruder', hidden: true })
        expect(s.view.tempchart.hiddenDataset).toContain('EXTRUDER')
        mutations.setHeaterChartVisibility(s, { name: 'extruder', hidden: true })
        expect(s.view.tempchart.hiddenDataset.filter((d) => d === 'EXTRUDER')).toHaveLength(1)
        mutations.setHeaterChartVisibility(s, { name: 'extruder' })
        expect(s.view.tempchart.hiddenDataset).not.toContain('EXTRUDER')
    })

    it('setGcodefilesMetadata toggles hidden columns', () => {
        const s = state()
        mutations.setGcodefilesMetadata(s, { name: 'size', value: false })
        expect(s.view.gcodefiles.hideMetadataColumns).toContain('size')
        mutations.setGcodefilesMetadata(s, { name: 'size', value: false })
        expect(s.view.gcodefiles.hideMetadataColumns.filter((c) => c === 'size')).toHaveLength(1)
        mutations.setGcodefilesMetadata(s, { name: 'size', value: true })
        expect(s.view.gcodefiles.hideMetadataColumns).not.toContain('size')
    })

    it('setGcodefilesShowHiddenFiles assigns', () => {
        const s = state()
        mutations.setGcodefilesShowHiddenFiles(s, true)
        expect(s.view.gcodefiles.showHiddenFiles).toBe(true)
    })

    it('setCurrentWebcam assigns per page', () => {
        const s = state()
        mutations.setCurrentWebcam(s, { page: 'dashboard', value: 'cam1' })
        expect(s.view.webcam.currentCam.dashboard).toBe('cam1')
    })

    it('setHistoryColumns toggles columns', () => {
        const s = state()
        mutations.setHistoryColumns(s, { name: 'newcol', value: false })
        expect(s.view.history.hideColums).toContain('newcol')
        mutations.setHistoryColumns(s, { name: 'newcol', value: true })
        expect(s.view.history.hideColums).not.toContain('newcol')
        mutations.setHistoryColumns(s, { name: 'size', value: false })
        expect(s.view.history.hideColums.filter((c) => c === 'size')).toHaveLength(1)
    })

    it('setHistoryHidePrintStatus assigns', () => {
        const s = state()
        mutations.setHistoryHidePrintStatus(s, ['cancelled'])
        expect(s.view.history.hidePrintStatus).toEqual(['cancelled'])
    })

    it('addClosePanel and removeClosePanel toggle entries', () => {
        const s = state()
        mutations.addClosePanel(s, { name: 'temperature', viewport: 'widescreen' })
        expect(s.dashboard.nonExpandPanels['widescreen']).toContain('temperature')
        mutations.addClosePanel(s, { name: 'temperature', viewport: 'widescreen' })
        expect(s.dashboard.nonExpandPanels['widescreen'].filter((n) => n === 'temperature')).toHaveLength(1)
        mutations.removeClosePanel(s, { name: 'missing', viewport: 'widescreen' })
        mutations.removeClosePanel(s, { name: 'temperature', viewport: 'widescreen' })
        expect(s.dashboard.nonExpandPanels['widescreen']).not.toContain('temperature')
    })

    it('deleteFromDashboardLayout removes by index', () => {
        const s = state()
        const before = s.dashboard.mobileLayout.length
        mutations.deleteFromDashboardLayout(s, { layoutname: 'mobileLayout', index: 0 })
        expect(s.dashboard.mobileLayout).toHaveLength(before - 1)
    })

    it('setFloatingPanels assigns', () => {
        const s = state()
        const panels = { p1: { x: 1, y: 2, width: 3, height: 4, zIndex: 5 } }
        mutations.setFloatingPanels(s, panels)
        expect(s.dashboard.floatingPanels).toEqual(panels)
    })

    it('setChartDatasetStatus creates and updates entries', () => {
        const s = state()
        mutations.setChartDatasetStatus(s, { objectName: 'extruder', dataset: 'temperature', value: false })
        expect(s.view.tempchart.datasetSettings['extruder']).toEqual({ temperature: false })
        mutations.setChartDatasetStatus(s, { objectName: 'extruder', dataset: 'target', value: true })
        expect(s.view.tempchart.datasetSettings['extruder']).toEqual({ temperature: false, target: true })
    })

    it('setDatasetAdditionalSensorStatus covers all branches', () => {
        const s = state()
        mutations.setDatasetAdditionalSensorStatus(s, { objectName: 'extruder', dataset: 'sensor1', value: false })
        expect(s.view.tempchart.datasetSettings['extruder']).toEqual({ additionalSensors: { sensor1: false } })
        mutations.setDatasetAdditionalSensorStatus(s, { objectName: 'heater', dataset: 'temperature', value: true })
        mutations.setDatasetAdditionalSensorStatus(s, { objectName: 'heater', dataset: 'sensor1', value: false })
        expect(s.view.tempchart.datasetSettings['heater'].additionalSensors).toEqual({
            temperature: true,
            sensor1: false,
        })
        mutations.setDatasetAdditionalSensorStatus(s, { objectName: 'heater', dataset: 'sensor2', value: true })
        expect(
            (s.view.tempchart.datasetSettings['heater'].additionalSensors as Record<string, boolean>)['sensor2']
        ).toBe(true)
    })
})
