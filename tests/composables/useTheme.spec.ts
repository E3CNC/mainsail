import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

const mocks = vi.hoisted(() => ({
    dark: true,
}))

vi.mock('vuetify', () => ({
    useTheme: () => ({ global: { current: { value: { dark: mocks.dark } } } }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { getters: Record<string, any>; state: Record<string, any> } = {
    getters: {},
    state: {},
}

vi.mock('vuex', () => ({
    useStore: () => store,
}))

import { useTheme } from '@/composables/useTheme'

describe('useTheme', () => {
    beforeEach(() => {
        mocks.dark = true
        store.getters = {
            'gui/theme': 'mainsail',
            'gui/getTheme': {},
            'files/getSidebarLogo': '',
            'files/getMainBackground': '',
        }
        store.state = reactive({ gui: { uiSettings: { mode: 'dark' } } })
    })

    it('fgColor/bgColor invert between dark and light', () => {
        const t = useTheme()
        expect(t.fgColor(0.5)).toBe('rgba(255, 255, 255, 0.5)')
        expect(t.bgColor(0.5)).toBe('rgba(0, 0, 0, 0.5)')
        expect(t.fgColor(0.5, false)).toBe('rgba(0, 0, 0, 0.5)')
        expect(t.fgColorHi.value).toBe('rgba(255, 255, 255, 0.8)')
        expect(t.fgColorMid.value).toBe('rgba(255, 255, 255, 0.5)')
        expect(t.fgColorLow.value).toBe('rgba(255, 255, 255, 0.2)')
        expect(t.fgColorFaint.value).toBe('rgba(255, 255, 255, 0.1)')
    })

    it('derives dark-mode surface colors', () => {
        expect(useTheme().machineButtonCol.value).toBe('#424242')
        expect(useTheme().draggableBgStyle.value).toBe('background-color: #282828')
        expect(useTheme().progressBarColor.value).toBe('white')
        mocks.dark = false
        expect(useTheme().machineButtonCol.value).toBe('#bdbdbd')
        expect(useTheme().draggableBgStyle.value).toBe('background-color: #e7e7e7')
        expect(useTheme().progressBarColor.value).toBe('primary')
    })

    it('themeMode defaults to dark', () => {
        expect(useTheme().themeMode.value).toBe('dark')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.state.gui.uiSettings = {} as any
        expect(useTheme().themeMode.value).toBe('dark')
    })

    it('sidebarBgImage falls back to the default assets', () => {
        expect(useTheme().sidebarBgImage.value).toBe('/img/sidebar-background.svg')
        mocks.dark = false
        expect(useTheme().sidebarBgImage.value).toBe('/img/sidebar-background-light.svg')
    })

    it('sidebarBgImage uses the themed asset when enabled', () => {
        store.getters['gui/theme'] = 'custom'
        store.getters['gui/getTheme'] = { sidebarBackground: { show: true } }
        expect(useTheme().sidebarBgImage.value).toBe('/img/themes/sidebarBackground-custom.png')
    })

    it('sidebarLogo returns the custom url, or empty without logo config', () => {
        store.getters['gui/theme'] = 'custom'
        expect(useTheme().sidebarLogo.value).toBe('')
        store.getters['files/getSidebarLogo'] = '/custom/logo.svg'
        expect(useTheme().sidebarLogo.value).toBe('/custom/logo.svg')
    })

    it('themeCss is null without css config', () => {
        expect(useTheme().themeCss.value).toBeNull()
        store.getters['gui/theme'] = 'custom'
        store.getters['gui/getTheme'] = { css: true }
        expect(useTheme().themeCss.value).toBe('/css/themes/custom.css')
    })
})
