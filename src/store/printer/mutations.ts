import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { EndstopItem, PrinterState } from '@/store/printer/types'

type EndstopStatusEntry = Partial<EndstopItem> & Record<string, unknown>

export const mutations: MutationTree<PrinterState> = {
    reset(state: PrinterState) {
        const defaultState = getDefaultState()

        for (const key of Object.keys(state)) {
            if (!(key in defaultState) && key !== 'tempHistory') {
                delete state[key]
            }
        }

        for (const [key, value] of Object.entries(defaultState)) {
            state[key] = value
        }
    },

    setData(state: PrinterState, payload: Record<string, unknown>) {
        Object.keys(payload).forEach((key) => {
            const value = payload[key]

            if (typeof value !== 'object' || value === null || !(key in state)) {
                state[key] = value
                return
            }

            if (typeof value === 'object') {
                const objectValue = value as Record<string, unknown>
                Object.keys(objectValue).forEach((subkey) => {
                    state[key][subkey] = objectValue[subkey]
                })
            }
        })
    },

    clearCurrentFile(state: PrinterState) {
        state.current_file = {}
    },

    setEndstopStatus(state: PrinterState, payload: Record<string, EndstopStatusEntry>) {
        delete payload.requestParams

        state.endstops = payload
    },

    removeBedMeshProfile(state: PrinterState, payload: string) {
        if (state.bed_mesh?.profiles && payload in state.bed_mesh.profiles) {
            delete state.bed_mesh.profiles[payload]
            if (state.bed_mesh.profile_name === payload) {
                state.bed_mesh.profile_name = ''
            }
        }
    },
}
