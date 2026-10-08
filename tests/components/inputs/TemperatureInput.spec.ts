import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import TemperatureInput from '@/components/inputs/TemperatureInput.vue'

const mocks = vi.hoisted(() => ({
    doSend: vi.fn(),
    toastError: vi.fn(),
    printerState: { value: 'standby', __v_isRef: true },
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ printer_state: mocks.printerState }),
}))

vi.mock('@/composables/useControl', () => ({
    useControl: () => ({ doSend: mocks.doSend }),
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

beforeEach(() => {
    mocks.doSend.mockReset()
    mocks.toastError.mockReset()
    mocks.printerState.value = 'standby'
})

const baseProps = {
    name: 'extruder',
    target: 0,
    minTemp: 0,
    maxTemp: 300,
    command: 'SET_HEATER_TEMPERATURE',
    attributeName: 'HEATER',
}

const createTestWrapper = (props: Record<string, unknown> = {}, printerState = 'standby') => {
    mocks.printerState.value = printerState
    const vuetify = createVuetify()
    const wrapper = mount(TemperatureInput, {
        global: {
            plugins: [vuetify],
            mocks: { $t: (s: string) => s },
            provide: { $toast: { error: mocks.toastError } },
            stubs: {
                VMenu: {
                    template: '<div><slot name="activator" :props="{}" /><slot /></div>',
                },
                VList: { template: '<div><slot /></div>' },
                VListItem: { template: '<div data-testid="preset" @click="$emit(\'click\')"><slot /></div>' },
            },
        },
        props: { ...baseProps, ...props } as never,
    })
    return { wrapper }
}

describe('TemperatureInput', () => {
    it('renders with the target value', async () => {
        const { wrapper } = createTestWrapper({ target: 200 })
        await nextTick()
        expect(wrapper.find('input').exists()).toBe(true)
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('200')
        wrapper.unmount()
    })

    it('sizes the input from inputDigits', () => {
        const { wrapper } = createTestWrapper({ inputDigits: 3 })
        const field = wrapper.findComponent({ name: 'VTextField' })
        // 3*10 + 21 + 20 + 10 = 81px
        expect(field.props('style')).toMatchObject({ width: '81px' })
        wrapper.unmount()
    })

    it('sizes the input for custom digit counts', () => {
        const { wrapper } = createTestWrapper({ inputDigits: 5 })
        const field = wrapper.findComponent({ name: 'VTextField' })
        expect(field.props('style')).toMatchObject({ width: '101px' })
        wrapper.unmount()
    })

    it('sends a valid temperature', async () => {
        const { wrapper } = createTestWrapper({ target: 0 })
        await wrapper.find('input').setValue('210')
        await wrapper.find('form').trigger('submit')
        expect(mocks.doSend).toHaveBeenCalledWith('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=210')
        wrapper.unmount()
    })

    it('does not resend when the value equals the target', async () => {
        const { wrapper } = createTestWrapper({ target: 200 })
        await wrapper.find('input').setValue('200')
        await wrapper.find('form').trigger('submit')
        expect(mocks.doSend).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('rejects temperatures above maxTemp with a toast and resets', async () => {
        const { wrapper } = createTestWrapper({ target: 200, maxTemp: 300 })
        await wrapper.find('input').setValue('400')
        await wrapper.find('form').trigger('submit')
        expect(mocks.doSend).not.toHaveBeenCalled()
        expect(mocks.toastError).toHaveBeenCalledTimes(1)
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('200')
        wrapper.unmount()
    })

    it('rejects non-zero temperatures below minTemp with a toast and resets', async () => {
        const { wrapper } = createTestWrapper({ target: 200, minTemp: 50 })
        await wrapper.find('input').setValue('10')
        await wrapper.find('form').trigger('submit')
        expect(mocks.doSend).not.toHaveBeenCalled()
        expect(mocks.toastError).toHaveBeenCalledTimes(1)
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('200')
        wrapper.unmount()
    })

    it('allows zero even when minTemp is above zero', async () => {
        const { wrapper } = createTestWrapper({ target: 200, minTemp: 50 })
        await wrapper.find('input').setValue('0')
        await wrapper.find('form').trigger('submit')
        expect(mocks.doSend).toHaveBeenCalledWith('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=0')
        wrapper.unmount()
    })

    it('treats non-numeric input as zero', async () => {
        const { wrapper } = createTestWrapper({ target: 200, minTemp: 0 })
        await wrapper.find('input').setValue('abc')
        await wrapper.find('form').trigger('submit')
        // 'abc' parses to NaN -> normalize to 0, which differs from 200 so it sends TARGET=0
        expect(mocks.doSend).toHaveBeenCalledWith('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=0')
        wrapper.unmount()
    })

    it('renders presets and sends the preset command on click', async () => {
        const { wrapper } = createTestWrapper({ presets: [0, 200] })
        expect(wrapper.text()).toContain('0°C')
        expect(wrapper.text()).toContain('200°C')
        const items = wrapper.findAll('[data-testid="preset"]')
        expect(items).toHaveLength(2)
        await items[1].trigger('click')
        expect(mocks.doSend).toHaveBeenCalledWith('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=200')
        wrapper.unmount()
    })

    it('hides the preset menu when no presets are given', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.findComponent({ name: 'VMenu' }).exists()).toBe(false)
        wrapper.unmount()
    })

    it('disables the preset button while printing or paused', () => {
        const printing = createTestWrapper({ presets: [200] }, 'printing')
        expect(printing.wrapper.findComponent({ name: 'VBtn' }).props('disabled')).toBe(true)
        printing.wrapper.unmount()
        const paused = createTestWrapper({ presets: [200] }, 'paused')
        expect(paused.wrapper.findComponent({ name: 'VBtn' }).props('disabled')).toBe(true)
        paused.wrapper.unmount()
        const standby = createTestWrapper({ presets: [200] }, 'standby')
        expect(standby.wrapper.findComponent({ name: 'VBtn' }).props('disabled')).toBe(false)
        standby.wrapper.unmount()
    })

    it('updates the input when the target prop changes', async () => {
        const { wrapper } = createTestWrapper({ target: 100 })
        await wrapper.setProps({ target: 220 } as never)
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('220')
        wrapper.unmount()
    })

    it('resets to target on blur', async () => {
        const { wrapper } = createTestWrapper({ target: 180 })
        await wrapper.find('input').setValue('50')
        await wrapper.find('input').trigger('blur')
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('180')
        wrapper.unmount()
    })

    it('exposes temperaturePresets as index/value pairs', () => {
        const { wrapper } = createTestWrapper({ presets: [60, 100] })
        expect(wrapper.text()).toContain('60°C')
        expect(wrapper.text()).toContain('100°C')
        wrapper.unmount()
    })
})
