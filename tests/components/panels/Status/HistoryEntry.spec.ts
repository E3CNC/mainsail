import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import HistoryEntry from '@/components/panels/Status/HistoryEntry.vue'
import { EventBus, CLOSE_CONTEXT_MENU } from '@/plugins/eventBus'

const mocks = vi.hoisted(() => {
    return {
        emit: vi.fn(),
        toastInfo: vi.fn(),
    }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('vue-toast-notification', () => ({
    useToast: () => ({ info: mocks.toastInfo }),
}))

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
})

beforeEach(() => {
    mocks.emit.mockReset()
    mocks.toastInfo.mockReset()
})

interface JobOverrides {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
}

const baseJob = (overrides: JobOverrides = {}) => ({
    job_id: 'job-1',
    exists: true,
    end_time: 1700000000,
    filament_used: 500,
    filename: 'cube.gcode',
    metadata: {
        filament_total: 1000,
        filament_weight_total: 30,
        modified: 123456,
        thumbnails: [],
    },
    print_duration: 3661,
    total_duration: 4000,
    status: 'completed',
    start_time: 1699990000,
    count: 1,
    ...overrides,
})

const createTestWrapper = (
    jobOverrides: JobOverrides = {},
    storeOverrides: {
        fileExists?: boolean
        components?: string[]
        bigThumbnailBackground?: string
        printerState?: string
    } = {}
) => {
    const {
        fileExists = true,
        components = ['job_queue'],
        bigThumbnailBackground = '#1e1e1e',
        printerState = 'standby',
    } = storeOverrides
    const job = baseJob(jobOverrides)
    const vuetify = createVuetify()
    const dispatch = vi.fn()

    const store = createStore({
        state: {
            socket: { isConnected: true, hostname: '127.0.0.1', port: 7125, initializationList: [] },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components,
            },
            printer: {
                print_stats: { state: printerState },
                idle_timeout: { state: 'Idle' },
            },
            files: {},
            gui: {
                uiSettings: { bigThumbnailBackground },
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'socket/getHostUrl': () => 'http://127.0.0.1',
            'files/getFile':
                () =>
                (path: string): unknown => {
                    if (!fileExists) return null
                    if (path === 'gcodes/' + job.filename) {
                        return { filename: job.filename, path }
                    }
                    return null
                },
            'server/power/getDevices': () => [],
        },
        actions: {
            'server/jobQueue/addToQueue': (_ctx: never, payload: never) => dispatch(payload),
        },
    })

    const wrapper = mount(HistoryEntry, {
        props: { job: job as never },
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            directives: { longpress: {} },
            stubs: {
                VueLoadImage: {
                    template: '<div data-testid="thumb"><slot name="image" /><slot name="error" /></div>',
                },
                VTooltip: {
                    template: '<div data-testid="tooltip"><slot name="activator" :props="{}" /><slot /></div>',
                },
                VMenu: {
                    props: ['modelValue'],
                    template: '<div data-testid="menu" v-if="modelValue"><slot /></div>',
                },
                VList: { template: '<div data-testid="list"><slot /></div>' },
                VListItem: {
                    template: '<div data-testid="menu-item" @click="$emit(\'click\')"><slot /></div>',
                },
                StartPrintDialog: { template: '<div data-testid="start-dialog" />' },
                AddBatchToQueueDialog: { template: '<div data-testid="batch-dialog" />' },
            },
        },
    })

    return { wrapper, store, job, dispatch }
}

