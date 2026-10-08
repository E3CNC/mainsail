import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import i18n from '@/plugins/i18n'
import HistoryListEntryJob from '@/components/panels/History/HistoryListEntryJob.vue'
import StartPrintDialog from '@/components/dialogs/StartPrintDialog.vue'
import { VMenu } from 'vuetify/components'
import { EventBus, CLOSE_CONTEXT_MENU } from '@/plugins/eventBus'
import { mdiCheckboxMarkedCircleOutline } from '@mdi/js'

const mocks = vi.hoisted(() => {
    return { emit: vi.fn(), toastInfo: vi.fn() }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('vue-toast-notification', () => ({
    useToast: () => ({ info: (...args: unknown[]) => mocks.toastInfo(...args) }),
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
    mocks.toastInfo.mockReset()
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
        first_layer_extr_temp: 210,
        filament_total: 1500,
        layer_height: 0.2,
        estimated_time: 3600,
    },
    note: 'first line\nsecond line',
    print_duration: 3600,
    status: 'completed',
    start_time: 1700000000,
    total_duration: 3700,
    auxiliary_data: [{ description: 'Chamber', name: 'temp', provider: 'sensor extras', units: 'C', value: 12.3456 }],
    ...overrides,
})

const defaultTableFields = () => [
    { text: 'Filesize', value: 'size', align: 'left', configable: true, visible: true, outputType: 'filesize' },
    { text: 'Modified', value: 'modified', align: 'left', configable: true, visible: true, outputType: 'date' },
    {
        text: 'PrintTime',
        value: 'print_duration',
        align: 'left',
        configable: true,
        visible: true,
        outputType: 'time',
    },
    { text: 'CAM', value: 'slicer', align: 'left', configable: true, visible: true },
    {
        text: 'Temp',
        value: 'first_layer_extr_temp',
        align: 'left',
        configable: true,
        visible: true,
        outputType: 'temp',
    },
    { text: 'Filament', value: 'filament_total', align: 'left', configable: true, visible: true, outputType: 'length' },
    { text: 'Layer', value: 'layer_height', align: 'left', configable: true, visible: true, outputType: 'length' },
    { text: 'Chamber', value: 'history_field_temp', align: 'left', configable: true, visible: true },
    { text: 'Status', value: 'status', align: 'left', configable: true, visible: true },
    { text: 'Missing', value: 'no_such_field', align: 'left', configable: true, visible: true },
]

interface EntryOptions {
    job?: Record<string, unknown>
    tableFields?: Record<string, unknown>[]
    isSelected?: boolean
    fileExists?: boolean
    components?: string[]
    printerState?: string
    klippyReady?: boolean
}

const mountEntry = (options: EntryOptions = {}) => {
    const {
        job = jobFixture(),
        tableFields = defaultTableFields(),
        isSelected = false,
        fileExists = true,
        components = ['job_queue'],
        printerState = 'standby',
        klippyReady = true,
    } = options

    const store = createStore({
        state: {
            socket: { isConnected: true, hostname: '127.0.0.1', port: 7125, initializationList: [] },
            server: {
                klippy_connected: klippyReady,
                klippy_state: klippyReady ? 'ready' : 'disconnected',
                components,
            },
            printer: { print_stats: { state: printerState } },
            files: {},
            gui: { general: { dateFormat: 'iso', timeFormat: '24hours' } },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'files/getFile': () => () => (fileExists ? { filename: 'benchy.gcode', isDirectory: false } : null),
        },
        actions: {
            'server/jobQueue/addToQueue': () => {},
        },
    })
    const dispatchSpy = vi.spyOn(store, 'dispatch')

    const vuetify = createVuetify()
    const wrapper = mount(HistoryListEntryJob, {
        props: { item: job as never, tableFields: tableFields as never, isSelected },
        global: {
            plugins: [vuetify, store, i18n],
            mocks: { $t: (key: string) => key },
            directives: { longpress: {}, ripple: {} },
            stubs: {
                HistoryListPanelDetailsDialog: {
                    props: ['modelValue', 'job'],
                    template: '<div data-testid="details-dialog" v-if="modelValue" />',
                },
                HistoryListPanelNoteDialog: {
                    props: ['modelValue', 'type', 'job'],
                    template: '<div data-testid="note-dialog" v-if="modelValue" :data-type="type" />',
                },
                AddBatchToQueueDialog: {
                    props: ['modelValue', 'showToast', 'filename'],
                    template: '<div data-testid="batch-dialog" v-if="modelValue" />',
                },
                StartPrintDialog: {
                    props: ['modelValue', 'file', 'currentPath'],
                    template: '<div data-testid="start-print-dialog" v-if="modelValue" :data-path="currentPath" />',
                },
                'vue-load-image': { template: '<div data-testid="thumb"><slot name="image" /></div>' },
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

const findMenuButton = (wrapper: VueWrapper, label: string) => {
    const found = wrapper.findAll('[data-testid="context-menu"] button').find((button) => button.text().includes(label))
    if (!found) throw new Error(`menu item "${label}" not found`)
    return found
}

describe('HistoryListEntryJob rendering', () => {
    it('renders the filename with a completed status icon', () => {
        const { wrapper } = mountEntry()
        expect(wrapper.find('tr').exists()).toBe(true)
        expect(wrapper.text()).toContain('benchy.gcode')
        expect(wrapper.html()).toContain(mdiCheckboxMarkedCircleOutline)
        expect(wrapper.text()).toContain('History.StatusValues.completed')
        wrapper.unmount()
    })

    it('marks rows of missing files as disabled with a cancel icon', () => {
        const { wrapper } = mountEntry({ job: jobFixture({ exists: false }) })
        expect(wrapper.find('tr').classes()).toContain('text-disabled')
        // start-print dialog is only rendered when the file exists
        expect(wrapper.find('[data-testid="start-print-dialog"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('renders the thumbnail image with an api url when thumbnails exist', () => {
        const { wrapper } = mountEntry({
            job: jobFixture({
                metadata: {
                    modified: 1700000000,
                    thumbnails: [
                        { width: 32, height: 32, relative_path: 'thumb-small.png' },
                        { width: 300, height: 300, relative_path: 'thumb-big.png' },
                    ],
                },
            }),
        })
        const images = wrapper.findAll('[data-testid="thumb"] img')
        expect(images.length).toBeGreaterThan(0)
        expect(images[0].attributes('src')).toContain('thumb-small.png')
        expect(wrapper.html()).toContain('thumb-big.png')
        wrapper.unmount()
    })

    it('shows the note indicator with line breaks when a note exists', () => {
        const { wrapper } = mountEntry()
        expect(wrapper.html()).toContain('first line<br>second line')
        wrapper.unmount()
    })

    it('formats every column output type', () => {
        const { wrapper } = mountEntry()
        const html = wrapper.html()
        expect(html).toContain('1.2 MB') // filesize
        expect(html).toContain('2023-11-14') // date (iso)
        expect(html).toContain('1h') // time
        expect(html).toContain('OrcaSlicer<br>2.2.0') // slicer with version
        expect(html).toContain('210 °C') // temp
        expect(html).toContain('1.50 m') // length above 1000mm
        expect(html).toContain('0.20 mm') // length below 1000mm
        expect(html).toContain('12.346 C') // history field scalar
        expect(html).toContain('--') // missing field
        wrapper.unmount()
    })

    it('renders the slicer without a version line when no version is known', () => {
        const { wrapper } = mountEntry({
            job: jobFixture({ metadata: { slicer: 'OrcaSlicer' } }),
            tableFields: [{ text: 'CAM', value: 'slicer', align: 'left', configable: true, visible: true }],
        })
        expect(wrapper.html()).toContain('OrcaSlicer')
        expect(wrapper.html()).not.toContain('<br />')
        wrapper.unmount()
    })

    it('computes the current path from nested filenames', () => {
        const nested = mountEntry({ job: jobFixture({ filename: 'sub/dir/part.gcode' }) })
        expect(nested.wrapper.findComponent(StartPrintDialog).props('currentPath')).toBe('/sub/dir')
        nested.wrapper.unmount()

        const flat = mountEntry({ job: jobFixture({ filename: 'part.gcode' }) })
        expect(flat.wrapper.findComponent(StartPrintDialog).props('currentPath')).toBe('')
        flat.wrapper.unmount()
    })
})

describe('HistoryListEntryJob selection and dialogs', () => {
    it('emits select true when the checkbox is clicked', async () => {
        const { wrapper } = mountEntry({ isSelected: false })
        await wrapper.findComponent({ name: 'VCheckbox' }).trigger('click')
        expect(wrapper.emitted('select')).toEqual([[true]])
        wrapper.unmount()
    })

    it('emits select false when a selected row checkbox is clicked', async () => {
        const { wrapper } = mountEntry({ isSelected: true })
        await wrapper.findComponent({ name: 'VCheckbox' }).trigger('click')
        expect(wrapper.emitted('select')).toEqual([[false]])
        wrapper.unmount()
    })

    it('opens the details dialog on row click', async () => {
        const { wrapper } = mountEntry()
        expect(wrapper.find('[data-testid="details-dialog"]').exists()).toBe(false)
        await wrapper.find('tr').trigger('click')
        expect(wrapper.find('[data-testid="details-dialog"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('opens the context menu on right click and closes it on the bus event', async () => {
        const { wrapper } = mountEntry()
        await wrapper.find('tr').trigger('contextmenu')
        const menu = wrapper.findComponent(VMenu)
        expect(menu.props('modelValue')).toBe(true)
        EventBus.$emit(CLOSE_CONTEXT_MENU)
        await wrapper.vm.$nextTick()
        expect(wrapper.findComponent(VMenu).props('modelValue')).toBe(false)
        wrapper.unmount()
    })

    it('opens the note dialog in create mode when no note exists', async () => {
        const { wrapper } = mountEntry({ job: jobFixture({ note: undefined }) })
        await findMenuButton(wrapper, 'History.AddNote').trigger('click')
        const dialog = wrapper.find('[data-testid="note-dialog"]')
        expect(dialog.exists()).toBe(true)
        expect(dialog.attributes('data-type')).toBe('create')
        wrapper.unmount()
    })

    it('opens the note dialog in edit mode when a note exists', async () => {
        const { wrapper } = mountEntry()
        await findMenuButton(wrapper, 'History.EditNote').trigger('click')
        const dialog = wrapper.find('[data-testid="note-dialog"]')
        expect(dialog.exists()).toBe(true)
        expect(dialog.attributes('data-type')).toBe('edit')
        wrapper.unmount()
    })

    it('opens the details dialog from the context menu', async () => {
        const { wrapper } = mountEntry()
        await findMenuButton(wrapper, 'History.Details').trigger('click')
        expect(wrapper.find('[data-testid="details-dialog"]').exists()).toBe(true)
        wrapper.unmount()
    })
})

describe('HistoryListEntryJob queue, reprint and delete', () => {
    it('adds the file to the job queue with a toast', async () => {
        const { wrapper, dispatchSpy } = mountEntry()
        await findMenuButton(wrapper, 'Files.AddToQueue').trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('server/jobQueue/addToQueue', ['benchy.gcode'])
        expect(mocks.toastInfo).toHaveBeenCalledTimes(1)
        wrapper.unmount()
    })

    it('hides queue entries when the job queue component is unavailable', () => {
        const { wrapper } = mountEntry({ components: [] })
        const buttons = wrapper.findAll('[data-testid="context-menu"] button')
        expect(buttons.find((button) => button.text().includes('Files.AddToQueue'))).toBeUndefined()
        expect(buttons.find((button) => button.text().includes('Files.AddBatchToQueue'))).toBeUndefined()
        wrapper.unmount()
    })

    it('opens the batch queue dialog from the context menu', async () => {
        const { wrapper } = mountEntry()
        await findMenuButton(wrapper, 'Files.AddBatchToQueue').trigger('click')
        expect(wrapper.find('[data-testid="batch-dialog"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('opens the reprint dialog for existing files when idle', async () => {
        const { wrapper } = mountEntry()
        await findMenuButton(wrapper, 'History.Reprint').trigger('click')
        expect(wrapper.find('[data-testid="start-print-dialog"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('disables reprint while printing', () => {
        const { wrapper } = mountEntry({ printerState: 'printing' })
        expect(findMenuButton(wrapper, 'History.Reprint').attributes('disabled')).toBeDefined()
        wrapper.unmount()
    })

    it('deletes the job through the socket', async () => {
        const { wrapper } = mountEntry()
        await findMenuButton(wrapper, 'Buttons.Delete').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.history.delete_job',
            { uid: 'job-1' },
            { action: 'server/history/getDeletedJobs' }
        )
        wrapper.unmount()
    })
})
