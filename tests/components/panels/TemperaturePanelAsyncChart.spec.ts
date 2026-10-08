import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import i18n from '@/plugins/i18n'
import TemperaturePanel from '@/components/panels/TemperaturePanel.vue'

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: vi.fn() }),
}))

beforeAll(() => {
    const MockResizeObserver = class {
        observe = () => {}
        unobserve = () => {}
        disconnect = () => {}
    }
    if (!(globalThis as Record<string, unknown>).ResizeObserver) {
        ;(globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver
    }
})

const mountPanel = (boolTempchart = true) => {
    const store = createStore({
        state: {
            socket: { isConnected: true },
            server: { klippy_connected: true, klippy_state: 'ready' },
            printer: { tempHistory: { series: [], source: [] } },
            gui: {
                view: { tempchart: { boolTempchart, autoscale: true } },
                uiSettings: {},
                control: {},
            },
        },
        getters: {
            'printer/tempHistory/getTemperatureStoreSize': () => 1200,
            'printer/getMaxTemp': () => 300,
            'printer/tempHistory/getBoolDisplayPwmAxis': () => false,
            'printer/tempHistory/getSelectedLegends': () => ({}),
        },
    })

    const vuetify = createVuetify()
    const wrapper = mount(TemperaturePanel, {
        global: {
            plugins: [vuetify, store, i18n],
            mocks: { $t: (key: string) => key },
            directives: { longpress: {}, 'observe-visibility': {} },
            stubs: {
                Panel: { template: '<div data-testid=\"panel\"><slot /><slot name=\"buttons\" /></div>' },
                TemperaturePanelList: { template: '<div data-testid=\"sensor-list\" />' },
                TemperaturePanelSettings: { template: '<div data-testid=\"panel-settings\" />' },
            },
        },
    })
    return { wrapper, store }
}

describe('TemperaturePanel async TempChart (frontend-performance R2)', () => {
    it('loads and renders TempChart when the chart is enabled', async () => {
        const { wrapper } = mountPanel()

        for (let i = 0; i < 50 && !wrapper.findComponent({ name: 'TempChart' }).exists(); i++) {
            await new Promise((resolve) => setTimeout(resolve, 100))
            await flushPromises()
            await nextTick()
        }

        expect(wrapper.find('.v-skeleton-loader').exists()).toBe(false)
        expect(wrapper.findComponent({ name: 'TempChart' }).exists()).toBe(true)
        // vue-echarts registers under the name "echarts"
        expect(wrapper.findComponent({ name: 'echarts' }).exists()).toBe(true)

        wrapper.unmount()
    })

    it('never loads the chart chunk when the chart is disabled', async () => {
        const { wrapper } = mountPanel(false)

        await flushPromises()

        expect(wrapper.findComponent({ name: 'TempChart' }).exists()).toBe(false)

        wrapper.unmount()
    })
})
