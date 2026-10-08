import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import NumberInput from '@/components/inputs/NumberInput.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({}),
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

const createTestWrapper = (props: Record<string, unknown> = {}) => {
    const vuetify = createVuetify()
    const wrapper = mount(NumberInput, {
        global: {
            plugins: [vuetify],
            mocks: { $t: (s: string) => s },
        },
        props: {
            label: 'Speed',
            param: 'speed',
            target: 100,
            min: 0,
            max: 200,
            dec: 0,
            ...props,
        } as never,
    })
    return { wrapper }
}

describe('NumberInput', () => {
    it('renders with the target value', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('input').exists()).toBe(true)
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('100')
        wrapper.unmount()
    })

    it('emits submit on form submit with parsed value', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('input').setValue('150')
        await wrapper.find('form').trigger('submit')
        expect(wrapper.emitted('submit')).toBeTruthy()
        expect(wrapper.emitted('submit')![0]).toEqual([{ name: 'speed', value: 150 }])
        wrapper.unmount()
    })

    it('parses comma decimal separator', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('input').setValue('12,5')
        await wrapper.find('form').trigger('submit')
        expect(wrapper.emitted('submit')![0]).toEqual([{ name: 'speed', value: 12.5 }])
        wrapper.unmount()
    })

    it('treats empty input as zero', async () => {
        const { wrapper } = createTestWrapper({ min: 0, max: null, outputErrorMsg: false })
        await wrapper.find('input').setValue('')
        await wrapper.find('form').trigger('submit')
        expect(wrapper.emitted('submit')![0]).toEqual([{ name: 'speed', value: 0 }])
        wrapper.unmount()
    })

    it('syncs the input when target prop changes', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.setProps({ target: 42 } as never)
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('42')
        wrapper.unmount()
    })

    it('increments by step times spinnerFactor', async () => {
        const { wrapper } = createTestWrapper({ hasSpinner: true, step: 5, spinnerFactor: 2 })
        const buttons = wrapper.findAll('button')
        await buttons[0].trigger('click')
        // 100 + 5*2 = 110
        expect(wrapper.emitted('submit')![0]).toEqual([{ name: 'speed', value: 110 }])
        wrapper.unmount()
    })

    it('clamps increment to max', async () => {
        const { wrapper } = createTestWrapper({ hasSpinner: true, step: 50, target: 190, max: 200 })
        const buttons = wrapper.findAll('button')
        await buttons[0].trigger('click')
        expect(wrapper.emitted('submit')![0]).toEqual([{ name: 'speed', value: 200 }])
        wrapper.unmount()
    })

    it('allows increment past max when max is null', async () => {
        const { wrapper } = createTestWrapper({ hasSpinner: true, step: 10, target: 100, max: null })
        const buttons = wrapper.findAll('button')
        await buttons[0].trigger('click')
        expect(wrapper.emitted('submit')![0]).toEqual([{ name: 'speed', value: 110 }])
        wrapper.unmount()
    })

    it('decrements by step and clamps to min', async () => {
        const { wrapper } = createTestWrapper({ hasSpinner: true, step: 10, target: 5, min: 0 })
        const buttons = wrapper.findAll('button')
        // second button is decrement
        await buttons[1].trigger('click')
        expect(wrapper.emitted('submit')![0]).toEqual([{ name: 'speed', value: 0 }])
        wrapper.unmount()
    })

    it('respects dec rounding on spinner', async () => {
        const { wrapper } = createTestWrapper({ hasSpinner: true, step: 0.1, dec: 1, target: 1 })
        const buttons = wrapper.findAll('button')
        await buttons[0].trigger('click')
        expect(wrapper.emitted('submit')![0]).toEqual([{ name: 'speed', value: 1.1 }])
        wrapper.unmount()
    })

    it('resets to default value', async () => {
        const { wrapper } = createTestWrapper({ defaultValue: 60 })
        await wrapper.find('input').setValue('10')
        const icons = wrapper.findAllComponents({ name: 'VIcon' })
        expect(icons.length).toBeGreaterThan(0)
        await icons[icons.length - 1].trigger('click')
        const emitted = wrapper.emitted('submit')
        expect(emitted).toBeTruthy()
        expect(emitted![emitted!.length - 1]).toEqual([{ name: 'speed', value: 60 }])
        wrapper.unmount()
    })

    it('blocks submit when input is invalid', async () => {
        const { wrapper } = createTestWrapper({ min: 10, max: 20, target: 15, outputErrorMsg: true })
        await wrapper.find('input').setValue('5')
        await wrapper.find('form').trigger('submit')
        expect(wrapper.emitted('submit')).toBeFalsy()
        wrapper.unmount()
    })

    it('reports MustBeBetween error above max', async () => {
        const { wrapper } = createTestWrapper({ min: 0, max: 100, target: 50, outputErrorMsg: true })
        await wrapper.find('input').setValue('150')
        expect(wrapper.text()).toContain('App.NumberInput.MustBeBetweenError')
        wrapper.unmount()
    })

    it('reports GreaterOrEqual error when max is null', async () => {
        const { wrapper } = createTestWrapper({ min: 10, max: null, target: 15, outputErrorMsg: true })
        await wrapper.find('input').setValue('5')
        expect(wrapper.text()).toContain('App.NumberInput.GreaterOrEqualError')
        wrapper.unmount()
    })

    it('returns no errors when outputErrorMsg is false', async () => {
        const { wrapper } = createTestWrapper({ min: 10, max: 20, target: 5, outputErrorMsg: false })
        await wrapper.find('input').setValue('5')
        // no error text rendered, submit still emitted (invalidInput false)
        await wrapper.find('form').trigger('submit')
        expect(wrapper.emitted('submit')).toBeTruthy()
        wrapper.unmount()
    })

    it('prevents invalid chars e, E, + and - when min >= 0', async () => {
        const { wrapper } = createTestWrapper({ min: 0 })
        for (const key of ['e', 'E', '+', '-']) {
            const prevented: boolean[] = []
            await wrapper.find('input').trigger('keydown', {
                key,
                preventDefault: () => prevented.push(true),
            })
            expect(prevented).toEqual([true])
        }
        wrapper.unmount()
    })

    it('allows minus when min is negative', async () => {
        const { wrapper } = createTestWrapper({ min: -10, max: 10, target: 0 })
        const prevented: boolean[] = []
        await wrapper.find('input').trigger('keydown', {
            key: '-',
            preventDefault: () => prevented.push(true),
        })
        // invalidChars only gets '-' pushed when min >= 0, so no prevent
        expect(prevented).toEqual([])
        wrapper.unmount()
    })

    it('resets to target on blur', async () => {
        const { wrapper } = createTestWrapper({ target: 77 })
        await wrapper.find('input').setValue('5')
        await wrapper.find('input').trigger('blur')
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('77')
        wrapper.unmount()
    })
})
