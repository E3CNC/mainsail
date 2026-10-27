import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import MoveToInput from '@/components/inputs/MoveToInput.vue'

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

const createTestWrapper = (props: Record<string, unknown> = {}) => {
    const vuetify = createVuetify()
    const wrapper = mount(MoveToInput, {
        global: {
            plugins: [vuetify],
            mocks: { $t: (s: string) => s },
        },
        props: {
            position: '10',
            currentPos: '10',
            label: 'X',
            ...props,
        } as never,
    })
    return { wrapper }
}

describe('MoveToInput', () => {
    it('renders the input with the position value and label', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('input').exists()).toBe(true)
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('10')
        expect(wrapper.text()).toContain('X')
        wrapper.unmount()
    })

    it('emits update:position when the input changes', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('input').setValue('25')
        expect(wrapper.emitted('update:position')).toBeTruthy()
        expect(wrapper.emitted('update:position')![0]).toEqual(['25'])
        wrapper.unmount()
    })

    it('resets to currentPos on blur when the value drifted', async () => {
        const { wrapper } = createTestWrapper({ position: '10', currentPos: '42' })
        await wrapper.find('input').trigger('blur')
        expect(wrapper.emitted('update:position')).toBeTruthy()
        expect(wrapper.emitted('update:position')![0]).toEqual(['42'])
        wrapper.unmount()
    })

    it('does not emit on blur when the value matches currentPos', async () => {
        const { wrapper } = createTestWrapper({ position: '10', currentPos: '10' })
        await wrapper.find('input').trigger('blur')
        expect(wrapper.emitted('update:position')).toBeFalsy()
        wrapper.unmount()
    })

    it('emits submit on form submit', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('form').trigger('submit')
        expect(wrapper.emitted('submit')).toBeTruthy()
        wrapper.unmount()
    })
})
