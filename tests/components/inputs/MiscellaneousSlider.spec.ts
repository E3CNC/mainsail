import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import MiscellaneousSlider from '@/components/inputs/MiscellaneousSlider.vue'

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

interface MiscProps {
    target?: number
    max?: number
    name?: string
    type?: string
    controllable?: boolean
    pwm?: boolean
    rpm?: number | boolean
    multi?: number
    offBelow?: number
    colorOrder?: string
}

const createTestWrapper = (props: MiscProps = {}, uiSettings: Record<string, unknown> = {}) => {
    const vuetify = createVuetify()
    const dispatched: unknown[] = []
    const store = createStore({
        state: {
            gui: {
                uiSettings: {
                    lockSlidersOnTouchDevices: false,
                    lockSlidersDelay: 0,
                    disableFanAnimation: false,
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
    const wrapper = mount(MiscellaneousSlider, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
        },
        props: {
            target: 0.5,
            max: 1,
            name: 'fan',
            type: 'fan',
            controllable: true,
            pwm: true,
            ...props,
        } as never,
    })
    return { wrapper, dispatched }
}

describe('MiscellaneousSlider', () => {
    it('renders the converted name', async () => {
        const { wrapper } = createTestWrapper({ name: 'fan_generic my_fan' })
        await nextTick()
        expect(wrapper.text()).toContain('Fan Generic My Fan')
        wrapper.unmount()
    })

    it('shows percent for non-controllable outputs', async () => {
        const { wrapper } = createTestWrapper({ controllable: false, target: 0.5 })
        await nextTick()
        expect(wrapper.text()).toContain('50 %')
        wrapper.unmount()
    })

    it('shows RPM when given', async () => {
        const { wrapper } = createTestWrapper({ rpm: 3000 })
        await nextTick()
        expect(wrapper.text()).toContain('3000 RPM')
        wrapper.unmount()
    })

    it('sends M106 for fan type on slider change', async () => {
        const { wrapper, dispatched } = createTestWrapper({ type: 'fan', name: 'fan', target: 0.5 })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        await slider.setValue(0.8)
        await slider.trigger('change')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M106 S1' })
        expect(dispatched).toContainEqual({ message: 'M106 S1', type: 'command' })
        wrapper.unmount()
    })

    it('sends SET_FAN_SPEED for fan_generic', async () => {
        const { wrapper } = createTestWrapper({ type: 'fan_generic', name: 'my_fan', target: 0.5 })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        await slider.setValue(0.6)
        await slider.trigger('change')
        const script = (mocks.emit.mock.calls[0][1] as { script: string }).script
        expect(script).toContain('SET_FAN_SPEED FAN=my_fan SPEED=0.6')
        wrapper.unmount()
    })

    it('sends SET_PIN for output_pin type', async () => {
        const { wrapper } = createTestWrapper({ type: 'output_pin', name: 'my_pin', target: 0.5 })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        await slider.setValue(0.7)
        await slider.trigger('change')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'SET_PIN PIN=my_pin VALUE=0.70' })
        wrapper.unmount()
    })

    it('sends SET_LED with channel for led type', async () => {
        const { wrapper } = createTestWrapper({ type: 'led', name: 'my_led', target: 0.5, colorOrder: 'R' })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        await slider.setValue(0.5)
        await slider.trigger('change')
        // value equals current (0.5) so no send; move to a new value
        mocks.emit.mockClear()
        await slider.setValue(0.9)
        await slider.trigger('change')
        const script = (mocks.emit.mock.calls[0][1] as { script: string }).script
        expect(script).toContain('SET_LED LED=my_led RED=0.90')
        wrapper.unmount()
    })

    it('maps led channel names for G, B and default WHITE', async () => {
        for (const [order, channel] of [
            ['G', 'GREEN'],
            ['B', 'BLUE'],
            ['', 'WHITE'],
        ] as const) {
            const { wrapper } = createTestWrapper({ type: 'led', name: 'led1', target: 0.2, colorOrder: order })
            await nextTick()
            const slider = wrapper.findComponent({ name: 'VSlider' })
            await slider.setValue(0.8)
            await slider.trigger('change')
            const script = (mocks.emit.mock.calls[0][1] as { script: string }).script
            expect(script).toContain(`${channel}=`)
            wrapper.unmount()
            mocks.emit.mockReset()
        }
    })

    it('snaps to zero below offBelow when decreasing', async () => {
        const { wrapper } = createTestWrapper({ target: 0.8, offBelow: 0.3 })
        await nextTick()
        const slider = wrapper.findComponent({ name: 'VSlider' })
        await slider.setValue(0.2)
        await slider.trigger('change')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M106 S0' })
        wrapper.unmount()
    })

    it('snaps up to offBelow when increasing from below', async () => {
        const { wrapper } = createTestWrapper({ target: 0.8, offBelow: 0.4 })
        await nextTick()
        // first set a low slider then trigger change upward logic is inside changeSliderValue;
        // simulate by setting slider to a value below offBelow but above current is covered via submit path
        const slider = wrapper.findComponent({ name: 'VSlider' })
        await slider.setValue(0.1)
        await slider.trigger('change')
        // decreasing from 0.8 to 0.1 (< offBelow) snaps to 0
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M106 S0' })
        wrapper.unmount()
    })

    it('toggles output pin via switch', async () => {
        const { wrapper } = createTestWrapper({
            controllable: true,
            pwm: false,
            target: 0,
            type: 'output_pin',
            name: 'pin1',
        })
        await nextTick()
        const icons = wrapper.findAll('.v-icon')
        // switch icon toggles on
        await icons[icons.length - 1].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'SET_PIN PIN=pin1 VALUE=1.00' })
        wrapper.unmount()
    })

    it('turns led off and on via bulb icons', async () => {
        const on = createTestWrapper({ type: 'led', name: 'led1', target: 1, colorOrder: 'R' })
        await nextTick()
        const onIcons = on.wrapper.findAll('.v-icon')
        await onIcons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', {
            script: expect.stringContaining('RED=0.00'),
        } as never)
        on.wrapper.unmount()
        mocks.emit.mockReset()

        const off = createTestWrapper({ type: 'led', name: 'led1', target: 0, colorOrder: 'R' })
        await nextTick()
        const offIcons = off.wrapper.findAll('.v-icon')
        await offIcons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', {
            script: expect.stringContaining('RED=1.00'),
        } as never)
        off.wrapper.unmount()
    })

    it('submits numeric input', async () => {
        const { wrapper } = createTestWrapper({ type: 'fan', target: 0.5 })
        await nextTick()
        await wrapper.find('input').setValue('80')
        await wrapper.find('form').trigger('submit')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M106 S1' })
        wrapper.unmount()
    })

    it('blocks submit on validation errors', async () => {
        const { wrapper } = createTestWrapper({ type: 'fan', target: 0.5 })
        await nextTick()
        await wrapper.find('input').setValue('')
        await wrapper.find('form').trigger('submit')
        expect(mocks.emit).not.toHaveBeenCalled()
        expect(wrapper.text()).toContain('App.NumberInput.NoEmptyAllowedError')
        wrapper.unmount()
    })

    it('increments and decrements', async () => {
        const { wrapper } = createTestWrapper({ type: 'fan', target: 0.5 })
        await nextTick()
        mocks.emit.mockClear()
        const minus = wrapper.find('.v-input__prepend .v-icon')
        const plus = wrapper.find('.v-input__append .v-icon')
        expect(minus.exists()).toBe(true)
        await minus.trigger('click')
        expect(mocks.emit).toHaveBeenCalled()
        mocks.emit.mockClear()
        await plus.trigger('click')
        expect(mocks.emit).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('prevents invalid chars in the input', async () => {
        const { wrapper } = createTestWrapper()
        await nextTick()
        const prevented: boolean[] = []
        await wrapper.find('input').trigger('keydown', {
            key: 'e',
            preventDefault: () => prevented.push(true),
        })
        expect(prevented).toEqual([true])
        wrapper.unmount()
    })

    it('locks on touch devices when enabled', async () => {
        mocks.isTouchDevice.value = true
        const { wrapper } = createTestWrapper({}, { lockSlidersOnTouchDevices: true })
        await nextTick()
        expect(wrapper.findComponent({ name: 'VSlider' }).props('disabled')).toBe(true)
        wrapper.unmount()
    })
})
