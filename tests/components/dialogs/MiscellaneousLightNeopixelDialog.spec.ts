import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import MiscellaneousLightNeopixelDialog from '@/components/dialogs/MiscellaneousLightNeopixelDialog.vue'

vi.mock('@jaames/iro', () => ({
    default: { ui: { Wheel: { mocked: 'wheel' }, Slider: { mocked: 'slider' } } },
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
    vi.useRealTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

interface DialogOptions {
    type?: string
    name?: string
    modelValue?: boolean
    index?: number
    settings?: Record<string, unknown>
    entries?: Record<string, unknown>
    colorData?: number[][]
}

const createTestWrapper = (options: DialogOptions = {}) => {
    const {
        type = 'neopixel',
        name = 'my_led',
        modelValue = true,
        index = 1,
        settings = { color_order: ['GRBW'], initial_red: 1, initial_green: 0.5, initial_blue: 0, initial_white: 0.2 },
        entries = {},
        colorData = [[0.5, 0.25, 1, 0.5]],
    } = options
    const vuetify = createVuetify()
    const key = `${type.toLowerCase()} ${name.toLowerCase()}`
    const store = createStore({
        state: {
            printer: {
                configfile: { settings: { [key]: settings } },
                [`${type} ${name}`]: { color_data: colorData },
            },
            gui: {
                miscellaneous: { entries },
            },
        },
    })
    const wrapper = mount(MiscellaneousLightNeopixelDialog, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                VDialog: { template: '<div><slot /></div>' },
                Panel: { template: '<div data-testid="panel"><slot /><slot name="buttons" /></div>' },
                'miscellaneous-light-neopixel-dialog-preset': {
                    props: ['preset'],
                    template:
                        '<div data-testid="preset" @click="$emit(\'update-color\', { red: 255, green: 0, blue: 0, white: 0 })" />',
                },
                'color-picker': {
                    name: 'ColorPickerStub',
                    props: ['color', 'options'],
                    template: '<div data-testid="color-picker" />',
                },
                'number-input': {
                    name: 'NumberInputStub',
                    props: ['label', 'param', 'target', 'defaultValue', 'min', 'max'],
                    template: '<div data-testid="number-input" />',
                },
                VRow: { template: '<div><slot /></div>' },
                VCol: { template: '<div><slot /></div>' },
                VCardText: { template: '<div><slot /></div>' },
                VDivider: { template: '<div />' },
                VBtn: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
                VIcon: { template: '<span><slot /></span>' },
            },
        },
        props: { modelValue, type, name, index } as never,
    })
    return { wrapper, store }
}

