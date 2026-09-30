import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { GuiRemoteprintersState, GuiRemoteprintersStatePrinter } from '@/store/gui/remoteprinters/types'

export const mutations: MutationTree<GuiRemoteprintersState> = {
    reset(state: GuiRemoteprintersState) {
        Object.assign(state, getDefaultState())
    },

    store(state: GuiRemoteprintersState, payload: { id: string; values: GuiRemoteprintersStatePrinter }) {
        state.printers[payload.id] = payload.values
    },

    update(state: GuiRemoteprintersState, payload: { id: string; values: Partial<GuiRemoteprintersStatePrinter> }) {
        if (payload.id in state.printers) {
            const preset = { ...state.printers[payload.id] }
            Object.assign(preset, payload.values)

            state.printers[payload.id] = preset
        }
    },

    delete(state: GuiRemoteprintersState, payload: string) {
        if (payload in state.printers) {
            delete state.printers[payload]
        }
    },
}
