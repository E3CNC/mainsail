import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import { VMenu } from 'vuetify/components'
import i18n from '@/plugins/i18n'
import HistoryListEntryMaintenance from '@/components/panels/History/HistoryListEntryMaintenance.vue'
import HistoryListPanelDetailMaintenance from '@/components/dialogs/HistoryListPanelDetailMaintenance.vue'
import { EventBus, CLOSE_CONTEXT_MENU } from '@/plugins/eventBus'
import { mdiAlarm, mdiAlarmMultiple, mdiNotebook, mdiNotebookCheck } from '@mdi/js'

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

const entryFixture = (overrides: Record<string, unknown> = {}) => ({
    id: 'maint-1',
    name: 'Clean lead screws',
    note: 'monthly task',
    perform_note: null,
    start_time: Date.now() / 1000 - 5 * 24 * 3600,
    end_time: null,
    start_filament: 1000,
    end_filament: null,
    start_printtime: 7200,
    end_printtime: null,
    last_entry: null,
    reminder: {
        type: 'one-time',
        filament: { bool: true, value: 100 },
        printtime: { bool: true, value: 20 },
        date: { bool: true, value: 10 },
    },
    ...overrides,
})

const tableFields = () => [
    { text: 'Start', value: 'start_time', align: 'left', configable: true, visible: true },
    { text: 'End', value: 'end_time', align: 'left', configable: true, visible: true },
]

interface MaintenanceOptions {
    item?: Record<string, unknown>
    isSelected?: boolean
    totals?: Record<string, unknown>
}

const mountEntry = (options: MaintenanceOptions = {}) => {
    const {
        item = entryFixture(),
        isSelected = false,
        totals = { total_filament_used: 5000, total_print_time: 36000 },
    } = options

    const store = createStore({
        state: {
            socket: { isConnected: true },
            server: { history: { job_totals: totals } },
            printer: {},
            gui: { general: { dateFormat: 'iso', timeFormat: '24hours' } },
        },
        getters: {},
        actions: {
            'gui/maintenance/delete': () => {},
        },
    })
    const dispatchSpy = vi.spyOn(store, 'dispatch')

    const vuetify = createVuetify()
    const wrapper = mount(HistoryListEntryMaintenance, {
        props: { item: item as never, tableFields: tableFields() as never, isSelected },
        global: {
            plugins: [vuetify, store, i18n],
            mocks: { $t: (key: string) => key },
            directives: { longpress: {}, ripple: {} },
            stubs: {
                HistoryListPanelDetailMaintenance: {
                    props: ['modelValue', 'item'],
                    template: '<div data-testid="detail-dialog" v-if="modelValue" />',
                },
                VMenu: {
                    props: ['modelValue'],
                    template: '<div data-testid="context-menu"><slot /></div>',
                },
                VTooltip: { template: '<div><slot name="activator" :props="{}" /><slot /></div>' },
                VList: { template: '<div><slot /></div>' },
                VListItem: {
                    props: ['disabled'],
                    emits: ['click'],
                    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
                },
            },
        },
    })
    return { wrapper, store, dispatchSpy }
}

const findMenuButton = (wrapper: ReturnType<typeof mountEntry>['wrapper'], label: string) => {
    const found = wrapper.findAll('[data-testid="context-menu"] button').find((button) => button.text().includes(label))
    if (!found) throw new Error(`menu item "${label}" not found`)
    return found
}

