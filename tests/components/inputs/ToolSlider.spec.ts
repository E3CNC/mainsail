import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import ToolSlider from '@/components/inputs/ToolSlider.vue'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
    isTouchDevice: { value: false, __v_isRef: true },
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ isTouchDevice: mocks.isTouchDevice }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('lodash.debounce', () => ({
    default: (fn: (...args: unknown[]) => void) => {
        const debounced = (...args: unknown[]) => fn(...args)
        ;(debounced as unknown as { cancel: () => void }).cancel = () => {}
        return debounced
    },
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
    mocks.emit.mockReset()
    mocks.isTouchDevice.value = false
})

interface ToolSliderProps {
    target?: number
    command?: string
    attributeName?: string
    label?: string
    unit?: string
    min?: number
    max?: number
    hasInputField?: boolean
    dynamicRange?: boolean
    defaultValue?: number
    step?: number
    multi?: number
    attributeScale?: number
}

const createTestWrapper = (props: ToolSliderProps = {}, uiSettings: Record<string, unknown> = {}) => {
    const vuetify = createVuetify()
    const dispatched: unknown[] = []
    const store = createStore({
        state: {
            gui: {
                uiSettings: {
                    lockSlidersOnTouchDevices: false,
                    lockSlidersDelay: 0,
                    ...uiSettings,
                },
            },
        },
        actions: {
            'server/addEvent': (_ctx: never, payload: never) => {
                dispatched.push(payload)
            },
        },
    })
    const wrapper = mount(ToolSlider, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
        },
        props: {
            target: 100,
            command: 'M220',
            attributeName: 'S',
            label: 'Feed',
            unit: '%',
            min: 0,
            max: 200,
            ...props,
        } as never,
    })
    return { wrapper, dispatched }
}

describe('ToolSlider', () => {
    it('renders label and value when no input field', async () => {
        const { wrapper } = createTestWrapper({ target: 100 })
        await nextTick()
        expect(wrapper.text()).toContain('Feed')
        expect(wrapper.text()).toContain('100')
        expect(wrapper.text()).toContain('%')
        wrapper.unmount()
    })

    it('maps target with multi scale', async () => {
        const { wrapper } = createTestWrapper({ target: 1.5, multi: 100 })
        await nextTick()
        expect(wrapper.text()).toContain('150')
        wrapper.unmount()
    })

    it('sends command with attributeScale on slider change', async () => {
        const { wrapper, dispatched } = createTestWrapper({ target: 100, attributeScale: 1 })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        await slider.setValue(150)
        await slider.trigger('change')
        // debounced mock calls sendCmd immediately
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M220 S150' })
        expect(dispatched).toContainEqual({ message: 'M220 S150', type: 'command' })
        wrapper.unmount()
    })

    it('clamps send value to minimum 1', async () => {
        const { wrapper } = createTestWrapper({ target: 100, min: 0 })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        await slider.setValue(0)
        await slider.trigger('change')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M220 S1' })
        wrapper.unmount()
    })

    it('expands processedMax in dynamicRange mode', async () => {
        const { wrapper } = createTestWrapper({ target: 50, max: 100, dynamicRange: true })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        await slider.setValue(120)
        await slider.trigger('change')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', {
            script: expect.stringContaining('M220'),
        } as never)
        // processedMax should have grown; increment still allowed past original max
        expect(wrapper.text()).toContain('120')
        wrapper.unmount()
    })

    it('shows warning color when value exceeds max', async () => {
        const { wrapper } = createTestWrapper({ target: 250, max: 200 })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        expect(slider.props('color')).toBe('warning')
        wrapper.unmount()
    })

    it('shows primary color within range', async () => {
        const { wrapper } = createTestWrapper({ target: 100, max: 200 })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        expect(slider.props('color')).toBe('primary')
        wrapper.unmount()
    })

    it('submits numeric input and sends command', async () => {
        const { wrapper } = createTestWrapper({ target: 100, hasInputField: true })
        await nextTick()
        await wrapper.find('input').setValue('150')
        await wrapper.find('form').trigger('submit')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M220 S150' })
        wrapper.unmount()
    })

    it('blocks submit when input has errors', async () => {
        const { wrapper } = createTestWrapper({ target: 100, max: 200, hasInputField: true })
        await nextTick()
        await wrapper.find('input').setValue('500')
        await wrapper.find('form').trigger('submit')
        expect(mocks.emit).not.toHaveBeenCalled()
        expect(wrapper.text()).toContain('App.NumberInput.MustBeBetweenError')
        wrapper.unmount()
    })

    it('reports empty and below-min errors', async () => {
        const { wrapper } = createTestWrapper({ target: 100, min: 10, hasInputField: true })
        await nextTick()
        await wrapper.find('input').setValue('')
        expect(wrapper.text()).toContain('App.NumberInput.NoEmptyAllowedError')
        await wrapper.find('input').setValue('5')
        expect(wrapper.text()).toContain('App.NumberInput.GreaterOrEqualError')
        wrapper.unmount()
    })

    it('resets to default value', async () => {
        const { wrapper } = createTestWrapper({ target: 100, defaultValue: 100, hasInputField: false })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        await slider.setValue(150)
        await slider.trigger('change')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M220 S150' })
        mocks.emit.mockClear()
        // reset button appears when value differs from default
        const buttons = wrapper.findAll('button')
        expect(buttons.length).toBeGreaterThan(0)
        await buttons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M220 S100' })
        wrapper.unmount()
    })

    it('increments and decrements by step', async () => {
        const { wrapper } = createTestWrapper({ target: 100, step: 5, defaultValue: 100 })
        await nextTick()
        mocks.emit.mockClear()
        const minus = wrapper.find('.v-input__prepend .v-icon')
        const plus = wrapper.find('.v-input__append .v-icon')
        expect(minus.exists()).toBe(true)
        expect(plus.exists()).toBe(true)
        await minus.trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M220 S95' })
        mocks.emit.mockClear()
        await plus.trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M220 S100' })
        wrapper.unmount()
    })

    it('prevents invalid chars', async () => {
        const { wrapper } = createTestWrapper({ hasInputField: true, min: 0 })
        await nextTick()
        const prevented: boolean[] = []
        await wrapper.find('input').trigger('keydown', {
            key: 'e',
            preventDefault: () => prevented.push(true),
        })
        expect(prevented).toEqual([true])
        wrapper.unmount()
    })

    it('locks sliders on touch devices when enabled', async () => {
        mocks.isTouchDevice.value = true
        const { wrapper } = createTestWrapper({}, { lockSlidersOnTouchDevices: true })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        expect(slider.props('disabled')).toBe(true)
        wrapper.unmount()
    })

    it('blurs back to slider value', async () => {
        const { wrapper } = createTestWrapper({ target: 100, hasInputField: true })
        await nextTick()
        await wrapper.find('input').setValue('999')
        await wrapper.find('input').trigger('blur')
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('100')
        wrapper.unmount()
    })
})
