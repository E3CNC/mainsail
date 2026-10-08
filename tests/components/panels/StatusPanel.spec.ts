import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import StatusPanel from '@/components/panels/StatusPanel.vue'

const mocks = vi.hoisted(() => {
    return {
        emit: vi.fn(),
    }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
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
})

interface WrapperOptions {
    printerState?: string
    filename?: string
    idleTimeoutState?: string
    printPercent?: number
    jobsCount?: number
    printStatsMessage?: string | null
    displayMessage?: string | null
    displayCancelPrint?: boolean
    confirmOnCancelJob?: boolean
    dashboardFilesLimit?: number
    dashboardHistoryLimit?: number
    klippyReady?: boolean
    socketConnected?: boolean
}

const createTestWrapper = (options: WrapperOptions = {}) => {
    const {
        printerState = 'standby',
        filename = '',
        idleTimeoutState = 'Idle',
        printPercent = 0.42,
        jobsCount = 0,
        printStatsMessage = null,
        displayMessage = null,
        displayCancelPrint = true,
        confirmOnCancelJob = false,
        dashboardFilesLimit = 5,
        dashboardHistoryLimit = 5,
        klippyReady = true,
        socketConnected = true,
    } = options

    const vuetify = createVuetify()

    const store = createStore({
        state: {
            socket: {
                isConnected: socketConnected,
                hostname: '127.0.0.1',
                port: 7125,
                initializationList: [],
                loadings: [],
            },
            server: {
                klippy_connected: klippyReady,
                klippy_state: klippyReady ? 'ready' : 'disconnected',
                components: [],
            },
            printer: {
                print_stats: { state: printerState, filename, message: printStatsMessage },
                idle_timeout: { state: idleTimeoutState },
                display_status: { message: displayMessage },
            },
            gui: {
                uiSettings: {
                    displayCancelPrint,
                    confirmOnCancelJob,
                    dashboardFilesLimit,
                    dashboardHistoryLimit,
                },
                general: { timeFormat: '24hours' },
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'socket/getHostUrl': () => 'http://127.0.0.1',
            'server/jobQueue/getJobsCount': () => jobsCount,
            'printer/getPrintPercent': () => printPercent,
            'server/power/getDevices': () => [],
        },
        actions: {},
    })

    const wrapper = mount(StatusPanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                MinSettingsPanel: { template: '<div data-testid="min-settings" />' },
                KlippyStatePanel: { template: '<div data-testid="klippy-state" />' },
                Panel: {
                    props: ['icon', 'title', 'collapsible', 'cardClass'],
                    template:
                        '<div data-testid="panel" :data-title="title"><div data-testid="toolbar"><slot name="buttons" /></div><slot name="icon" /><slot /></div>',
                },
                StatusPanelPrintstatus: { template: '<div data-testid="printstatus" />' },
                StatusPanelGcodefiles: { template: '<div data-testid="gcodefiles" />' },
                StatusPanelHistory: { template: '<div data-testid="history-tab" />' },
                StatusPanelJobqueue: { template: '<div data-testid="jobqueue-tab" />' },
                ConfirmationDialog: {
                    props: ['modelValue'],
                    template: '<div data-testid="confirm" v-if="modelValue"><slot /></div>',
                },
            },
        },
    })

    return { wrapper, store }
}

const toolbarButtons = (wrapper: ReturnType<typeof mount>) => {
    return wrapper.find('[data-testid="toolbar"]').findAll('button')
}

