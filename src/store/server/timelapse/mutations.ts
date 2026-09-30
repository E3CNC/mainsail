import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { ServerTimelapseState, ServerTimelapseSettingsState } from '@/store/server/timelapse/types'

export const mutations: MutationTree<ServerTimelapseState> = {
    reset(state: ServerTimelapseState) {
        Object.assign(state, getDefaultState())
    },

    setSettings(state: ServerTimelapseState, payload: Partial<ServerTimelapseSettingsState>) {
        Object.keys(payload).forEach((key) => {
            if (key in state.settings && state.settings[key] !== payload[key]) state.settings[key] = payload[key]
        })
    },

    setLastFrame(state: ServerTimelapseState, payload: ServerTimelapseState['lastFrame']) {
        state.lastFrame.count = payload.count
        state.lastFrame.file = payload.file
    },

    setRenderStatus(state: ServerTimelapseState, payload: { status: string; progress?: number; filename?: string }) {
        state.rendering = {
            status: payload.status,
            progress: payload.progress ?? 0,
            filename: payload.filename ?? '',
        }
    },

    resetSnackbar(state: ServerTimelapseState) {
        state.rendering = {
            status: '',
            progress: 0,
            filename: '',
        }
    },
}
