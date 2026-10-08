import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'

import HistoryListPanelExportCsv from '@/components/panels/History/HistoryListPanelExportCsv.vue'

const mocks = vi.hoisted(() => ({ selectedJobs: [], jobs: [] }) as { selectedJobs: never[]; jobs: never[] })

vi.mock('@/composables/useHistory', async () => {
    const { ref } = await import('vue')
    return { useHistory: () => ({ selectedJobs: ref(mocks.selectedJobs), jobs: ref(mocks.jobs) }) }
})

vi.mock('@/composables/useBase', async () => {
    const { ref } = await import('vue')
    return {
        useBase: () => ({ browserLocale: ref('en-US'), formatDateTime: (v: number) => `DT${v}` }),
    }
})

const vuetify = createVuetify()

function mountExport(props = {}) {
    return mount(HistoryListPanelExportCsv, {
        global: {
            plugins: [vuetify],
            mocks: { $t: (s: string) => s },
            stubs: {
                VTooltip: { template: '<div><slot /><slot name="activator" :props="{}" /></div>' },
                VBtn: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
                VIcon: { template: '<span><slot /></span>' },
            },
        },
        props: {
            headers: [{ value: 'slicer', visible: false }],
            tableFields: [{ value: 'print_duration', outputType: 'time' }],
            ...props,
        } as never,
    })
}

function job(overrides = {}) {
    return {
        filename: 'benchy.gcode',
        status: 'completed',
        metadata: { slicer: 'Orca', slicer_version: '2.2' },
        ...overrides,
    }
}

function stubDownload() {
    const link = document.createElement('a')
    const click = vi.spyOn(link, 'click').mockImplementation(() => {})
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
        if (tagName === 'a') return link
        return realCreateElement(tagName)
    }) as typeof document.createElement)
    return { link, click }
}

function hrefOf(link: HTMLAnchorElement) {
    return decodeURI(link.getAttribute('href') ?? '')
}

describe('panels/History/HistoryListPanelExportCsv', () => {
    beforeEach(() => {
        mocks.selectedJobs.length = 0
        mocks.jobs.length = 0
    })

    afterEach(() => {
        vi.restoreAllMocks()
        document.body.innerHTML = ''
    })

    it('exports all jobs with header row when nothing is selected', () => {
        mocks.jobs.push(job() as never)
        const wrapper = mountExport()
        const { link, click } = stubDownload()
        wrapper.find('button').trigger('click')
        expect(hrefOf(link)).toContain('filename,status,print_duration')
        expect(hrefOf(link)).toContain('benchy.gcode,completed')
        expect(link.getAttribute('download')).toBe('print_history.csv')
        expect(click).toHaveBeenCalledTimes(1)
        wrapper.unmount()
    })

    it('prefers selected jobs and appends the slicer column when visible', () => {
        mocks.jobs.push(job({ filename: 'other.gcode' }) as never)
        mocks.selectedJobs.push(job({ filename: 'chosen, special.gcode' }) as never)
        const wrapper = mountExport({ headers: [{ value: 'slicer', visible: true }] })
        const { link } = stubDownload()
        wrapper.find('button').trigger('click')
        expect(hrefOf(link)).toContain('"chosen, special.gcode"')
        expect(hrefOf(link)).not.toContain('other.gcode')
        expect(hrefOf(link)).toContain('Orca 2.2')
        wrapper.unmount()
    })

    it('exports header only when there are no jobs', () => {
        const wrapper = mountExport()
        const { link } = stubDownload()
        wrapper.find('button').trigger('click')
        expect(hrefOf(link).split('\n')).toHaveLength(1)
        wrapper.unmount()
    })

    it('formats date, time and grouped numbers via outputValue', () => {
        mocks.jobs.push(job({ print_duration: 61.5, start_time: 1700000000, filament_used: 1234.5 }) as never)
        const wrapper = mountExport({
            tableFields: [
                { value: 'start_time', outputType: 'date' },
                { value: 'print_duration', outputType: 'time' },
                { value: 'filament_used' },
                { value: 'missing_field' },
            ],
        })
        const { link } = stubDownload()
        wrapper.find('button').trigger('click')
        expect(hrefOf(link)).toContain('DT1700000000000')
        expect(hrefOf(link)).toContain('62')
        expect(hrefOf(link)).toContain('1234.5')
        wrapper.unmount()
    })
})
