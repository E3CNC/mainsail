import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import i18n from '@/plugins/i18n'
import HistoryListPanelDetailsDialog from '@/components/dialogs/HistoryListPanelDetailsDialog.vue'

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

const fullJob = (overrides: Record<string, unknown> = {}) => ({
    job_id: 'job-1',
    exists: true,
    end_time: 1700003600,
    filament_used: 1500,
    filename: 'benchy.gcode',
    metadata: {
        filesize: 1234567,
        modified: 1700000000,
        estimated_time: 3600,
        filament_weight_total: 12.345,
        filament_total: 1500,
        filament_used: 1500,
        first_layer_extr_temp: 210,
        first_layer_bed_temp: 60,
        first_layer_height: 0.3,
        layer_height: 0.2,
        object_height: 25.4,
        slicer: 'OrcaSlicer',
        slicer_version: '2.2.0',
    },
    print_duration: 3600,
    status: 'error',
    start_time: 1700000000,
    total_duration: 3700,
    auxiliary_data: [
        { description: 'Chamber', name: 'temp', provider: 'sensor extras', units: 'C', value: 12.3456 },
        { description: 'Temps', name: 'temps', provider: 'sensor extras', units: '', value: [21, 22] },
        { description: 'Empty', name: 'empty', provider: 'sensor extras', units: 'X', value: [] },
    ],
    ...overrides,
})

const minimalJob = () => ({
    job_id: 'job-9',
    exists: false,
    end_time: 0,
    filament_used: 0,
    filename: 'partial.gcode',
    metadata: {},
    print_duration: 0,
    status: 'cancelled',
    start_time: 1700000000,
    total_duration: 0,
})

const mountDialog = (job: Record<string, unknown>, modelValue = true) => {
    const store = createStore({
        state: {
            socket: { isConnected: true },
            server: {},
            printer: {},
            gui: { general: { dateFormat: 'iso', timeFormat: '24hours' } },
        },
        getters: {},
        actions: {},
    })

    const vuetify = createVuetify()
    return mount(HistoryListPanelDetailsDialog, {
        props: { modelValue, job: job as never },
        global: {
            plugins: [vuetify, store, i18n],
            mocks: { $t: (key: string) => key },
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot name="buttons" /><slot /></div>' },
                OverlayScrollbarsComponent: { template: '<div><slot /></div>' },
                VDialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
                VRow: { template: '<div><slot /></div>' },
                VCol: { template: '<div><slot /></div>' },
                VDivider: { template: '<hr />' },
            },
        },
    })
}

describe('HistoryListPanelDetailsDialog core rows', () => {
    it('renders filename, filesize, timestamps and the raw status fallback', () => {
        const wrapper = mountDialog(fullJob())
        const text = wrapper.text()
        expect(text).toContain('benchy.gcode')
        expect(text).toContain('1.2 MB')
        expect(text).toContain('2023-11-14')
        expect(text).toContain('error')
        expect(text).toContain('History.Filename')
        wrapper.unmount()
    })

    it('hides optional rows when the metadata is missing', () => {
        const wrapper = mountDialog(minimalJob())
        const text = wrapper.text()
        expect(text).toContain('partial.gcode')
        expect(text).not.toContain('History.Filesize')
        expect(text).not.toContain('History.EstimatedTime')
        expect(text).not.toContain('History.Slicer')
        expect(text).not.toContain('History.EndTime')
        expect(text).not.toContain('History.PrintDuration')
        wrapper.unmount()
    })

    it('shows slicer, filament and temperature rows for rich metadata', () => {
        const wrapper = mountDialog(fullJob())
        const text = wrapper.text()
        expect(text).toContain('OrcaSlicer')
        expect(text).toContain('2.2.0')
        expect(text).toContain('12.35 g')
        expect(text).toContain('1500 mm')
        expect(text).toContain('210 °C')
        expect(text).toContain('60 °C')
        expect(text).toContain('1h')
        wrapper.unmount()
    })

    it('translates known statuses once locale messages exist', () => {
        i18n.global.setLocaleMessage('en', {
            History: { StatusValues: { completed: 'Completed!' } },
        })
        const wrapper = mountDialog(fullJob({ status: 'completed' }))
        expect(wrapper.text()).toContain('Completed!')
        wrapper.unmount()
    })
})

describe('HistoryListPanelDetailsDialog auxiliary data and closing', () => {
    it('formats scalar, array and empty auxiliary values', () => {
        const wrapper = mountDialog(fullJob())
        const text = wrapper.text()
        expect(text).toContain('12.346 C')
        expect(text).toContain('21,22')
        expect(text).toContain('--')
        wrapper.unmount()
    })

    it('renders nothing when the dialog is closed', () => {
        const wrapper = mountDialog(fullJob(), false)
        expect(wrapper.text()).not.toContain('benchy.gcode')
        wrapper.unmount()
    })

    it('emits the model update when the close button is clicked', async () => {
        const wrapper = mountDialog(fullJob())
        await wrapper.findComponent({ name: 'VBtn' }).trigger('click')
        expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
        wrapper.unmount()
    })
})