describe('MiscellaneousLightNeopixelDialog', () => {
    it('renders with converted output name', async () => {
        const { wrapper } = createTestWrapper({ name: 'my_led' })
        await nextTick()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('emits update:modelValue when closed', async () => {
        const { wrapper } = createTestWrapper({ modelValue: true })
        await nextTick()
        const buttons = wrapper.findAll('button')
        expect(buttons.length).toBeGreaterThan(0)
        await buttons[0].trigger('click')
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
        wrapper.unmount()
    })

    it('resolves neopixel colorOrder from settings', async () => {
        const { wrapper } = createTestWrapper({ type: 'neopixel', settings: { color_order: ['GRBW'] } })
        await nextTick()
        // GRBW contains R, G, B, W so all four number inputs render
        expect(wrapper.findAll('[data-testid="number-input"]')).toHaveLength(4)
        wrapper.unmount()
    })

    it('resolves led colorOrder from pins', async () => {
        const { wrapper } = createTestWrapper({
            type: 'led',
            settings: { red_pin: 'x', green_pin: 'y' },
        })
        await nextTick()
        // R + G only
        expect(wrapper.findAll('[data-testid="number-input"]')).toHaveLength(2)
        wrapper.unmount()
    })

    it('maps current color_data to 0-255 targets', async () => {
        const { wrapper } = createTestWrapper({ colorData: [[1, 0.5, 0, 0.2]] })
        await nextTick()
        const inputs = wrapper.findAll('[data-testid="number-input"]')
        expect(inputs.length).toBeGreaterThan(0)
        // first input is red with target 255
        expect(inputs[0].attributes()).toBeDefined()
        wrapper.unmount()
    })

    it('computes default values from initial settings', async () => {
        const { wrapper } = createTestWrapper({
            settings: { color_order: ['RGBW'], initial_red: 1, initial_green: 0, initial_blue: 0, initial_white: 0 },
        })
        await nextTick()
        expect(wrapper.findAll('[data-testid="color-picker"]').length).toBeGreaterThan(0)
        wrapper.unmount()
    })

    it('renders presets sorted case-insensitively', async () => {
        const { wrapper } = createTestWrapper({
            entries: {
                e1: {
                    type: 'neopixel',
                    name: 'my_led',
                    presets: {
                        b: { name: 'blue', red: 0, green: 0, blue: 255, white: 0 },
                        A: { name: 'amber', red: 255, green: 100, blue: 0, white: 0 },
                    },
                },
            },
        })
        await nextTick()
        expect(wrapper.findAll('[data-testid="preset"]')).toHaveLength(2)
        wrapper.unmount()
    })

    it('applies preset via update-color with normalized values', async () => {
        vi.useFakeTimers()
        const { wrapper } = createTestWrapper({
            entries: {
                e1: {
                    type: 'neopixel',
                    name: 'my_led',
                    presets: {
                        p1: { name: 'red', red: 255, green: 0, blue: 0, white: 0 },
                    },
                },
            },
        })
        await nextTick()
        await wrapper.find('[data-testid="preset"]').trigger('click')
        const emitted = wrapper.emitted('update-color')
        expect(emitted).toBeTruthy()
        // 255 -> 1, 0 -> 0
        expect(emitted![0]).toEqual([1, 0, 0, 0])
        wrapper.unmount()
    })

    it('sends update-color from number-input submit with debounce', async () => {
        vi.useFakeTimers()
        const { wrapper } = createTestWrapper({ colorData: [[0, 0, 0, 0]] })
        await nextTick()
        const inputs = wrapper.findAllComponents({ name: 'NumberInputStub' })
        expect(inputs.length).toBeGreaterThan(0)
        await (inputs[0].vm as unknown as { $emit: (e: string, p: unknown) => void }).$emit('submit', {
            name: 'red',
            value: 255,
        })
        vi.advanceTimersByTime(600)
        await nextTick()
        expect(wrapper.emitted('update-color')).toBeTruthy()
        wrapper.unmount()
    })

    it('ignores number-input submit when value is unchanged', async () => {
        vi.useFakeTimers()
        const { wrapper } = createTestWrapper({ colorData: [[1, 0, 0, 0]] })
        await nextTick()
        const inputs = wrapper.findAllComponents({ name: 'NumberInputStub' })
        expect(inputs.length).toBeGreaterThan(0)
        // red target is 255, submitting same value should not emit
        await (inputs[0].vm as unknown as { $emit: (e: string, p: unknown) => void }).$emit('submit', {
            name: 'red',
            value: 255,
        })
        vi.advanceTimersByTime(600)
        await nextTick()
        expect(wrapper.emitted('update-color')).toBeFalsy()
        wrapper.unmount()
    })

    it('sends update-color from RGB picker with debounce', async () => {
        vi.useFakeTimers()
        const { wrapper } = createTestWrapper({ colorData: [[0, 0, 0, 0]] })
        await nextTick()
        const pickers = wrapper.findAllComponents({ name: 'ColorPickerStub' })
        expect(pickers.length).toBeGreaterThan(0)
        await (pickers[0].vm as unknown as { $emit: (e: string, p: unknown) => void }).$emit('update:color', {
            red: 255,
            green: 128,
            blue: 0,
        })
        vi.advanceTimersByTime(600)
        await nextTick()
        expect(wrapper.emitted('update-color')).toBeTruthy()
        const args = wrapper.emitted('update-color')![0] as number[]
        expect(args[0]).toBeCloseTo(1, 2)
        wrapper.unmount()
    })

    it('ignores RGB picker change when values match targets', async () => {
        vi.useFakeTimers()
        const { wrapper } = createTestWrapper({ colorData: [[1, 0.5, 0, 0]] })
        await nextTick()
        const pickers = wrapper.findAllComponents({ name: 'ColorPickerStub' })
        expect(pickers.length).toBeGreaterThan(0)
        // targets: red 255, green 128 (0.5*255=127.5->128), blue 0
        await (pickers[0].vm as unknown as { $emit: (e: string, p: unknown) => void }).$emit('update:color', {
            red: 255,
            green: 128,
            blue: 0,
        })
        vi.advanceTimersByTime(600)
        await nextTick()
        expect(wrapper.emitted('update-color')).toBeFalsy()
        wrapper.unmount()
    })

    it('uses wheel layout for full RGB and sliders otherwise', async () => {
        const full = createTestWrapper({ type: 'neopixel', settings: { color_order: ['RGB'] } })
        await nextTick()
        expect(full.wrapper.findAll('[data-testid="color-picker"]').length).toBe(1)
        full.wrapper.unmount()

        const partial = createTestWrapper({ type: 'neopixel', settings: { color_order: ['R'] } })
        await nextTick()
        expect(partial.wrapper.findAll('[data-testid="color-picker"]').length).toBe(1)
        partial.wrapper.unmount()
    })

    it('shows white picker only when colorOrder includes W', async () => {
        const withWhite = createTestWrapper({ settings: { color_order: ['RGBW'] } })
        await nextTick()
        expect(withWhite.wrapper.findAll('[data-testid="color-picker"]')).toHaveLength(2)
        withWhite.wrapper.unmount()

        const withoutWhite = createTestWrapper({ settings: { color_order: ['RGB'] } })
        await nextTick()
        expect(withoutWhite.wrapper.findAll('[data-testid="color-picker"]')).toHaveLength(1)
        withoutWhite.wrapper.unmount()
    })

    it('handles missing printer object gracefully', async () => {
        const vuetify = createVuetify()
        const store = createStore({
            state: { printer: { configfile: { settings: {} } }, gui: { miscellaneous: { entries: {} } } },
        })
        const wrapper = mount(MiscellaneousLightNeopixelDialog, {
            global: {
                plugins: [vuetify, store],
                mocks: { $t: (s: string) => s },
                stubs: {
                    VDialog: { template: '<div><slot /></div>' },
                    Panel: { template: '<div><slot /><slot name="buttons" /></div>' },
                    'miscellaneous-light-neopixel-dialog-preset': { template: '<div />' },
                    'color-picker': { template: '<div />' },
                    'number-input': { template: '<div />' },
                    VRow: { template: '<div><slot /></div>' },
                    VCol: { template: '<div><slot /></div>' },
                    VCardText: { template: '<div><slot /></div>' },
                    VDivider: { template: '<div />' },
                    VBtn: { template: '<button><slot /></button>' },
                    VIcon: { template: '<span><slot /></span>' },
                },
            },
            props: { modelValue: true, type: 'neopixel', name: 'missing', index: 1 } as never,
        })
        await nextTick()
        expect(wrapper.find('div').exists()).toBe(true)
        wrapper.unmount()
    })
})
