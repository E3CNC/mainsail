import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import i18n from '@/plugins/i18n'
import HistoryStatisticsPanel from '@/components/panels/HistoryStatisticsPanel.vue'
import { mdiDatabaseArrowDownOutline } from '@mdi/js'

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
    metadata: {},
    print_duration: 3600,
    status: 'completed',
    start_time: 1700000000,
    total_duration: 3700,
    ...overrides,
})

interface StatsOptions {
    jobs?: Record<string, unknown>[]
    selectedJobs?: Record<string, unknown>[]
    jobTotals?: Record<string, unknown>
    auxiliaryTotals?: Record<string, unknown>[]
    historyConfig?: Record<string, unknown>
    allLoaded?: boolean
    toggleChartCol2?: string
    toggleChartCol3?: string
}

const mountPanel = (options: StatsOptions = {}) => {
    const {
        jobs = [jobFixture()],
        selectedJobs = [],
        jobTotals = {
            total_jobs: 3,
            total_time: 8000,
            total_print_time: 7320,
            total_filament_used: 2500,
            longest_job: 5100,
            longest_print: 5000,
        },
        auxiliaryTotals = [],
        historyConfig = {},
        allLoaded = false,
        toggleChartCol2 = 'chart',
        toggleChartCol3 = 'printtime_avg',
    } = options

    const store = createStore({
        state: {
            socket: { isConnected: true, loadings: [] },
            server: {
                history: { jobs, job_totals: jobTotals, auxiliary_totals: auxiliaryTotals, all_loaded: allLoaded },
                config: { config: historyConfig },
            },
            gui: {
                view: {
                    history: {
                        selectedJobs: selectedJobs.map((job) => ({ ...job, type: 'job' })),
                        hidePrintStatus: [],
                        toggleChartCol2,
                        toggleChartCol3,
                    },
                },
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
        },
        actions: {
            'gui/saveSetting': (context: never, payload: never) => {
                const ctx = context as unknown as {
                    state: { gui: { view: { history: Record<string, unknown> } } }
                }
                const parsed = payload as unknown as { name: string; value: unknown }
                const key = parsed.name.replace('view.history.', '')
                if (key in ctx.state.gui.view.history) ctx.state.gui.view.history[key] = parsed.value
            },
            'socket/addLoading': () => {},
        },
    })
    const dispatchSpy = vi.spyOn(store, 'dispatch')

    const vuetify = createVuetify()
    const wrapper = mount(HistoryStatisticsPanel, {
        global: {
            plugins: [vuetify, store, i18n],
            mocks: { $t: (key: string) => key },
            directives: { longpress: {}, ripple: {} },
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot /></div>' },
                HistoryPrinttimeAvg: { template: '<div data-testid="printtime-avg" />' },
                HistoryAllPrintStatusChart: {
                    props: ['valueName'],
                    template: '<div data-testid="status-chart" :data-value="valueName" />',
                },
                HistoryAllPrintStatusTable: {
                    props: ['valueName'],
                    template: '<div data-testid="status-table" :data-value="valueName" />',
                },
                VTooltip: { template: '<div><slot name="activator" :props="{}" /><slot /></div>' },
            },
        },
    })
    return { wrapper, store, dispatchSpy }
}

const findBtnByText = (wrapper: VueWrapper, text: string) => {
    const found = wrapper.findAllComponents({ name: 'VBtn' }).find((button) => button.text().includes(text))
    if (!found) throw new Error(`button "${text}" not found`)
    return found
}

const findBtnByIcon = (wrapper: VueWrapper, icon: string) => {
    const found = wrapper.findAllComponents({ name: 'VBtn' }).find((button) => button.html().includes(icon))
    if (!found) throw new Error('button with expected icon not found')
    return found
}

