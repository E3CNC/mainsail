import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import i18n from '@/plugins/i18n'
import HistoryListPanelAddMaintenance from '@/components/dialogs/HistoryListPanelAddMaintenance.vue'

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

const mountDialog = (modelValue = true) => {
    const store = createStore({
        state: {
            socket: { isConnected: true },
            server: { history: { job_totals: { total_filament_used: 8000, total_print_time: 7200 } } },
            printer: {},
            gui: {},
        },
        getters: {},
        actions: {
            'gui/maintenance/store': () => {},
        },
    })
    const dispatchSpy = vi.spyOn(store, 'dispatch')

    const vuetify = createVuetify()
    const wrapper = mount(HistoryListPanelAddMaintenance, {
        props: { modelValue },
        global: {
            plugins: [vuetify, store, i18n],
            mocks: { $t: (key: string) => key },
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot name="buttons" /><slot /></div>' },
                SettingsRow: { template: '<div><slot /></div>' },
                VDialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
            },
        },
    })
    return { wrapper, store, dispatchSpy }
}

const textFieldByLabel = (wrapper: VueWrapper, label: string) => {
    const found = wrapper.findAllComponents({ name: 'VTextField' }).find((field) => field.props('label') === label)
    if (!found) throw new Error(`text field "${label}" not found`)
    return found
}

const textFieldBySuffix = (wrapper: VueWrapper, suffix: string) => {
    const found = wrapper.findAllComponents({ name: 'VTextField' }).find((field) => field.props('suffix') === suffix)
    if (!found) throw new Error(`number field "${suffix}" not found`)
    return found
}

const checkboxes = (wrapper: VueWrapper) => wrapper.findAllComponents({ name: 'VCheckbox' })

const saveButton = (wrapper: VueWrapper) => {
    const found = wrapper.findAllComponents({ name: 'VBtn' }).find((button) => button.text().includes('Buttons.Save'))
    if (!found) throw new Error('save button not found')
    return found
}

const cancelButton = (wrapper: VueWrapper) => {
    const found = wrapper.findAllComponents({ name: 'VBtn' }).find((button) => button.text().includes('Buttons.Cancel'))
    if (!found) throw new Error('cancel button not found')
    return found
}

describe('HistoryListPanelAddMaintenance rendering', () => {
    it('renders the name, note and reminder controls when open', () => {
        const { wrapper } = mountDialog()
        expect(textFieldByLabel(wrapper, 'History.Name').exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'VTextarea' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'VSelect' }).exists()).toBe(true)
        wrapper.unmount()
    })

    it('renders nothing when the dialog is closed', () => {
        const { wrapper } = mountDialog(false)
        expect(wrapper.findComponent({ name: 'VTextField' }).exists()).toBe(false)
        wrapper.unmount()
    })

    it('offers no reminder, one-time and repeat options', () => {
        const { wrapper } = mountDialog()
        const items = wrapper.findComponent({ name: 'VSelect' }).props('items') as unknown[]
        expect(items).toHaveLength(3)
        wrapper.unmount()
    })
})