describe('StatusPanel', () => {
    it('renders the status panel when klipper is ready', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="min-settings"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="klippy-state"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('hides the status panel when klipper is not ready', () => {
        const { wrapper } = createTestWrapper({ klippyReady: false })
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('titles the panel with the capitalized printer state', () => {
        const { wrapper } = createTestWrapper({ printerState: 'standby' })
        expect(wrapper.find('[data-testid="panel"]').attributes('data-title')).toBe('Standby')
        wrapper.unmount()
    })

    it('titles the panel Busy for standby with Printing idle_timeout', () => {
        const { wrapper } = createTestWrapper({ printerState: 'standby', idleTimeoutState: 'Printing' })
        expect(wrapper.find('[data-testid="panel"]').attributes('data-title')).toBe('Busy')
        wrapper.unmount()
    })

    it('titles the panel with percent while printing', () => {
        const { wrapper } = createTestWrapper({ printerState: 'printing', printPercent: 0.424 })
        // Math.floor(0.424 * 100) = 42
        expect(wrapper.find('[data-testid="panel"]').attributes('data-title')).toBe('42% Printing')
        wrapper.unmount()
    })

    it('titles the panel Unknown when printer state is empty', () => {
        const { wrapper } = createTestWrapper({ printerState: '' })
        expect(wrapper.find('[data-testid="panel"]').attributes('data-title')).toBe('Panels.StatusPanel.Unknown')
        wrapper.unmount()
    })

    it('shows pause + cancel while printing and pauses the job', async () => {
        const { wrapper } = createTestWrapper({ printerState: 'printing' })
        const buttons = toolbarButtons(wrapper as never)
        // pause + cancel (resume/clear/reprint hidden)
        expect(buttons).toHaveLength(2)
        await buttons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.print.pause', {}, { loading: 'statusPrintPause' })
        wrapper.unmount()
    })

    it('shows resume + cancel while paused and resumes the job', async () => {
        const { wrapper } = createTestWrapper({ printerState: 'paused' })
        const buttons = toolbarButtons(wrapper as never)
        expect(buttons).toHaveLength(2)
        await buttons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.print.resume', {}, { loading: 'statusPrintResume' })
        wrapper.unmount()
    })

    it('shows cancel for printing when displayCancelPrint is enabled', async () => {
        const { wrapper } = createTestWrapper({ printerState: 'printing', displayCancelPrint: true })
        const buttons = toolbarButtons(wrapper as never)
        expect(buttons).toHaveLength(2)
        const cancelIndex = buttons.length - 1
        await buttons[cancelIndex].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.print.cancel', {}, { loading: 'statusPrintCancel' })
        wrapper.unmount()
    })

    it('hides cancel for printing when displayCancelPrint is disabled', () => {
        const { wrapper } = createTestWrapper({ printerState: 'printing', displayCancelPrint: false })
        const buttons = toolbarButtons(wrapper as never)
        // only pause remains
        expect(buttons).toHaveLength(1)
        wrapper.unmount()
    })

    it('opens the confirm dialog when confirmOnCancelJob is enabled', async () => {
        const { wrapper } = createTestWrapper({
            printerState: 'paused',
            displayCancelPrint: false,
            confirmOnCancelJob: true,
        })
        expect(wrapper.find('[data-testid="confirm"]').exists()).toBe(false)
        const buttons = wrapper.find('[data-testid="toolbar"]').findAll('button')
        await buttons[buttons.length - 1].trigger('click')
        await nextTick()
        expect(wrapper.find('[data-testid="confirm"]').exists()).toBe(true)
        expect(mocks.emit).not.toHaveBeenCalledWith('printer.print.cancel', {}, { loading: 'statusPrintCancel' })
        wrapper.unmount()
    })

    it('shows clear and reprint actions for completed prints', async () => {
        const { wrapper } = createTestWrapper({ printerState: 'complete', filename: 'cube.gcode' })
        const buttons = toolbarButtons(wrapper as never)
        expect(buttons).toHaveLength(2)
        await buttons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith(
            'printer.gcode.script',
            { script: 'SDCARD_RESET_FILE' },
            { loading: 'statusPrintClear' }
        )
        await buttons[1].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith(
            'printer.print.start',
            { filename: 'cube.gcode' },
            { loading: 'statusPrintReprint' }
        )
        wrapper.unmount()
    })

    it('renders print_stats and display messages', () => {
        const { wrapper } = createTestWrapper({
            printStatsMessage: 'stats boom',
            displayMessage: 'hello lcd',
        })
        expect(wrapper.text()).toContain('stats boom')
        expect(wrapper.text()).toContain('hello lcd')
        wrapper.unmount()
    })

    it('clears the display message with M117', async () => {
        const { wrapper } = createTestWrapper({ displayMessage: 'hello lcd' })
        // the close icon is the only element with the cursor-pointer class
        const closer = wrapper.find('.cursor-pointer')
        expect(closer.exists()).toBe(true)
        await closer.trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M117' })
        wrapper.unmount()
    })

    it('switches to the status tab when a filename is present on mount', async () => {
        const { wrapper } = createTestWrapper({ filename: 'cube.gcode' })
        await flushPromises()
        expect(wrapper.find('[data-testid="printstatus"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('reacts to filename changes via the watcher', async () => {
        const { wrapper, store } = createTestWrapper({ filename: '' })
        await flushPromises()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(store.state as any).printer.print_stats.filename = 'next.gcode'
        await nextTick()
        await flushPromises()
        expect(wrapper.find('[data-testid="printstatus"]').exists()).toBe(true)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(store.state as any).printer.print_stats.filename = ''
        await nextTick()
        await flushPromises()
        // clearing the filename falls back to the files tab; printstatus hides
        expect(wrapper.find('[data-testid="printstatus"]').exists()).toBe(false)
        wrapper.unmount()
    })
})
