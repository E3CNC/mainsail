import { MutationTree } from 'vuex'
import { GuiMaintenanceState, GuiMaintenanceStateEntry } from '@/store/gui/maintenance/types'
import { getDefaultState } from './index'

export const mutations: MutationTree<GuiMaintenanceState> = {
    reset(state: GuiMaintenanceState) {
        Object.assign(state, getDefaultState())
    },

    initStore(state: GuiMaintenanceState, payload: Record<string, GuiMaintenanceStateEntry>) {
        state.entries = payload
    },

    store(state: GuiMaintenanceState, payload: { id: string; values: GuiMaintenanceStateEntry }) {
        state.entries[payload.id] = payload.values
    },

    update(state: GuiMaintenanceState, payload: { id: string; entry: Partial<GuiMaintenanceStateEntry> }) {
        if (!(payload.id in state.entries)) return

        const entry = { ...state.entries[payload.id] }
        Object.assign(entry, payload.entry)
        state.entries[payload.id] = entry
    },

    delete(state: GuiMaintenanceState, payload: string) {
        if (payload in state.entries) {
            delete state.entries[payload]
        }
    },
}
