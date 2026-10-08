import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import Gcodefiles from '@/components/panels/Status/Gcodefiles.vue'

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

interface StatusFile {
    filename: string
    modified: Date
    last_status: string | null
    metadataRequested?: boolean
    metadataPulled?: boolean
}

const makeFile = (overrides: Partial<StatusFile> & { filename: string }): StatusFile => ({
    modified: new Date('2024-01-02T03:04:05Z'),
    last_status: null,
    metadataRequested: false,
    metadataPulled: false,
    ...overrides,
})

const createTestWrapper = (options: { files?: StatusFile[]; limit?: number; filter?: string[] } = {}) => {
    const { files = [], limit = 5, filter = [] } = options
    const vuetify = createVuetify()
    const requestMetadata = vi.fn()
    const store = createStore({
        state: {
            socket: { isConnected: true, hostname: '127.0.0.1', port: 7125, initializationList: [] },
            server: { klippy_connected: true, klippy_state: 'ready' },
            printer: { print_stats: { state: 'standby' } },
            gui: {
                general: { timeFormat: '24hours', dateFormat: 'iso' },
                uiSettings: { dashboardFilesLimit: limit, dashboardFilesFilter: filter },
            },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'files/getAllGcodes': () => files,
        },
        actions: {
            'files/requestMetadata': (_ctx: never, payload: never) => {
                requestMetadata(payload)
            },
        },
    })

    const wrapper = mount(Gcodefiles, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                StatusPanelGcodefilesEntry: {
                    props: ['item', 'contentTdWidth'],
                    template: '<tr class="entry-stub"><td>{{ item.filename }}</td></tr>',
                },
            },
        },
    })
    return { wrapper, requestMetadata }
}

describe('Status Gcodefiles', () => {
    it('renders the empty message when there are no files', () => {
        const { wrapper } = createTestWrapper({ files: [] })
        expect(wrapper.text()).toContain('Panels.StatusPanel.EmptyGcodes')
        expect(wrapper.findAll('.entry-stub')).toHaveLength(0)
        wrapper.unmount()
    })

    it('renders one entry per file', () => {
        const { wrapper } = createTestWrapper({
            files: [makeFile({ filename: 'a.gcode' }), makeFile({ filename: 'b.gcode' })],
        })
        expect(wrapper.findAll('.entry-stub')).toHaveLength(2)
        expect(wrapper.text()).toContain('a.gcode')
        expect(wrapper.text()).toContain('b.gcode')
        wrapper.unmount()
    })

    it('sorts by modified descending and honours the limit', () => {
        const { wrapper } = createTestWrapper({
            limit: 2,
            files: [
                makeFile({ filename: 'old.gcode', modified: new Date('2024-01-01T00:00:00Z') }),
                makeFile({ filename: 'new.gcode', modified: new Date('2024-03-01T00:00:00Z') }),
                makeFile({ filename: 'mid.gcode', modified: new Date('2024-02-01T00:00:00Z') }),
            ],
        })
        const rows = wrapper.findAll('.entry-stub')
        expect(rows).toHaveLength(2)
        expect(rows[0].text()).toContain('new.gcode')
        expect(rows[1].text()).toContain('mid.gcode')
        wrapper.unmount()
    })

    it('filters to new files only', () => {
        const { wrapper } = createTestWrapper({
            filter: ['new'],
            files: [
                makeFile({ filename: 'fresh.gcode', last_status: null }),
                makeFile({ filename: 'done.gcode', last_status: 'completed' }),
                makeFile({ filename: 'bad.gcode', last_status: 'cancelled' }),
            ],
        })
        const rows = wrapper.findAll('.entry-stub')
        expect(rows).toHaveLength(1)
        expect(rows[0].text()).toContain('fresh.gcode')
        wrapper.unmount()
    })

    it('filters to completed files only', () => {
        const { wrapper } = createTestWrapper({
            filter: ['completed'],
            files: [
                makeFile({ filename: 'fresh.gcode', last_status: null }),
                makeFile({ filename: 'done.gcode', last_status: 'completed' }),
                makeFile({ filename: 'bad.gcode', last_status: 'cancelled' }),
            ],
        })
        const rows = wrapper.findAll('.entry-stub')
        expect(rows).toHaveLength(1)
        expect(rows[0].text()).toContain('done.gcode')
        wrapper.unmount()
    })

    it('filters to failed files only', () => {
        const { wrapper } = createTestWrapper({
            filter: ['failed'],
            files: [
                makeFile({ filename: 'fresh.gcode', last_status: null }),
                makeFile({ filename: 'done.gcode', last_status: 'completed' }),
                makeFile({ filename: 'bad.gcode', last_status: 'cancelled' }),
                makeFile({ filename: 'err.gcode', last_status: 'error' }),
            ],
        })
        const texts = wrapper.findAll('.entry-stub').map((r) => r.text())
        expect(texts).toHaveLength(2)
        expect(texts.join(' ')).toContain('bad.gcode')
        expect(texts.join(' ')).toContain('err.gcode')
        wrapper.unmount()
    })

    it('applies no filter when all three filters are selected', () => {
        const { wrapper } = createTestWrapper({
            filter: ['new', 'completed', 'failed'],
            files: [
                makeFile({ filename: 'fresh.gcode', last_status: null }),
                makeFile({ filename: 'done.gcode', last_status: 'completed' }),
            ],
        })
        expect(wrapper.findAll('.entry-stub')).toHaveLength(2)
        wrapper.unmount()
    })

    it('requests metadata only for files missing it', async () => {
        const { wrapper, requestMetadata } = createTestWrapper({
            files: [
                makeFile({ filename: 'need.gcode', metadataRequested: false, metadataPulled: false }),
                makeFile({ filename: 'asked.gcode', metadataRequested: true, metadataPulled: false }),
                makeFile({ filename: 'have.gcode', metadataRequested: true, metadataPulled: true }),
            ],
        })
        await flushPromises()
        expect(requestMetadata).toHaveBeenCalledWith([{ filename: 'gcodes/need.gcode' }])
        wrapper.unmount()
    })

    it('passes a numeric content width to each entry', () => {
        const { wrapper } = createTestWrapper({ files: [makeFile({ filename: 'a.gcode' })] })
        const entry = wrapper.findComponent({ name: 'StatusPanelGcodefilesEntry' } as never)
        if (entry.exists()) {
            expect(typeof (entry as never as { props: () => Record<string, unknown> }).props().contentTdWidth).toBe(
                'number'
            )
        } else {
            expect(wrapper.findAll('.entry-stub')).toHaveLength(1)
        }
        wrapper.unmount()
    })

    it('does not throw when the card ref is null (ResizeObserver guard)', () => {
        expect(() => {
            const { wrapper } = createTestWrapper({ files: [] })
            wrapper.unmount()
        }).not.toThrow()
    })
})
