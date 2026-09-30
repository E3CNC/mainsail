import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { GuiConsoleState, GuiConsoleStateFilter } from '@/store/gui/console/types'

export const mutations: MutationTree<GuiConsoleState> = {
    reset(state: GuiConsoleState) {
        Object.assign(state, getDefaultState())
    },

    clear(state: GuiConsoleState, payload: { cleared_since: number }) {
        state.cleared_since = payload.cleared_since
    },

    filterStore(state: GuiConsoleState, payload: { id: string; values: GuiConsoleStateFilter }) {
        state.consolefilters[payload.id] = payload.values
    },

    filterUpdate(state: GuiConsoleState, payload: { id: string; values: Partial<GuiConsoleStateFilter> }) {
        if (!(payload.id in state.consolefilters)) return

        const preset = { ...state.consolefilters[payload.id] }
        Object.assign(preset, payload.values)

        state.consolefilters[payload.id] = preset
    },

    filterDelete(state: GuiConsoleState, payload: string) {
        if (!(payload in state.consolefilters)) return

        delete state.consolefilters[payload]
    },
}
