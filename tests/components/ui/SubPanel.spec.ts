import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import SubPanel from '@/components/ui/SubPanel.vue'

const mocks = vi.hoisted(() => ({
    dispatch: vi.fn(),
    viewport: null as unknown as { value: string },
}))

vi.mock('@/composables/useBase', async () => {
    const { ref } = await import('vue')
    mocks.viewport = ref('desktop')
    return { useBase: () => ({ viewport: mocks.viewport }) }
})

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
                dispatchEvent: () => false,
            })),
        })
    }
})

beforeEach(() => {
    mocks.dispatch.mockReset()
    mocks.viewport.value = 'desktop'
})

const createTestWrapper = (expanded: boolean, props: Record<string, unknown> = {}) => {
    const vuetify = createVuetify()
    const store = createStore({
        getters: {
            'gui/getPanelExpand': () => () => expanded,
        },
        actions: {
            'gui/saveExpandPanel': (_ctx: never, payload: never) => {
                mocks.dispatch(payload)
            },
        },
    })
    const wrapper = mount(SubPanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
        },
        props: { title: 'Sensors', subPanelClass: 'test-panel', ...props } as never,
        slots: { default: '<div data-testid="panel-body">body</div>' },
    })
    return { wrapper }
}

describe('SubPanel', () => {
    it('renders the title', () => {
        const { wrapper } = createTestWrapper(true)
        expect(wrapper.text()).toContain('Sensors')
        wrapper.unmount()
    })

    it('collapses the panel on header click', async () => {
        const { wrapper } = createTestWrapper(true)
        await wrapper.find('button').trigger('click')
        expect(mocks.dispatch).toHaveBeenCalledWith({
            name: 'test-panel',
            value: false,
            viewport: 'desktop',
        })
        wrapper.unmount()
    })

    it('expands the panel on header click', async () => {
        const { wrapper } = createTestWrapper(false)
        await wrapper.find('button').trigger('click')
        expect(mocks.dispatch).toHaveBeenCalledWith({
            name: 'test-panel',
            value: true,
            viewport: 'desktop',
        })
        wrapper.unmount()
    })

    it('passes the current viewport to the expand lookup', async () => {
        mocks.viewport.value = 'mobile'
        const getPanelExpand = vi.fn(() => true)
        const vuetify = createVuetify()
        const store = createStore({
            getters: { 'gui/getPanelExpand': () => getPanelExpand },
            actions: { 'gui/saveExpandPanel': () => {} },
        })
        const wrapper = mount(SubPanel, {
            global: { plugins: [vuetify, store], mocks: { $t: (s: string) => s } },
            props: { title: 'Sensors', subPanelClass: 'test-panel' } as never,
        })
        expect(getPanelExpand).toHaveBeenCalledWith('test-panel', 'mobile')
        wrapper.unmount()
    })
})
