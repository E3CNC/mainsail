import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import i18n from '@/plugins/i18n'
import HistoryListPanelEditMaintenance from '@/components/dialogs/HistoryListPanelEditMaintenance.vue'

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

const itemFixture = (overrides: Record<string, unknown> = {}) => ({
    id: 'maint-1',
    name: 'Clean lead screws',
    note: 'monthly task',
    perform_note: null,
    start_time: 1699900000,
    end_time: null,
    start_filament: 1000,
    end_filament: null,
    start_printtime: 5000,
    end_printtime: null,
    last_entry: null,
    reminder: {
        type: 'one-time',
        filament: { bool: true, value: 100 },
        printtime: { bool: false, value: 0 },
        date: { bool: false, value: 0 },
    },
    ...overrides,
})

const mountDialog = (item: Record<string, unknown>, modelValue = true) => {
    const store = createStore({
        state: {
            socket: { isConnected: true },
            server: { history: { job_totals: {} } },
            printer: {},
            gui: {},
        },
        getters: {},
        actions: {
            'gui/maintenance/update': () => {},
        },
    })
    const dispatchSpy = vi.spyOn(store, 'dispatch')

    const vuetify = createVuetify()
    const wrapper = mount(HistoryListPanelEditMaintenance, {
        props: { modelValue, item: item as never },
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

const inputValue = (wrapper: VueWrapper, component: string, index: number, field: string) => {
    const target = wrapper.findAllComponents({ name: component })[index]
    if (!target) throw new Error(`${component}[${index}] not found`)
    return (target.find(field).element as HTMLInputElement).value
}

const textFieldBySuffix = (wrapper: VueWrapper, suffix: string) => {
    const found = wrapper.findAllComponents({ name: 'VTextField' }).find((field) => field.props('suffix') === suffix)
    if (!found) throw new Error(`number field "${suffix}" not found`)
    return found
}

const textFieldByLabel = (wrapper: VueWrapper, label: string) => {
    const found = wrapper.findAllComponents({ name: 'VTextField' }).find((field) => field.props('label') === label)
    if (!found) throw new Error(`text field "${label}" not found`)
    return found
}

const saveButton = (wrapper: VueWrapper) => {
    const found = wrapper.findAllComponents({ name: 'VBtn' }).find((button) => button.text().includes('Buttons.Save'))
    if (!found) throw new Error('save button not found')
    return found
}

describe('HistoryListPanelEditMaintenance prefill', () => {
    it('prefills name, note and reminder values from the entry', () => {
        const { wrapper } = mountDialog(itemFixture())
        expect(inputValue(wrapper, 'VTextField', 0, 'input')).toBe('Clean lead screws')
        expect(inputValue(wrapper, 'VTextarea', 0, 'textarea')).toBe('monthly task')
        expect(wrapper.findComponent({ name: 'VSelect' }).props('modelValue')).toBe('one-time')
        const boxes = wrapper.findAllComponents({ name: 'VCheckbox' })
        expect(boxes[0].props('modelValue')).toBe(true)
        expect(boxes[1].props('modelValue')).toBe(false)
        expect((textFieldBySuffix(wrapper, 'History.Meter').find('input').element as HTMLInputElement).value).toBe(
            '100'
        )
        wrapper.unmount()
    })

    it('repopulates the form when reopened with another entry', async () => {
        const { wrapper } = mountDialog(itemFixture())
        expect(inputValue(wrapper, 'VTextField', 0, 'input')).toBe('Clean lead screws')
        await wrapper.setProps({ modelValue: false })
        await wrapper.setProps({ item: itemFixture({ name: 'Oil rods', note: 'use oil' }) as never })
        await wrapper.setProps({ modelValue: true })
        expect(inputValue(wrapper, 'VTextField', 0, 'input')).toBe('Oil rods')
        expect(inputValue(wrapper, 'VTextarea', 0, 'textarea')).toBe('use oil')
        wrapper.unmount()
    })
})

describe('HistoryListPanelEditMaintenance validation and save', () => {
    it('disables save while the name is empty', async () => {
        const { wrapper } = mountDialog(itemFixture())
        await textFieldByLabel(wrapper, 'History.Name').find('input').setValue('')
        expect(saveButton(wrapper).props('disabled')).toBe(true)
        wrapper.unmount()
    })

    it('requires a reminder channel once a reminder is set', async () => {
        const { wrapper } = mountDialog(itemFixture())
        const boxes = wrapper.findAllComponents({ name: 'VCheckbox' })
        await boxes[0].setValue(false)
        expect(saveButton(wrapper).props('disabled')).toBe(true)
        wrapper.unmount()
    })

    it('updates the entry without the list type field and closes', async () => {
        const item = { ...itemFixture(), type: 'maintenance' }
        const { wrapper, dispatchSpy } = mountDialog(item)
        await textFieldByLabel(wrapper, 'History.Name').find('input').setValue('Clean everything')
        await saveButton(wrapper).trigger('click')

        expect(dispatchSpy).toHaveBeenCalledWith(
            'gui/maintenance/update',
            expect.objectContaining({
                id: 'maint-1',
                name: 'Clean everything',
                note: 'monthly task',
                reminder: {
                    type: 'one-time',
                    filament: { bool: true, value: 100 },
                    printtime: { bool: false, value: 0 },
                    date: { bool: false, value: 0 },
                },
            })
        )
        const payload = dispatchSpy.mock.calls[0][1] as Record<string, unknown>
        expect('type' in payload).toBe(false)
        expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
        wrapper.unmount()
    })

    it('closes without dispatching on cancel', async () => {
        const { wrapper, dispatchSpy } = mountDialog(itemFixture())
        const cancel = wrapper
            .findAllComponents({ name: 'VBtn' })
            .find((button) => button.text().includes('Buttons.Cancel'))
        if (!cancel) throw new Error('cancel button not found')
        await cancel.trigger('click')
        expect(dispatchSpy).not.toHaveBeenCalled()
        expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
        wrapper.unmount()
    })
})

describe('HistoryListPanelEditMaintenance performed entries', () => {
    it('disables every reminder control for performed entries', () => {
        const { wrapper } = mountDialog(itemFixture({ end_time: 1699950000 }))
        expect(wrapper.findComponent({ name: 'VSelect' }).props('disabled')).toBe(true)
        for (const box of wrapper.findAllComponents({ name: 'VCheckbox' })) {
            expect(box.props('disabled')).toBe(true)
        }
        for (const suffix of ['History.Meter', 'History.Hours', 'History.Days']) {
            expect(textFieldBySuffix(wrapper, suffix).props('disabled')).toBe(true)
        }
        wrapper.unmount()
    })
})
