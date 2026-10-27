import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import GeneralBackup from '@/components/settings/General/GeneralBackup.vue'

const mocks = vi.hoisted(() => ({
    dispatch: vi.fn(),
    namespaces: [{ value: 'general', label: 'General' }],
    loadCalls: 0,
}))

vi.mock('@/composables/useSettingsDatabase', async () => {
    const { ref } = await import('vue')
    return {
        useSettingsDatabase: () => ({
            loadings: ref([]),
            loadBackupableNamespaces: vi.fn(async () => {
                mocks.loadCalls += 1
                return [...mocks.namespaces]
            }),
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
                dispatchEvent: () => false,
            })),
        })
    }
})

beforeEach(() => {
    mocks.dispatch.mockReset()
    mocks.loadCalls = 0
    mocks.namespaces = [{ value: 'general', label: 'General' }]
})

const createTestWrapper = () => {
    const vuetify = createVuetify()
    const store = createStore({
        actions: {
            'socket/addLoading': (_ctx: never, payload: never) => {
                mocks.dispatch(['socket/addLoading', payload])
            },
            'gui/backupMoonrakerDB': (_ctx: never, payload: never) => {
                mocks.dispatch(['gui/backupMoonrakerDB', payload])
            },
            'socket/removeLoading': (_ctx: never, payload: never) => {
                mocks.dispatch(['socket/removeLoading', payload])
            },
        },
    })
    const wrapper = mount(GeneralBackup, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: { VDialog: VDialogStub, Panel: PanelStub },
        },
    })
    return { wrapper }
}

const dialogOf = (wrapper: ReturnType<typeof mount>) => wrapper.findComponent(VDialogStub)

const openDialog = async (wrapper: ReturnType<typeof mount>) => {
    await flushPromises()
    await wrapper
        .findAll('button')
        .find((b) => b.text().includes('Settings.GeneralTab.Backup'))!
        .trigger('click')
    await flushPromises()
}

describe('GeneralBackup', () => {
    it('loads backupable namespaces on mount', async () => {
        const { wrapper } = createTestWrapper()
        await flushPromises()
        expect(mocks.loadCalls).toBe(1)
        expect(wrapper.text()).toContain('General')
        wrapper.unmount()
    })

    it('reloads namespaces and opens the dialog', async () => {
        const { wrapper } = createTestWrapper()
        await openDialog(wrapper)
        expect(mocks.loadCalls).toBe(2)
        expect(dialogOf(wrapper).props('modelValue')).toBe(true)
        wrapper.unmount()
    })

    it('backs up the selected namespaces and closes the dialog', async () => {
        const { wrapper } = createTestWrapper()
        await openDialog(wrapper)
        const boxes = wrapper.findAll('input[type="checkbox"]')
        await boxes[1].setValue(true)
        await wrapper
            .findAll('button')
            .find((b) => b.text() === 'Settings.GeneralTab.Backup' && b.element.closest('.v-dialog-stub'))!
            .trigger('click')
        await flushPromises()
        expect(mocks.dispatch).toHaveBeenCalledWith(['socket/addLoading', 'backupMainsail'])
        expect(mocks.dispatch).toHaveBeenCalledWith(['gui/backupMoonrakerDB', ['general']])
        expect(mocks.dispatch).toHaveBeenCalledWith(['socket/removeLoading', 'backupMainsail'])
        expect(dialogOf(wrapper).props('modelValue')).toBe(false)
        wrapper.unmount()
    })

    it('backs up an empty selection without namespaces', async () => {
        const { wrapper } = createTestWrapper()
        await openDialog(wrapper)
        await wrapper
            .findAll('button')
            .find((b) => b.text() === 'Settings.GeneralTab.Backup' && b.element.closest('.v-dialog-stub'))!
            .trigger('click')
        await flushPromises()
        expect(mocks.dispatch).toHaveBeenCalledWith(['gui/backupMoonrakerDB', []])
        wrapper.unmount()
    })
})
