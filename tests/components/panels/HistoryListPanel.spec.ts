import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import { VDataTable } from 'vuetify/components'
import i18n from '@/plugins/i18n'
import HistoryListPanel from '@/components/panels/HistoryListPanel.vue'
import {
    mdiDatabaseArrowDownOutline,
    mdiDatabaseExportOutline,
    mdiDelete,
    mdiNotebookPlus,
    mdiSortAscending,
    mdiSortDescending,
    mdiSortVariant,
} from '@mdi/js'

const mocks = vi.hoisted(() => {
    return { emit: vi.fn() }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
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

beforeEach(() => {
    mocks.emit.mockReset()
})

const jobFixture = (overrides: Record<string, unknown> = {}) => ({
    job_id: 'job-1',
    exists: true,
    end_time: 1700003600,
    filament_used: 1500,
    filename: 'benchy.gcode',
    metadata: {
        size: 1234567,
        modified: 1700000000,
        slicer: 'OrcaSlicer',
        slicer_version: '2.2.0',
        estimated_time: 3600,
    },
    print_duration: 3600,
    status: 'completed',
    start_time: 1700000000,
    total_duration: 3700,
    ...overrides,
})

const maintenanceFixture = (overrides: Record<string, unknown> = {}) => ({
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
    type: 'maintenance',
    select_id: 'maintenance_maint-1',
    ...overrides,
})

interface PanelOptions {
    jobs?: Record<string, unknown>[]
    maintenance?: Record<string, unknown>[]
    selectedJobs?: Record<string, unknown>[]
    allLoaded?: boolean
    historyConfig?: Record<string, unknown>
    viewOverrides?: Record<string, unknown>
}

const buildStore = (options: PanelOptions = {}) => {
    const {
        jobs = [
            jobFixture(),
            jobFixture({
                job_id: 'job-2',
                filename: 'failed_part.gcode',
                status: 'error',
                start_time: 1700001000,
                end_time: 1700001100,
                print_duration: 100,
                total_duration: 120,
            }),
            jobFixture({ job_id: 'job-3', filename: 'readme.txt', status: 'completed' }),
        ],
        maintenance = [maintenanceFixture()],
        selectedJobs = [],
        allLoaded = false,
        historyConfig = {},
        viewOverrides = {},
    } = options

    const store = createStore({
        state: {
            socket: { isConnected: true, loadings: [] },
            server: {
                history: { jobs, all_loaded: allLoaded },
                config: { config: historyConfig },
            },
            gui: {
                view: {
                    history: {
                        countPerPage: 10,
                        hideColums: [],
                        selectedJobs,
                        showMaintenanceEntries: true,
                        showPrintJobs: true,
                        hidePrintStatus: [],
                        ...viewOverrides,
                    },
                },
                general: { dateFormat: 'iso', timeFormat: '24hours' },
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'gui/maintenance/getEntries': () => maintenance,
        },
        actions: {
            'gui/saveSetting': () => {},
            'gui/setHistoryColumns': () => {},
            'gui/toggleStatusInHistoryList': () => {},
            'socket/addLoading': () => {},
            'gui/maintenance/delete': () => {},
        },
    })
    const dispatchSpy = vi.spyOn(store, 'dispatch')
    return { store, dispatchSpy }
}

const mountPanel = (options: PanelOptions = {}) => {
    const { store, dispatchSpy } = buildStore(options)
    const vuetify = createVuetify()
    const wrapper = mount(HistoryListPanel, {
        global: {
            plugins: [vuetify, store, i18n],
            mocks: { $t: (key: string) => key },
            directives: { longpress: {} },
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot /></div>' },
                HistoryListEntryJob: {
                    props: ['item', 'tableFields', 'isSelected'],
                    emits: ['select'],
                    template:
                        '<tr data-testid="job-row"><td class="row-name">{{ item.filename }}</td>' +
                        '<td><button data-testid="row-select" @click="$emit(\'select\', true)">select</button></td></tr>',
                },
                HistoryListEntryMaintenance: {
                    props: ['item', 'tableFields', 'isSelected'],
                    emits: ['select'],
                    template: '<tr data-testid="maintenance-row"><td class="row-name">{{ item.name }}</td></tr>',
                },
                HistoryListPanelAddMaintenance: {
                    props: ['modelValue'],
                    template: '<div data-testid="add-maintenance" v-if="modelValue" />',
                },
                ConfirmationDialog: {
                    props: ['modelValue', 'text', 'title'],
                    emits: ['action'],
                    template:
                        '<div data-testid="confirmation" v-if="modelValue">' +
                        '<span data-testid="confirm-text">{{ text }}</span>' +
                        '<button data-testid="confirm-action" @click="$emit(\'action\')">confirm</button></div>',
                },
                VMenu: {
                    template: '<div data-testid="menu-stub"><slot /><slot name="activator" :props="{}" /></div>',
                },
                VTooltip: { template: '<div><slot name="activator" :props="{}" /><slot /></div>' },
                VDataTable: {
                    props: ['items', 'headers', 'search', 'customFilter', 'modelValue', 'itemsPerPage'],
                    emits: ['update:modelValue', 'update:itemsPerPage'],
                    methods: {
                        toggle(entry: unknown) {
                            const current = (this as unknown as { modelValue: unknown[] }).modelValue ?? []
                            ;(this as unknown as { $emit: (event: string, value: unknown) => void }).$emit(
                                'update:modelValue',
                                [...current, entry]
                            )
                        },
                    },
                    template:
                        '<div data-testid="data-table">' +
                        '<slot name="header.filename" /><slot name="header.size" />' +
                        '<slot name="header.print_duration" /><slot name="header.slicer" />' +
                        '<div v-for="entry in (items ?? [])" :key="entry.select_id">' +
                        '<slot name="item" :item="entry" :isSelected="() => false" :toggleSelect="() => toggle(entry)" />' +
                        '</div>' +
                        '<slot name="no-data" v-if="!(items ?? []).length" />' +
                        '<select data-testid="items-per-page" @change="$emit(\'update:itemsPerPage\', Number($event.target.value))">' +
                        '<option value="10">10</option><option value="25">25</option>' +
                        '</select></div>',
                },
            },
        },
    })
    return { wrapper, store, dispatchSpy }
}

const rowNames = (wrapper: VueWrapper, testid: string) =>
    wrapper.findAll(`[data-testid="${testid}"] .row-name`).map((row) => row.text())

const findBtnByIcon = (wrapper: VueWrapper, icon: string) => {
    const found = wrapper.findAllComponents({ name: 'VBtn' }).find((button) => button.html().includes(icon))
    if (!found) throw new Error('button with expected icon not found')
    return found
}

const hasBtnByIcon = (wrapper: VueWrapper, icon: string) =>
    wrapper.findAllComponents({ name: 'VBtn' }).some((button) => button.html().includes(icon))

const findHeaderToggle = (wrapper: VueWrapper, label: string) => {
    const found = wrapper.findAll('span.cursor-pointer').find((span) => span.text().includes(label))
    if (!found) throw new Error(`sort header "${label}" not found`)
    return found
}

describe('HistoryListPanel rows and filtering', () => {
    it('renders only gcode job rows and filters out other extensions', () => {
        const { wrapper } = mountPanel()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        const names = rowNames(wrapper, 'job-row')
        expect(names).toContain('benchy.gcode')
        expect(names).toContain('failed_part.gcode')
        expect(names).not.toContain('readme.txt')
        // maintenance entries have no filename and survive the filter
        expect(rowNames(wrapper, 'maintenance-row')).toContain('Clean lead screws')
        wrapper.unmount()
    })

    it('exposes the sorted entries through the data table items', () => {
        const { wrapper } = mountPanel()
        const table = wrapper.findComponent(VDataTable)
        const items = table.props('items') as Record<string, unknown>[]
        expect(items).toHaveLength(3)
        // default sort is start_time descending: job-2 started later
        expect(items[0]).toMatchObject({ job_id: 'job-2' })
        expect(items[1]).toMatchObject({ job_id: 'job-1' })
        expect(items[2]).toMatchObject({ id: 'maint-1', type: 'maintenance' })
        wrapper.unmount()
    })

    it('hides job rows when print jobs are disabled in the view settings', () => {
        const { wrapper } = mountPanel({ viewOverrides: { showPrintJobs: false } })
        expect(wrapper.findAll('[data-testid="job-row"]')).toHaveLength(0)
        wrapper.unmount()
    })

    it('shows the empty state when no jobs match', () => {
        const { wrapper } = mountPanel({ jobs: [], maintenance: [] })
        expect(wrapper.text()).toContain('History.Empty')
        wrapper.unmount()
    })

    it('evaluates the advanced search filter for match, miss and null inputs', () => {
        const { wrapper } = mountPanel()
        const table = wrapper.findComponent(VDataTable)
        const customFilter = table.props('customFilter') as (value: unknown, search: unknown) => boolean
        expect(customFilter('Benchy.GCODE', 'benchy')).toBe(true)
        expect(customFilter('Benchy.GCODE', 'nope')).toBe(false)
        expect(customFilter(null, 'benchy')).toBe(false)
        expect(customFilter('benchy', null)).toBe(false)
        wrapper.unmount()
    })

    it('forwards the search field value to the data table', async () => {
        const { wrapper } = mountPanel()
        const field = wrapper.findComponent({ name: 'VTextField' })
        await field.find('input').setValue('benchy')
        const table = wrapper.findComponent(VDataTable)
        expect(table.props('search')).toBe('benchy')
        wrapper.unmount()
    })
})

describe('HistoryListPanel sorting', () => {
    it('sorts filenames ascending then descending on repeated header clicks', async () => {
        const { wrapper } = mountPanel()
        const header = findHeaderToggle(wrapper, 'History.Filename')
        await header.trigger('click')
        let items = wrapper.findComponent(VDataTable).props('items') as Record<string, unknown>[]
        expect(items.map((item) => item.filename)).toEqual(['benchy.gcode', 'failed_part.gcode'])
        await header.trigger('click')
        items = wrapper.findComponent(VDataTable).props('items') as Record<string, unknown>[]
        expect(items.map((item) => item.filename)).toEqual(['failed_part.gcode', 'benchy.gcode'])
        wrapper.unmount()
    })

    it('sorts numerically by print duration', async () => {
        const { wrapper } = mountPanel()
        await findHeaderToggle(wrapper, 'History.PrintTime').trigger('click')
        const items = wrapper.findComponent(VDataTable).props('items') as Record<string, unknown>[]
        expect(items.map((item) => item.print_duration)).toEqual([100, 3600])
        wrapper.unmount()
    })

    it('puts rows with missing sort values first', async () => {
        const incomplete = jobFixture({ job_id: 'job-9', filename: 'partial.gcode', start_time: 1700002000 })
        delete (incomplete as Record<string, unknown>).print_duration
        const { wrapper } = mountPanel({
            jobs: [jobFixture(), jobFixture({ job_id: 'job-2', filename: 'b.gcode', print_duration: 100 }), incomplete],
        })
        await findHeaderToggle(wrapper, 'History.PrintTime').trigger('click')
        const items = wrapper.findComponent(VDataTable).props('items') as Record<string, unknown>[]
        expect(items[0]).toMatchObject({ job_id: 'job-9' })
        wrapper.unmount()
    })

    it('renders the default sort icon for inactive columns and directional icons when active', async () => {
        const { wrapper } = mountPanel()
        expect(wrapper.html()).toContain(mdiSortVariant)
        await findHeaderToggle(wrapper, 'History.Filename').trigger('click')
        expect(wrapper.html()).toContain(mdiSortAscending)
        await findHeaderToggle(wrapper, 'History.Filename').trigger('click')
        expect(wrapper.html()).toContain(mdiSortDescending)
        wrapper.unmount()
    })
})

describe('HistoryListPanel toolbar actions', () => {
    it('refreshes the full history with a loading flag and socket event', async () => {
        const { wrapper, dispatchSpy } = mountPanel()
        await findBtnByIcon(wrapper, mdiDatabaseArrowDownOutline).trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('socket/addLoading', { name: 'historyLoadAll' })
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.history.list',
            { start: 0, limit: 50 },
            { action: 'server/history/getHistory' }
        )
        wrapper.unmount()
    })

    it('hides the load-all button once the full history is loaded', () => {
        const { wrapper } = mountPanel({ allLoaded: true })
        expect(hasBtnByIcon(wrapper, mdiDatabaseArrowDownOutline)).toBe(false)
        wrapper.unmount()
    })

    it('opens the add-maintenance dialog from the toolbar', async () => {
        const { wrapper } = mountPanel()
        expect(wrapper.find('[data-testid="add-maintenance"]').exists()).toBe(false)
        await findBtnByIcon(wrapper, mdiNotebookPlus).trigger('click')
        expect(wrapper.find('[data-testid="add-maintenance"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('selects a row through the entry select event', async () => {
        const { wrapper, dispatchSpy } = mountPanel()
        await wrapper.find('[data-testid="row-select"]').trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith(
            'gui/saveSetting',
            expect.objectContaining({ name: 'view.history.selectedJobs' })
        )
        wrapper.unmount()
    })
})

describe('HistoryListPanel delete flow', () => {
    it('hides the delete button when nothing is selected', () => {
        const { wrapper } = mountPanel()
        expect(hasBtnByIcon(wrapper, mdiDelete)).toBe(false)
        wrapper.unmount()
    })

    it('asks the singular question for one selected job and deletes it on confirm', async () => {
        const selected = [{ ...jobFixture(), type: 'job', select_id: 'job_job-1' }]
        const { wrapper, dispatchSpy } = mountPanel({ selectedJobs: selected })
        await findBtnByIcon(wrapper, mdiDelete).trigger('click')
        expect(wrapper.find('[data-testid="confirm-text"]').text()).toBe('History.DeleteSingleJobQuestion')
        await wrapper.find('[data-testid="confirm-action"]').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.history.delete_job',
            { uid: 'job-1' },
            { action: 'server/history/getDeletedJobs' }
        )
        expect(dispatchSpy).toHaveBeenCalledWith('gui/saveSetting', {
            name: 'view.history.selectedJobs',
            value: [],
        })
        wrapper.unmount()
    })

    it('asks the plural question for several selections and deletes maintenance entries via the store', async () => {
        const selected = [{ ...jobFixture(), type: 'job', select_id: 'job_job-1' }, maintenanceFixture()]
        const { wrapper, dispatchSpy } = mountPanel({ selectedJobs: selected })
        await findBtnByIcon(wrapper, mdiDelete).trigger('click')
        expect(wrapper.find('[data-testid="confirm-text"]').text()).toBe('History.DeleteSelectedQuestion')
        await wrapper.find('[data-testid="confirm-action"]').trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('gui/maintenance/delete', 'maint-1')
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.history.delete_job',
            { uid: 'job-1' },
            { action: 'server/history/getDeletedJobs' }
        )
        wrapper.unmount()
    })
})

describe('HistoryListPanel export', () => {
    const clickExport = async (wrapper: VueWrapper) => {
        const createdAnchors: HTMLAnchorElement[] = []
        const originalCreateElement = document.createElement.bind(document)
        const createSpy = vi.spyOn(document, 'createElement')
        createSpy.mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
            const el = originalCreateElement(tagName, options)
            if (tagName === 'a') createdAnchors.push(el as HTMLAnchorElement)
            return el
        }) as never)
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
        try {
            await findBtnByIcon(wrapper, mdiDatabaseExportOutline).trigger('click')
        } finally {
            createSpy.mockRestore()
            clickSpy.mockRestore()
        }
        if (createdAnchors.length !== 1) throw new Error('export did not create a download link')
        return createdAnchors[0]
    }

    it('exports all visible jobs to a csv download', async () => {
        const { wrapper } = mountPanel()
        const link = await clickExport(wrapper)
        expect(link.getAttribute('download')).toBe('print_history.csv')
        const href = decodeURI(link.getAttribute('href') ?? '')
        expect(href).toContain('data:text/csv')
        expect(href).toContain('benchy.gcode')
        expect(href).toContain('failed_part.gcode')
        expect(href).not.toContain('readme.txt')
        wrapper.unmount()
    })

    it('exports selected rows with maintenance states, quoting and formatted values', async () => {
        const commaJob = {
            ...jobFixture({ job_id: 'job-9', filename: 'comma, file.gcode' }),
            type: 'job',
            select_id: 'job_job-9',
        }
        const performed = maintenanceFixture({
            id: 'maint-done',
            select_id: 'maintenance_maint-done',
            name: 'Done task',
            end_time: 1699950000,
            end_printtime: 6000,
            end_filament: 2500,
        })
        const open = maintenanceFixture({ id: 'maint-open', select_id: 'maintenance_maint-open', name: 'Open task' })
        const { wrapper } = mountPanel({
            selectedJobs: [commaJob, performed, open],
            historyConfig: {
                'sensor extras': {
                    history_field_temp: { desc: 'Chamber Temp', units: 'C', parameter: 'temperature' },
                },
            },
        })
        const link = await clickExport(wrapper)
        const href = decodeURI(link.getAttribute('href') ?? '')
        expect(href).toContain('"comma, file.gcode"')
        expect(href).toContain('maintenance')
        expect(href).toContain('performed')
        expect(href).toContain('open')
        // job value formatting: filesize default branch, slicer with version, time branch
        expect(href).toContain('OrcaSlicer 2.2.0')
        expect(href).toContain('1234567')
        // missing history field value renders as --
        expect(href).toContain('--')
        wrapper.unmount()
    })
})

