import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import CheckboxList from '@/components/inputs/CheckboxList.vue'

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
                dispatchEvent: () => false,
            })),
        })
    }
})

const options = [
    { label: 'Alpha', value: 'a' },
    { label: 'Beta', value: 'b' },
    { label: 'Gamma', value: 'c' },
]

const createTestWrapper = (props: Record<string, unknown> = {}) => {
    const vuetify = createVuetify()
    const wrapper = mount(CheckboxList, {
        global: {
            plugins: [vuetify],
            mocks: { $t: (s: string) => s },
        },
        props: { options, ...props } as never,
    })
    return { wrapper }
}

const getCheckboxes = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('input[type="checkbox"]')

describe('CheckboxList', () => {
    it('renders one checkbox per option and no select-all by default', () => {
        const { wrapper } = createTestWrapper()
        expect(getCheckboxes(wrapper)).toHaveLength(3)
        expect(wrapper.text()).toContain('Alpha')
        expect(wrapper.text()).toContain('Beta')
        expect(wrapper.text()).toContain('Gamma')
        wrapper.unmount()
    })

    it('renders the select-all checkbox when enabled', () => {
        const { wrapper } = createTestWrapper({ selectAll: true })
        expect(getCheckboxes(wrapper)).toHaveLength(4)
        wrapper.unmount()
    })

    it('emits the toggled option on individual change', async () => {
        const { wrapper } = createTestWrapper()
        await getCheckboxes(wrapper)[0].setValue(true)
        expect(wrapper.emitted('update:selectedCheckboxes')).toBeTruthy()
        expect(wrapper.emitted('update:selectedCheckboxes')![0]).toEqual([['a']])
        wrapper.unmount()
    })

    it('selects every option through select-all', async () => {
        const { wrapper } = createTestWrapper({ selectAll: true })
        await getCheckboxes(wrapper)[0].setValue(true)
        const emitted = wrapper.emitted('update:selectedCheckboxes')!
        expect(emitted[emitted.length - 1]).toEqual([['a', 'b', 'c']])
        wrapper.unmount()
    })

    it('clears the selection when select-all is unchecked', async () => {
        const { wrapper } = createTestWrapper({ selectAll: true })
        const boxes = getCheckboxes(wrapper)
        await boxes[0].setValue(true)
        await boxes[0].setValue(false)
        const emitted = wrapper.emitted('update:selectedCheckboxes')!
        expect(emitted[emitted.length - 1]).toEqual([[]])
        wrapper.unmount()
    })

    it('marks select-all indeterminate on a partial selection', async () => {
        const { wrapper } = createTestWrapper({ selectAll: true })
        // check one individual option (second checkbox overall)
        await getCheckboxes(wrapper)[1].setValue(true)
        const selectAll = wrapper.findAllComponents({ name: 'VCheckbox' })[0]
        expect(selectAll.props('indeterminate')).toBe(true)
        wrapper.unmount()
    })
})
