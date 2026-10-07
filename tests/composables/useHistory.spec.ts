import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { state: Record<string, any> } = { state: {} }

vi.mock('vuex', () => ({
    useStore: () => store,
}))

import { useHistory } from '@/composables/useHistory'

function job(filename: string, status = 'completed') {
    return { filename, status }
}

function defaultState() {
    return {
        gui: {
            view: {
                history: {
                    hidePrintStatus: [],
                    selectedJobs: [],
                },
            },
        },
        server: {
            history: {
                jobs: [job('benchy.gcode'), job('notes.txt'), job('failed.gcode', 'error'), job('PART.GCODE')],
            },
            config: { config: {} },
        },
    }
}

describe('useHistory', () => {
    beforeEach(() => {
        store.state = reactive(defaultState())
    })

    it('allJobs returns every job; jobs keeps only gcode files', () => {
        const h = useHistory()
        expect(h.allJobs.value).toHaveLength(4)
        expect(h.jobs.value.map((j: { filename: string }) => j.filename)).toEqual([
            'benchy.gcode',
            'failed.gcode',
            'PART.GCODE',
        ])
    })

    it('jobs excludes hidden print statuses', () => {
        store.state.gui.view.history.hidePrintStatus = ['error']
        const filenames = useHistory().jobs.value.map((j: { filename: string }) => j.filename)
        expect(filenames).toEqual(['benchy.gcode', 'PART.GCODE'])
    })

    it('selectedJobs keeps only entries of type job', () => {
        store.state.gui.view.history.selectedJobs = [
            { type: 'job', filename: 'benchy.gcode' },
            { type: 'maintenance', filename: 'clean.gcode' },
        ]
        const selected = useHistory().selectedJobs.value
        expect(selected).toHaveLength(1)
        expect(selected[0].filename).toBe('benchy.gcode')
    })

    it('moonrakerHistoryFields collects sensor history fields', () => {
        store.state.server.config = {
            config: {
                'sensor my_temp': {
                    history_field_temp: { desc: 'Temp', units: 'C', parameter: 'temperature' },
                    other_option: true,
                },
                extruder: {},
            },
        }
        expect(useHistory().moonrakerHistoryFields.value).toEqual([
            {
                desc: 'Temp',
                unit: 'C',
                provider: 'sensor my_temp',
                parameter: 'temperature',
                name: 'history_field_temp',
            },
        ])
    })

    it('moonrakerHistoryFields is empty without sensors', () => {
        expect(useHistory().moonrakerHistoryFields.value).toEqual([])
    })
})
