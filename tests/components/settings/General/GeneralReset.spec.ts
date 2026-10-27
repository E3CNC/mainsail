import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import GeneralReset from '@/components/settings/General/GeneralReset.vue'

const mocks = vi.hoisted(() => ({
    dispatch: vi.fn(),
    namespaces: [{ value: 'general', label: 'General' }],
    components: ['history'] as string[],
}))

vi.mock('@/composables/useSettingsDatabase', async () => {
    const { ref } = await import('vue')
    return {
        useSettingsDatabase: () => ({
            loadings: ref([]),
            moonrakerComponents: ref(mocks.components),
            loadBackupableNamespaces: vi.fn(async () => [...mocks.namespaces]),
        }),
    }
})

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({}),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

const VDialogStub = {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div class="v-dialog-stub"><slot /></div>',
}

const PanelStub = {
    template: '<div class="panel-stub"><slot /><slot name="buttons" /></div>',
}

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
    mocks.dispatch.mockReset()
    mocks.components = ['history']
    mocks.namespaces = [{ value: 'general', label: 'General' }]
})

const createTestWrapper = () => {
    const vuetify = createVuetify()
    const store = createStore({
        actions: {
            'socket/addLoading': (_ctx: never, payload: never) => {
                mocks.dispatch(['socket/addLoading', payload])
            },
            'gui/resetMoonrakerDB': (_ctx: never, payload: never) => {
                mocks.dispatch(['gui/resetMoonrakerDB', payload])
            },
        },
    })
    const wrapper = mount(GeneralReset, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: { VDialog: VDialogStub, Panel: PanelStub },
        },
    })
    return { wrapper }
}

const dialogOf = (wrapper: ReturnType<typeof mount>) => wrapper.findComponent(VDialogStub)

describe('GeneralReset', () => {
    it('loads resetable namespaces on mount and appends history entries', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(wrapper.text()).toContain('General')
        expect(wrapper.text()).toContain('Settings.GeneralTab.DbHistoryJobs')
        expect(wrapper.text()).toContain('Settings.GeneralTab.DbHistoryTotals')
        wrapper.unmount()
    })

    it('skips history entries when the history component is absent', async () => {
        mocks.components = []
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(wrapper.text()).not.toContain('Settings.GeneralTab.DbHistoryJobs')
        wrapper.unmount()
    })

    it('opens the dialog on button click', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        await wrapper
            .findAll('button')
            .find((b) => b.text().includes('Settings.GeneralTab.FactoryReset'))!
            .trigger('click')
        await flushPromises()
        expect(dialogOf(wrapper).props('modelValue')).toBe(true)
        wrapper.unmount()
    })

    it('resets the selected namespaces on confirm', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        await wrapper
            .findAll('button')
            .find((b) => b.text().includes('Settings.GeneralTab.FactoryReset'))!
            .trigger('click')
        await flushPromises()
        // select the first namespace checkbox (first box is select-all, second is 'general')
        const boxes = wrapper.findAll('input[type="checkbox"]')
        await boxes[1].setValue(true)
        await wrapper
            .findAll('button')
            .find((b) => b.text().includes('Settings.GeneralTab.Reset'))!
            .trigger('click')
        expect(mocks.dispatch).toHaveBeenCalledWith(['socket/addLoading', 'resetMainsail'])
        expect(mocks.dispatch).toHaveBeenCalledWith(['gui/resetMoonrakerDB', ['general']])
        wrapper.unmount()
    })
})