describe('HistoryListPanel settings', () => {
    it('dispatches column visibility changes from the settings checkboxes', async () => {
        const { wrapper, dispatchSpy } = mountPanel()
        const checkbox = wrapper
            .findAllComponents({ name: 'VCheckbox' })
            .find((entry) => entry.props('label') === 'History.Filesize')
        if (!checkbox) throw new Error('filesize column checkbox not found')
        // v-model updates silently via the prop; the @change handler listens to
        // the native input event that falls through the Vuetify component
        await checkbox.setValue(false)
        await checkbox.find('input').trigger('change')
        expect(dispatchSpy).toHaveBeenCalledWith('gui/setHistoryColumns', {
            name: 'size',
            value: false,
        })
        wrapper.unmount()
    })

    it('dispatches status visibility changes from the settings checkboxes', async () => {
        const { wrapper, dispatchSpy } = mountPanel()
        const checkbox = wrapper
            .findAllComponents({ name: 'VCheckbox' })
            .find((entry) => String(entry.props('label') ?? '').includes('completed'))
        if (!checkbox) throw new Error('status visibility checkbox not found')
        await checkbox.setValue(false)
        await checkbox.find('input').trigger('change')
        expect(dispatchSpy).toHaveBeenCalledWith('gui/toggleStatusInHistoryList', 'completed')
        wrapper.unmount()
    })

    it('persists the rows-per-page selection to the view settings', async () => {
        const { wrapper, dispatchSpy } = mountPanel()
        await wrapper.find('[data-testid="items-per-page"]').setValue('25')
        expect(dispatchSpy).toHaveBeenCalledWith('gui/saveSetting', {
            name: 'view.history.countPerPage',
            value: 25,
        })
        wrapper.unmount()
    })

    it('exposes moonraker history fields as table headers', () => {
        const { wrapper } = mountPanel({
            historyConfig: {
                'sensor extras': {
                    history_field_temp: { desc: 'Chamber Temp', units: 'C', parameter: 'temperature' },
                },
            },
        })
        const table = wrapper.findComponent(VDataTable)
        const headers = table.props('headers') as Record<string, unknown>[]
        expect(headers.map((header) => header.key)).toContain('history_field_temp')
        wrapper.unmount()
    })
})
