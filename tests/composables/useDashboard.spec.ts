import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mdiCodeTags, mdiEngine, mdiGrid, mdiInformation, mdiWebcam } from '@mdi/js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { getters: Record<string, any>; state: Record<string, any> } = {
    getters: {},
    state: {},
}

vi.mock('vuex', () => ({
    useStore: () => store,
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        isMobile: { value: false },
        isTablet: { value: false },
        isDesktop: { value: true },
        isWidescreen: { value: false },
        viewport: { value: 'desktop' },
    }),
}))

vi.mock('@/routes', () => ({ default: [] }))

vi.mock('@/plugins/helpers', () => ({
    capitalize: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
}))

import { useDashboard } from '@/composables/useDashboard'

describe('useDashboard', () => {
    beforeEach(() => {
        store.getters = {
            'gui/macros/getAllMacrogroups': [],
            'gui/webcams/getWebcams': [],
            'farm/countPrinters': 0,
        }
        store.state = {}
    })

    it('exposes macrogroups, webcams and the desktop viewport', () => {
        store.getters['gui/macros/getAllMacrogroups'] = [{ id: '1', name: 'Start' }]
        const d = useDashboard()
        expect(d.macrogroups.value).toEqual([{ id: '1', name: 'Start' }])
        expect(d.webcams.value).toEqual([])
        expect(d.viewport.value).toBe('desktop')
        expect(d.isDesktop.value).toBe(true)
    })

    it('getPanelName resolves macrogroups by id', () => {
        store.getters['gui/macros/getAllMacrogroups'] = [{ id: '7', name: 'Print Start' }]
        const { getPanelName } = useDashboard()
        expect(getPanelName('macrogroup_7')).toBe('Print Start')
        expect(getPanelName('macrogroup_99')).toBe('Macrogroup')
    })

    it('getPanelName maps CNC panels to fixed names', () => {
        const { getPanelName } = useDashboard()
        expect(getPanelName('cnc-status')).toBe('CNC Status')
        expect(getPanelName('dro')).toBe('DRO')
        expect(getPanelName('jog')).toBe('Jog')
        expect(getPanelName('wcs')).toBe('WCS')
        expect(getPanelName('offsets')).toBe('WCS')
        expect(getPanelName('offset-preview')).toBe('WCS')
        expect(getPanelName('spindle-coolant')).toBe('Spindle & Coolant')
        expect(getPanelName('mdi')).toBe('MDI')
    })

    it('getPanelName builds i18n keys for generic panels', () => {
        const { getPanelName } = useDashboard()
        expect(getPanelName('temperature')).toBe('Panels.TemperaturePanel.Headline')
        expect(getPanelName('extruder-temperature')).toBe('Panels.ExtruderTemperaturePanel.Headline')
    })

    it('convertPanelnameToIcon maps panels to icons', () => {
        const { convertPanelnameToIcon } = useDashboard()
        expect(convertPanelnameToIcon('macrogroup_1')).toBe(mdiCodeTags)
        expect(convertPanelnameToIcon('webcam')).toBe(mdiWebcam)
        expect(convertPanelnameToIcon('wcs')).toBe(mdiGrid)
        expect(convertPanelnameToIcon('spindle-coolant')).toBe(mdiEngine)
        expect(convertPanelnameToIcon('something-unknown')).toBe(mdiInformation)
    })
})