describe('HistoryEntry', () => {
    it('renders the filename without a count prefix for single jobs', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.text()).toContain('cube.gcode')
        expect(wrapper.text()).not.toContain('2x')
        wrapper.unmount()
    })

    it('prefixes the filename with the repeat count', () => {
        const { wrapper } = createTestWrapper({ count: 3 })
        expect(wrapper.text()).toContain('3x')
        expect(wrapper.text()).toContain('cube.gcode')
        wrapper.unmount()
    })

    it('renders filament and print-time description', () => {
        const { wrapper } = createTestWrapper()
        const text = wrapper.text()
        // 500mm filament, ~15g weight, 1h 1m print time
        expect(text).toContain('Filament:')
        expect(text).toContain('500 mm')
        expect(text).toContain('Print Time:')
        wrapper.unmount()
    })

    it('formats long filament in meters', () => {
        const { wrapper } = createTestWrapper({ filament_used: 2500 })
        expect(wrapper.text()).toContain('2.5 m')
        wrapper.unmount()
    })

    it('shows placeholder filament when length is zero', () => {
        const { wrapper } = createTestWrapper({ filament_used: 0 })
        expect(wrapper.text()).toContain('Filament: --')
        wrapper.unmount()
    })

    it('falls back to total time when print duration is zero', () => {
        const { wrapper } = createTestWrapper({ print_duration: 0, total_duration: 90 })
        expect(wrapper.text()).toContain('Total Time:')
        wrapper.unmount()
    })

    it('renders the localized status name', () => {
        const { wrapper } = createTestWrapper({ status: 'completed' })
        expect(wrapper.text()).toContain('History.StatusValues.completed')
        wrapper.unmount()
    })

    it('colors the status icon with the status color, not the icon path', () => {
        const { wrapper } = createTestWrapper({ status: 'completed' })
        const colors = wrapper.findAllComponents({ name: 'VIcon' }).map((icon) => icon.props('color'))
        expect(colors).toContain('success')
        wrapper.unmount()
    })

    it('builds thumbnail urls for small and big variants', () => {
        const thumbnails = [
            { width: 32, height: 32, size: 100, relative_path: 'thumb-32.png' },
            { width: 300, height: 300, size: 500, relative_path: 'thumb-300.png' },
        ]
        const { wrapper } = createTestWrapper({ filename: 'sub/cube.gcode', metadata: { thumbnails, modified: 999 } })
        const img = wrapper.find('[data-testid="thumb"] img')
        expect(img.exists()).toBe(true)
        expect(img.attributes('src')).toContain('thumb-32.png')
        wrapper.unmount()
    })

    it('falls back to the file icon when no thumbnail matches', () => {
        const { wrapper } = createTestWrapper({ metadata: { thumbnails: [] } })
        // v-if smallThumbnail is false, so the thumbnail loader is skipped
        expect(wrapper.find('[data-testid="thumb"]').exists()).toBe(false)
        expect(wrapper.text()).toContain('cube.gcode')
        wrapper.unmount()
    })

    it('opens the context menu on right-click', async () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="menu"]').exists()).toBe(false)
        await wrapper.find('.history-list-entry').trigger('contextmenu', { clientX: 10, clientY: 20 })
        await nextTick()
        expect(wrapper.find('[data-testid="menu"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('closes the context menu on the global event', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('.history-list-entry').trigger('contextmenu', { clientX: 5, clientY: 5 })
        await nextTick()
        expect(wrapper.find('[data-testid="menu"]').exists()).toBe(true)
        EventBus.$emit(CLOSE_CONTEXT_MENU)
        await nextTick()
        await flushPromises()
        expect(wrapper.find('[data-testid="menu"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('adds the file to the queue with a toast', async () => {
        const { wrapper, dispatch, job } = createTestWrapper()
        await wrapper.find('.history-list-entry').trigger('contextmenu', { clientX: 1, clientY: 1 })
        await nextTick()
        const items = wrapper.findAll('[data-testid="menu-item"]')
        // reprint, add-to-queue, add-batch, delete
        expect(items.length).toBeGreaterThanOrEqual(3)
        await items[1].trigger('click')
        expect(dispatch).toHaveBeenCalledWith([job.filename])
        expect(mocks.toastInfo).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('hides queue actions when the job_queue component is missing', async () => {
        const { wrapper } = createTestWrapper({}, { components: [] })
        await wrapper.find('.history-list-entry').trigger('contextmenu', { clientX: 1, clientY: 1 })
        await nextTick()
        const text = wrapper.find('[data-testid="menu"]').text()
        expect(text).not.toContain('Files.AddToQueue')
        wrapper.unmount()
    })

    it('deletes the job via socket', async () => {
        const { wrapper, job } = createTestWrapper()
        await wrapper.find('.history-list-entry').trigger('contextmenu', { clientX: 1, clientY: 1 })
        await nextTick()
        const items = wrapper.findAll('[data-testid="menu-item"]')
        await items[items.length - 1].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.history.delete_job',
            { uid: job.job_id },
            { action: 'server/history/getDeletedJobs' }
        )
        wrapper.unmount()
    })

    it('uses a custom tooltip color when the background differs', () => {
        const { wrapper } = createTestWrapper({}, { bigThumbnailBackground: '#ffffff' })
        expect(wrapper.find('[data-testid="tooltip"]').exists()).toBe(true)
        wrapper.unmount()
    })
})