describe('HistoryListPanelAddMaintenance validation', () => {
    it('disables save while the name is empty', () => {
        const { wrapper } = mountDialog()
        expect(saveButton(wrapper).props('disabled')).toBe(true)
        wrapper.unmount()
    })

    it('enables save with a name and no reminder', async () => {
        const { wrapper } = mountDialog()
        await textFieldByLabel(wrapper, 'History.Name').find('input').setValue('Oil rods')
        expect(saveButton(wrapper).props('disabled')).not.toBe(true)
        wrapper.unmount()
    })

    it('requires at least one reminder channel once a reminder is set', async () => {
        const { wrapper } = mountDialog()
        await textFieldByLabel(wrapper, 'History.Name').find('input').setValue('Oil rods')
        await wrapper.findComponent({ name: 'VSelect' }).setValue('one-time')
        expect(saveButton(wrapper).props('disabled')).toBe(true)
        wrapper.unmount()
    })

    it('accepts a positive filament reminder value', async () => {
        const { wrapper } = mountDialog()
        await textFieldByLabel(wrapper, 'History.Name').find('input').setValue('Oil rods')
        await wrapper.findComponent({ name: 'VSelect' }).setValue('one-time')
        await checkboxes(wrapper)[0].setValue(true)
        expect(saveButton(wrapper).props('disabled')).toBe(true)
        await textFieldBySuffix(wrapper, 'History.Meter').find('input').setValue('50')
        expect(saveButton(wrapper).props('disabled')).not.toBe(true)
        wrapper.unmount()
    })

    it('validates the printtime and date reminder values', async () => {
        const { wrapper } = mountDialog()
        await textFieldByLabel(wrapper, 'History.Name').find('input').setValue('Oil rods')
        await wrapper.findComponent({ name: 'VSelect' }).setValue('repeat')
        await checkboxes(wrapper)[1].setValue(true)
        expect(saveButton(wrapper).props('disabled')).toBe(true)
        await textFieldBySuffix(wrapper, 'History.Hours').find('input').setValue('5')
        expect(saveButton(wrapper).props('disabled')).not.toBe(true)
        await checkboxes(wrapper)[1].setValue(false)
        await checkboxes(wrapper)[2].setValue(true)
        expect(saveButton(wrapper).props('disabled')).toBe(true)
        await textFieldBySuffix(wrapper, 'History.Days').find('input').setValue('30')
        expect(saveButton(wrapper).props('disabled')).not.toBe(true)
        wrapper.unmount()
    })
})

describe('HistoryListPanelAddMaintenance save flow', () => {
    it('stores the entry with totals and closes the dialog', async () => {
        const { wrapper, dispatchSpy } = mountDialog()
        await textFieldByLabel(wrapper, 'History.Name').find('input').setValue('Oil rods')
        await wrapper.findComponent({ name: 'VTextarea' }).find('textarea').setValue('use oil')
        await wrapper.findComponent({ name: 'VSelect' }).setValue('one-time')
        await checkboxes(wrapper)[0].setValue(true)
        await textFieldBySuffix(wrapper, 'History.Meter').find('input').setValue('50')
        await saveButton(wrapper).trigger('click')

        expect(dispatchSpy).toHaveBeenCalledWith(
            'gui/maintenance/store',
            expect.objectContaining({
                entry: expect.objectContaining({
                    name: 'Oil rods',
                    note: 'use oil',
                    end_time: null,
                    end_filament: null,
                    end_printtime: null,
                    start_filament: 8000,
                    start_printtime: 7200,
                    reminder: {
                        type: 'one-time',
                        filament: { bool: true, value: 50 },
                        printtime: { bool: false, value: 0 },
                        date: { bool: false, value: 0 },
                    },
                }),
            })
        )
        const payload = dispatchSpy.mock.calls[0][1] as { entry: { start_time: number } }
        expect(Math.abs(payload.entry.start_time - Date.now() / 1000)).toBeLessThan(120)
        expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
        wrapper.unmount()
    })

    it('closes without dispatching on cancel', async () => {
        const { wrapper, dispatchSpy } = mountDialog()
        await cancelButton(wrapper).trigger('click')
        expect(dispatchSpy).not.toHaveBeenCalled()
        expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
        wrapper.unmount()
    })

    it('resets the form when the dialog is reopened', async () => {
        const { wrapper } = mountDialog()
        await textFieldByLabel(wrapper, 'History.Name').find('input').setValue('Oil rods')
        await cancelButton(wrapper).trigger('click')
        await wrapper.setProps({ modelValue: false })
        await wrapper.setProps({ modelValue: true })
        expect((textFieldByLabel(wrapper, 'History.Name').find('input').element as HTMLInputElement).value).toBe('')
        wrapper.unmount()
    })
})
