import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import SettingsGeneralTab from '@/components/settings/SettingsGeneralTab.vue'

const mocks = vi.hoisted(() => ({
    dispatch: vi.fn(),
    general: null as unknown as Record<string, unknown>,
}))

vi.mock('@/composables/useBase', async () => {
    const { ref } = await import('vue')
    return {
        useBase: () => ({
            browserLocale: ref('en-US'),
            formatDate: () => 'formatted-date',
        }),
    }
})

vi.mock('@/composables/useSettingsDatabase', () => ({
    useSettingsDatabase: () => ({}),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key}:${Object.values(params).join(',')}` : key,
    }),
}))

const defaultGeneral = () => ({
    printername: 'Shop Printer',
    language: 'en',
    dateFormat: 'iso',
    timeFormat: '24hours',
    calcPrintProgress: 'file-relative',
    calcEtaTime: ['file'],
})

beforeAll(() => {
    const MockResizeObserver = class {
        observe = () => {}
        unobserve = () => {}
        disconnect = () => {}
    }
    if (!(globalThis as Record<string, unknown>).ResizeObserver) {
        ;(globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver
    }
    if (!window.matchMedia) {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn(() => ({
                matches: false,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                dispatchEvent: () => false,
            })),
        })
    }
})

beforeEach(() => {
    mocks.dispatch.mockReset()
    mocks.general = defaultGeneral()
})

const createTestWrapper = () => {
    const vuetify = createVuetify()
    const store = createStore({
        state: { gui: { general: mocks.general } },
        actions: {
            'gui/saveSetting': (_ctx: never, payload: never) => {
                mocks.dispatch(payload)
            },
        },
    })
    const wrapper = mount(SettingsGeneralTab, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                SettingsRow: { template: '<div><slot /></div>' },
                SettingsGeneralTabBackupDatabase: { template: '<div />' },
                SettingsGeneralTabRestoreDatabase: { template: '<div />' },
                SettingsGeneralTabResetDatabase: { template: '<div />' },
            },
        },
    })
    return { wrapper }
}

describe('SettingsGeneralTab', () => {
    it('loads the available languages from the locale files', async () => {
        const { wrapper } = createTestWrapper()
        // dynamic locale imports resolve over several ticks; poll briefly
        let items: { text: string; value: string }[] = []
        for (let i = 0; i < 20 && items.length === 0; i++) {
            await new Promise((resolve) => setTimeout(resolve, 50))
            await flushPromises()
            items = wrapper.findAllComponents({ name: 'VSelect' })[0].props('items') as {
                text: string
                value: string
            }[]
        }
        // en.json has the title "English"
        expect(items).toContainEqual({ text: 'English', value: 'en' })
        expect(items.length).toBeGreaterThan(1)
        wrapper.unmount()
    })

    it('saves the printer name through the store', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        await wrapper.find('input').setValue('Garage Printer')
        expect(mocks.dispatch).toHaveBeenCalledWith({ name: 'general.printername', value: 'Garage Printer' })
        wrapper.unmount()
    })

    it('falls back to file-relative for an unknown print progress mode', () => {
        mocks.general = { ...defaultGeneral(), calcPrintProgress: 'bogus' }
        const { wrapper } = createTestWrapper()
        // the immediate watcher repairs the invalid value on mount
        expect(mocks.dispatch).toHaveBeenCalledWith({ name: 'general.calcPrintProgress', value: 'file-relative' })
        wrapper.unmount()
    })

    it('filters unknown eta sources on mount', () => {
        mocks.general = { ...defaultGeneral(), calcEtaTime: ['file', 'bogus', 'slicer'] }
        const { wrapper } = createTestWrapper()
        expect(mocks.dispatch).toHaveBeenCalledWith({ name: 'general.calcEtaTime', value: ['file', 'slicer'] })
        wrapper.unmount()
    })

    it('keeps a valid eta configuration untouched', () => {
        const { wrapper } = createTestWrapper()
        expect(
            mocks.dispatch.mock.calls.filter(
                ([payload]) => (payload as { name: string }).name === 'general.calcEtaTime'
            )
        ).toHaveLength(0)
        wrapper.unmount()
    })

    it('builds date format items with examples', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        const dateSelect = wrapper.findAllComponents({ name: 'VSelect' })[1]
        const items = dateSelect.props('items') as { text: string; value: string | null }[]
        const texts = items.map((i) => i.text)
        expect(texts.some((t) => t.startsWith('Browser ('))).toBe(true)
        expect(texts.some((t) => t.startsWith('ISO ('))).toBe(true)
        wrapper.unmount()
    })
})