describe('HistoryStatisticsPanel totals', () => {
    it('renders the generic totals from the history job totals', () => {
        const { wrapper } = mountPanel()
        const text = wrapper.text()
        expect(text).toContain('History.TotalPrinttime')
        expect(text).toContain('2h 2m')
        expect(text).toContain('1h 23m 20s')
        expect(text).toContain('40m 40s')
        expect(text).toContain('2.5 m')
        expect(text).toContain('History.TotalJobs')
        wrapper.unmount()
    })

    it('renders selected totals when jobs are selected', () => {
        const { wrapper } = mountPanel({
            selectedJobs: [jobFixture(), jobFixture({ job_id: 'job-2', print_duration: 100, filament_used: 800 })],
        })
        const text = wrapper.text()
        expect(text).toContain('History.SelectedPrinttime')
        expect(text).toContain('1h 1m 40s')
        expect(text).toContain('1h')
        expect(text).toContain('30m 50s')
        expect(text).toContain('2.3 m')
        expect(text).toContain('History.SelectedJobs')
        wrapper.unmount()
    })

    it('renders zero averages as placeholders without any jobs', () => {
        const { wrapper } = mountPanel({
            jobs: [],
            jobTotals: {
                total_jobs: 0,
                total_time: 0,
                total_print_time: 0,
                total_filament_used: 0,
                longest_job: 0,
                longest_print: 0,
            },
        })
        expect(wrapper.text()).toContain('--')
        wrapper.unmount()
    })

    it('appends auxiliary totals from moonraker history fields', () => {
        const { wrapper } = mountPanel({
            auxiliaryTotals: [{ field: 'temp', provider: 'sensor extras', maximum: 30, total: 25.6789 }],
            historyConfig: {
                'sensor extras': {
                    history_field_temp: { desc: 'Chamber Temp', units: 'C', parameter: 'temperature' },
                },
            },
        })
        expect(wrapper.text()).toContain('Chamber Temp')
        expect(wrapper.text()).toContain('25.679 C')
        wrapper.unmount()
    })

    it('sums auxiliary values of the selected jobs', () => {
        const { wrapper } = mountPanel({
            selectedJobs: [
                jobFixture({
                    auxiliary_data: [
                        { description: 'Chamber', name: 'temp', provider: 'sensor extras', units: 'C', value: 10 },
                    ],
                }),
                jobFixture({
                    job_id: 'job-2',
                    auxiliary_data: [
                        { description: 'Chamber', name: 'temp', provider: 'sensor extras', units: 'C', value: 5 },
                    ],
                }),
            ],
            historyConfig: {
                'sensor extras': {
                    history_field_temp: { desc: 'Chamber Temp', units: 'C', parameter: 'temperature' },
                },
            },
        })
        expect(wrapper.text()).toContain('Chamber Temp')
        expect(wrapper.text()).toContain('15 C')
        wrapper.unmount()
    })
})

describe('HistoryStatisticsPanel charts and toggles', () => {
    it('shows the status chart by default and forwards the value toggle', async () => {
        const { wrapper } = mountPanel()
        expect(wrapper.find('[data-testid="status-chart"]').attributes('data-value')).toBe('jobs')
        await findBtnByText(wrapper, 'History.Time').trigger('click')
        expect(wrapper.find('[data-testid="status-chart"]').attributes('data-value')).toBe('time')
        await findBtnByText(wrapper, 'History.Filament').trigger('click')
        expect(wrapper.find('[data-testid="status-chart"]').attributes('data-value')).toBe('filament')
        wrapper.unmount()
    })

    it('switches to the status table and persists the toggle', async () => {
        const { wrapper, dispatchSpy } = mountPanel()
        await findBtnByText(wrapper, 'History.Table').trigger('click')
        expect(wrapper.find('[data-testid="status-table"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="status-chart"]').exists()).toBe(false)
        expect(dispatchSpy).toHaveBeenCalledWith('gui/saveSetting', {
            name: 'view.history.toggleChartCol2',
            value: 'table',
        })
        wrapper.unmount()
    })

    it('persists the third column chart toggle', async () => {
        const { wrapper, dispatchSpy } = mountPanel({ toggleChartCol3: 'other' })
        expect(wrapper.find('[data-testid="printtime-avg"]').exists()).toBe(false)
        await findBtnByText(wrapper, 'History.PrinttimeAvg').trigger('click')
        expect(wrapper.find('[data-testid="printtime-avg"]').exists()).toBe(true)
        expect(dispatchSpy).toHaveBeenCalledWith('gui/saveSetting', {
            name: 'view.history.toggleChartCol3',
            value: 'printtime_avg',
        })
        wrapper.unmount()
    })

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

    it('hides the refresh button once the full history is loaded', () => {
        const { wrapper } = mountPanel({ allLoaded: true })
        expect(
            wrapper
                .findAllComponents({ name: 'VBtn' })
                .some((button) => button.html().includes(mdiDatabaseArrowDownOutline))
        ).toBe(false)
        wrapper.unmount()
    })
})
