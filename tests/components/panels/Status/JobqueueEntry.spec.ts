import { describe, expect, it, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import JobqueueEntry from '@/components/panels/Status/JobqueueEntry.vue'
import { EventBus, CLOSE_CONTEXT_MENU } from '@/plugins/eventBus'

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

const baseJob = (overrides: Record<string, unknown> = {}) => ({
    filename: 'cube.gcode',
    job_id: 'queue-1',
    time_added: 1700000000,
    time_in_queue: 10,
    metadata: {
        metadataPulled: true,
        filament_total: 500,
        filament_weight_total: 15,
        estimated_time: 3661,
    },
    combinedIds: [],
    ...overrides,
})

const createTestWrapper = (
    jobOverrides: Record<string, unknown> = {},
    options: { printerState?: string; showPrintButton?: boolean; showHandle?: boolean } = {}
) => {
    const { printerState = 'standby', showPrintButton = false, showHandle = false } = options
    const job = baseJob(jobOverrides)
    const vuetify = createVuetify()
    const dispatch = vi.fn()

    const store = createStore({
        state: {
            socket: { isConnected: true, hostname: '127.0.0.1', port: 7125, initializationList: [] },
            server: { klippy_connected: true, klippy_state: 'ready', components: ['job_queue'] },
            printer: {
                print_stats: { state: printerState },
                idle_timeout: { state: 'Idle' },
            },
            gui: {},
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'socket/getHostUrl': () => 'http://127.0.0.1',
            'server/power/getDevices': () => [],
        },
        actions: {
            'server/jobQueue/startByJobId': (_ctx: never, payload: never) => dispatch(`startByJobId:${payload}`),
            'server/jobQueue/start': () => dispatch('start'),
            'server/jobQueue/deleteFromQueue': (_ctx: never, payload: never) => dispatch(payload as never),
        },
    })

    const wrapper = mount(JobqueueEntry, {
        props: { job: job as never, showPrintButton: showPrintButton as never, showHandle: showHandle as never },
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            directives: { longpress: {} },
            stubs: {
                GcodefilesThumbnail: { template: '<div data-testid="thumb" />' },
                VMenu: {
                    props: ['modelValue'],
                    template: '<div data-testid="menu" v-if="modelValue"><slot /></div>',
                },
                VList: { template: '<div><slot /></div>' },
                VListItem: {
                    template: '<div data-testid="menu-item" @click="$emit(\'click\')"><slot /></div>',
                },
                JobqueueEntryChangeCountDialog: { template: '<div data-testid="count-dialog" />' },
            },
        },
    })

    return { wrapper, job, dispatch }
}

describe('JobqueueEntry', () => {
    it('renders the filename without a multiplier for single jobs', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.text()).toContain('cube.gcode')
        expect(wrapper.text()).not.toContain('2x')
        wrapper.unmount()
    })

    it('prefixes combined jobs with their multiplier', () => {
        const { wrapper } = createTestWrapper({ combinedIds: ['a', 'b'] })
        // combinedIds.length + 1 = 3
        expect(wrapper.text()).toContain('3x')
        wrapper.unmount()
    })

    it('renders filament and print-time description', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.text()).toContain('Filament: 500 mm / 15 g')
        expect(wrapper.text()).toContain('Print Time: 1h 1m')
        wrapper.unmount()
    })

    it('formats long filament in meters', () => {
        const { wrapper } = createTestWrapper({
            metadata: { metadataPulled: true, filament_total: 2500, filament_weight_total: 10, estimated_time: 60 },
        })
        expect(wrapper.text()).toContain('2.5 m')
        wrapper.unmount()
    })

    it('shows placeholders when metadata is not pulled', () => {
        const { wrapper } = createTestWrapper({ metadata: { metadataPulled: false } })
        expect(wrapper.text()).toContain('cube.gcode')
        // description is false, so no Filament line
        expect(wrapper.text()).not.toContain('Filament:')
        wrapper.unmount()
    })

    it('formats multi-day estimates with days', () => {
        const { wrapper } = createTestWrapper({
            metadata: { metadataPulled: true, filament_total: 10, filament_weight_total: 1, estimated_time: 90000 },
        })
        expect(wrapper.text()).toContain('1d')
        wrapper.unmount()
    })

    it('shows the drag handle when requested', () => {
        const { wrapper } = createTestWrapper({}, { showHandle: true })
        expect(wrapper.html()).toContain('handle')
        wrapper.unmount()
    })

    it('hides the drag handle by default', () => {
        const { wrapper } = createTestWrapper({}, { showHandle: false })
        expect(wrapper.html()).not.toContain('handle')
        wrapper.unmount()
    })

    it('shows the quick print button only when idle', async () => {
        const idle = createTestWrapper({}, { showPrintButton: true, printerState: 'standby' })
        expect(idle.wrapper.find('button').exists()).toBe(true)
        await idle.wrapper.find('button').trigger('click')
        expect(idle.dispatch).toHaveBeenCalledWith('start')
        idle.wrapper.unmount()

        const printing = createTestWrapper({}, { showPrintButton: true, printerState: 'printing' })
        expect(printing.wrapper.find('button').exists()).toBe(false)
        printing.wrapper.unmount()
    })

    it('opens the context menu on right-click', async () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="menu"]').exists()).toBe(false)
        await wrapper.find('.jobqueue-list-entry').trigger('contextmenu', { clientX: 3, clientY: 4 })
        await nextTick()
        expect(wrapper.find('[data-testid="menu"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('starts the job from the context menu', async () => {
        const { wrapper, job, dispatch } = createTestWrapper()
        await wrapper.find('.jobqueue-list-entry').trigger('contextmenu', { clientX: 1, clientY: 1 })
        await nextTick()
        const items = wrapper.findAll('[data-testid="menu-item"]')
        expect(items).toHaveLength(3)
        await items[0].trigger('click')
        expect(dispatch).toHaveBeenCalledWith(`startByJobId:${job.job_id}`)
        wrapper.unmount()
    })

    it('removes the job and its combined ids from the queue', async () => {
        const { wrapper, dispatch } = createTestWrapper({ job_id: 'main', combinedIds: ['a', 'b'] })
        await wrapper.find('.jobqueue-list-entry').trigger('contextmenu', { clientX: 1, clientY: 1 })
        await nextTick()
        const items = wrapper.findAll('[data-testid="menu-item"]')
        await items[2].trigger('click')
        expect(dispatch).toHaveBeenCalledWith(['a', 'b', 'main'])
        wrapper.unmount()
    })

    it('closes the context menu on the global event', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('.jobqueue-list-entry').trigger('contextmenu', { clientX: 1, clientY: 1 })
        await nextTick()
        expect(wrapper.find('[data-testid="menu"]').exists()).toBe(true)
        EventBus.$emit(CLOSE_CONTEXT_MENU)
        await nextTick()
        await flushPromises()
        expect(wrapper.find('[data-testid="menu"]').exists()).toBe(false)
        wrapper.unmount()
    })
})
