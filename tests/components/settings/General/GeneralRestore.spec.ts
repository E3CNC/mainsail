import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import GeneralRestore from '@/components/settings/General/GeneralRestore.vue'

const mocks = vi.hoisted(() => ({
    dispatch: vi.fn(),
    toastError: vi.fn(),
}))

vi.mock('@/composables/useSettingsDatabase', async () => {
    const { ref } = await import('vue')
    return {
        useSettingsDatabase: () => ({
            loadings: ref([]),
            availableKeys: ref([{ value: 'general', label: 'General' }]),
            sortNamespaces: (a: { value: string; label: unknown }, b: { value: string; label: unknown }) => {
                if (a.value === 'general') return -1
                if (b.value === 'general') return 1
                return a.label!.toString().localeCompare(b.label!.toString())
            },
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
    mocks.toastError.mockReset()
    vi.spyOn(window.console, 'error').mockImplementation(() => {})
})

const createTestWrapper = () => {
    const vuetify = createVuetify()
    const store = createStore({
        actions: {
            'socket/addLoading': (_ctx: never, payload: never) => {
                mocks.dispatch(['socket/addLoading', payload])
            },
            'gui/restoreMoonrakerDB': (_ctx: never, payload: never) => {
                mocks.dispatch(['gui/restoreMoonrakerDB', payload])
            },
        },
    })
    // $toast via app-level globalProperties (the component reads it through
    // getCurrentInstance().proxy, which does not see VTU per-instance mocks)
    const toastPlugin = (app: { config: { globalProperties: Record<string, unknown> } }) => {
        app.config.globalProperties.$toast = { error: mocks.toastError }
    }
    const wrapper = mount(GeneralRestore, {
        global: {
            plugins: [vuetify, store, toastPlugin as never],
            mocks: { $t: (s: string) => s },
            stubs: { VDialog: VDialogStub, Panel: PanelStub },
        },
    })
    return { wrapper }
}

const dialogOf = (wrapper: ReturnType<typeof mount>) => wrapper.findComponent(VDialogStub)

const uploadFile = async (wrapper: ReturnType<typeof mount>, content: string) => {
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    const file = new File([content], 'backup.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await wrapper.find('input[type="file"]').trigger('change')
    // FileReader works async in jsdom; wait for the onload handler
    await new Promise((resolve) => setTimeout(resolve, 50))
    await flushPromises()
}

describe('GeneralRestore', () => {
    it('opens the file picker on restore click', async () => {
        const { wrapper } = createTestWrapper()
        const clickSpy = vi.spyOn(wrapper.find('input[type="file"]').element as HTMLInputElement, 'click')
        await wrapper
            .findAll('button')
            .find((b) => b.text().includes('Settings.GeneralTab.Restore'))!
            .trigger('click')
        expect(clickSpy).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('errors when no file was uploaded', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('input[type="file"]').trigger('change')
        expect(window.console.error).toHaveBeenCalledWith('No json uploaded')
        wrapper.unmount()
    })

    it('parses namespaces from a valid backup and opens the dialog', async () => {
        const { wrapper } = createTestWrapper()
        await uploadFile(wrapper, JSON.stringify({ general: { printername: 'Test' }, custom: {} }))
        expect(dialogOf(wrapper).props('modelValue')).toBe(true)
        expect(wrapper.text()).toContain('General')
        expect(wrapper.text()).toContain('custom')
        wrapper.unmount()
    })

    it('toasts when the backup is not valid json', async () => {
        // jsdom does not reliably deliver FileReader load events for all
        // blob contents, so drive the component handler with a synchronous
        // reader fake and assert the parse-failure path deterministically.
        const OriginalFileReader = window.FileReader
        class SyncFileReader {
            onload: ((evt: { target: { result: string } }) => void) | null = null
            readAsText() {
                // async like the real reader: the component assigns onload
                // after calling readAsText
                void Promise.resolve().then(() => this.onload?.({ target: { result: '[1,2,' } }))
            }
        }
        window.FileReader = SyncFileReader as unknown as typeof FileReader
        try {
            const { wrapper } = createTestWrapper()
            await uploadFile(wrapper, '[1,2,')
            expect(mocks.toastError).toHaveBeenCalledWith('Settings.GeneralTab.CannotReadJson')
            expect(dialogOf(wrapper).props('modelValue')).toBe(false)
            wrapper.unmount()
        } finally {
            window.FileReader = OriginalFileReader
        }
    })

    it('restores the selected namespaces with the parsed objects', async () => {
        const { wrapper } = createTestWrapper()
        const objects = { general: { printername: 'Test' } }
        await uploadFile(wrapper, JSON.stringify(objects))
        const boxes = wrapper.findAll('input[type="checkbox"]')
        await boxes[1].setValue(true)
        await wrapper
            .findAll('button')
            .find((b) => b.text() === 'Settings.GeneralTab.Restore' && b.element.closest('.v-dialog-stub'))!
            .trigger('click')
        expect(mocks.dispatch).toHaveBeenCalledWith(['socket/addLoading', 'restoreDbAction'])
        expect(mocks.dispatch).toHaveBeenCalledWith([
            'gui/restoreMoonrakerDB',
            { dbCheckboxes: ['general'], restoreObjects: objects },
        ])
        wrapper.unmount()
    })
})
