import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import NevermoreValue from '@/components/panels/Temperature/TemperaturePanelListItemNevermoreValue.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
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
    if (!window.matchMedia) {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn(() => ({
                matches: false,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => false,
            })),
        })
    }
})

const createTestWrapper = (props: Record<string, unknown> = {}, datasetVisible: boolean | null = true) => {
    const vuetify = createVuetify()
    const store = createStore({
        getters: {
            'gui/getDatasetAdditionalSensorValue': () => () => datasetVisible,
        },
    })
    const wrapper = mount(NevermoreValue, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
        },
        props: {
            printerObject: {},
            objectName: 'nevermore',
            keyName: 'temperature',
            ...props,
        } as never,
    })
    return { wrapper }
}

describe('TemperaturePanelListItemNevermoreValue', () => {
    it('renders intake and exhaust temperature with units', () => {
        const { wrapper } = createTestWrapper({
            printerObject: { intake_temperature: 24.25, exhaust_temperature: 26.75 },
        })
        expect(wrapper.text()).toContain('24.3 °C > 26.8 °C')
        wrapper.unmount()
    })

    it('renders pressure without decimals and hPa unit', () => {
        const { wrapper } = createTestWrapper({
            keyName: 'pressure',
            printerObject: { intake_pressure: 1013.4, exhaust_pressure: 1012.6 },
        })
        expect(wrapper.text()).toContain('1013 hPa > 1013 hPa')
        wrapper.unmount()
    })

    it('renders humidity with percent unit', () => {
        const { wrapper } = createTestWrapper({
            keyName: 'humidity',
            printerObject: { intake_humidity: 40.2, exhaust_humidity: 38.8 },
        })
        expect(wrapper.text()).toContain('40.2 % > 38.8 %')
        wrapper.unmount()
    })

    it('renders without units for unknown keys', () => {
        const { wrapper } = createTestWrapper({
            keyName: 'fan_speed',
            printerObject: { intake_fan_speed: 100, exhaust_fan_speed: 80 },
        })
        expect(wrapper.text()).toContain('100.0 > 80.0')
        wrapper.unmount()
    })

    it('renders dashes for a missing intake side', () => {
        const { wrapper } = createTestWrapper({
            printerObject: { exhaust_temperature: 26 },
        })
        expect(wrapper.text()).toContain('-- °C > 26.0 °C')
        wrapper.unmount()
    })

    it('renders dashes for a missing exhaust side', () => {
        const { wrapper } = createTestWrapper({
            printerObject: { intake_temperature: 24 },
        })
        expect(wrapper.text()).toContain('24.0 °C > -- °C')
        wrapper.unmount()
    })

    it('enables the min/max tooltip when all extremes are present', () => {
        const { wrapper } = createTestWrapper({
            printerObject: {
                intake_temperature: 24,
                exhaust_temperature: 26,
                intake_temperature_min: 20,
                exhaust_temperature_min: 21,
                intake_temperature_max: 30,
                exhaust_temperature_max: 31,
            },
        })
        expect(wrapper.findComponent({ name: 'VTooltip' }).props('disabled')).toBe(false)
        wrapper.unmount()
    })

    it('hides the value when both sides are missing', () => {
        const { wrapper } = createTestWrapper({ printerObject: {} })
        expect(wrapper.text()).toBe('')
        wrapper.unmount()
    })

    it('hides the value when the dataset is disabled in gui settings', () => {
        const { wrapper } = createTestWrapper(
            { printerObject: { intake_temperature: 24, exhaust_temperature: 26 } },
            false
        )
        expect(wrapper.text()).toBe('')
        wrapper.unmount()
    })

    it('uses the full font size by default', () => {
        const { wrapper } = createTestWrapper({
            printerObject: { intake_temperature: 24, exhaust_temperature: 26 },
        })
        const value = wrapper.find('span[style*="font-size"]')
        expect(value.exists()).toBe(true)
        expect((value.element as HTMLElement).style.fontSize).toBe('1em')
        wrapper.unmount()
    })

    it('uses the small font size when small is set', () => {
        const { wrapper } = createTestWrapper({
            small: true,
            printerObject: { intake_temperature: 24, exhaust_temperature: 26 },
        })
        const value = wrapper.find('span[style*="font-size"]')
        expect(value.exists()).toBe(true)
        expect((value.element as HTMLElement).style.fontSize).toBe('0.8em')
        wrapper.unmount()
    })
})