describe('HistoryListEntryMaintenance rendering', () => {
    it('renders the entry name with the formatted start date', () => {
        const { wrapper } = mountEntry()
        expect(wrapper.text()).toContain('Clean lead screws')
        // iso date of "5 days ago" renders as YYYY-MM-DD
        expect(wrapper.text()).toMatch(/\d{4}-\d{2}-\d{2}/)
        wrapper.unmount()
    })

    it('shows the open notebook icon for pending entries', () => {
        const { wrapper } = mountEntry()
        expect(wrapper.html()).toContain(mdiNotebook)
        expect(wrapper.html()).not.toContain(mdiNotebookCheck)
        wrapper.unmount()
    })

    it('shows the checked notebook icon for performed entries', () => {
        const { wrapper } = mountEntry({ item: entryFixture({ end_time: 1699950000 }) })
        expect(wrapper.html()).toContain(mdiNotebookCheck)
        wrapper.unmount()
    })

    it('shows no reminder tooltip when the entry has no reminder', () => {
        const item = entryFixture()
        ;(item.reminder as Record<string, unknown>).type = null
        const { wrapper } = mountEntry({ item })
        expect(wrapper.html()).not.toContain(mdiAlarm)
        expect(wrapper.text()).not.toContain('/ 100 m')
        wrapper.unmount()
    })

    it('renders filament, printtime and day progress for active reminders', () => {
        const { wrapper } = mountEntry()
        expect(wrapper.text()).toContain('4 / 100 m')
        expect(wrapper.text()).toContain('8.0 / 20 h')
        expect(wrapper.text()).toContain('5 / 10 days')
        wrapper.unmount()
    })

    it('measures usage against the end values for performed entries', () => {
        const { wrapper } = mountEntry({
            item: entryFixture({
                end_time: 1699950000,
                end_filament: 2000,
                end_printtime: 9000,
                reminder: {
                    type: 'repeat',
                    filament: { bool: true, value: 100 },
                    printtime: { bool: true, value: 20 },
                    date: { bool: false, value: 0 },
                },
            }),
        })
        expect(wrapper.text()).toContain('1 / 100 m')
        expect(wrapper.text()).toContain('0.5 / 20 h')
        expect(wrapper.html()).toContain(mdiAlarmMultiple)
        expect(wrapper.text()).not.toContain('days')
        wrapper.unmount()
    })

    it('renders an empty reminder tooltip when every reminder channel is off', () => {
        const { wrapper } = mountEntry({
            item: entryFixture({
                reminder: {
                    type: 'one-time',
                    filament: { bool: false, value: 0 },
                    printtime: { bool: false, value: 0 },
                    date: { bool: false, value: 0 },
                },
            }),
        })
        expect(wrapper.html()).toContain(mdiAlarm)
        expect(wrapper.text()).not.toContain('/ 100 m')
        expect(wrapper.text()).not.toContain('/ 20 h')
        wrapper.unmount()
    })
})

describe('HistoryListEntryMaintenance interaction', () => {
    it('emits select true and false through the checkbox', async () => {
        const { wrapper } = mountEntry({ isSelected: false })
        await wrapper.findComponent({ name: 'VCheckbox' }).trigger('click')
        expect(wrapper.emitted('select')).toEqual([[true]])
        wrapper.unmount()

        const selected = mountEntry({ isSelected: true })
        await selected.wrapper.findComponent({ name: 'VCheckbox' }).trigger('click')
        expect(selected.wrapper.emitted('select')).toEqual([[false]])
        selected.wrapper.unmount()
    })

    it('opens the detail dialog on row click', async () => {
        const { wrapper } = mountEntry()
        expect(wrapper.find('[data-testid="detail-dialog"]').exists()).toBe(false)
        await wrapper.find('tr').trigger('click')
        expect(wrapper.findComponent(HistoryListPanelDetailMaintenance).props('modelValue')).toBe(true)
        wrapper.unmount()
    })

    it('opens the context menu on right click and closes it on the bus event', async () => {
        const { wrapper } = mountEntry()
        await wrapper.find('tr').trigger('contextmenu')
        expect(wrapper.findComponent(VMenu).props('modelValue')).toBe(true)
        EventBus.$emit(CLOSE_CONTEXT_MENU)
        await wrapper.vm.$nextTick()
        expect(wrapper.findComponent(VMenu).props('modelValue')).toBe(false)
        wrapper.unmount()
    })

    it('opens the detail dialog from the context menu', async () => {
        const { wrapper } = mountEntry()
        await findMenuButton(wrapper, 'History.Details').trigger('click')
        expect(wrapper.findComponent(HistoryListPanelDetailMaintenance).props('modelValue')).toBe(true)
        wrapper.unmount()
    })

    it('deletes the entry through the store', async () => {
        const { wrapper, dispatchSpy } = mountEntry()
        await findMenuButton(wrapper, 'Buttons.Delete').trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('gui/maintenance/delete', 'maint-1')
        wrapper.unmount()
    })
})
