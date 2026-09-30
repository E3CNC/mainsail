import { ActionContext, ActionTree } from 'vuex'
import { getSocket, $toast } from '@/store/runtime'
import { ServerTimelapseState, ServerTimelapseSettingsState } from '@/store/server/timelapse/types'
import { RootState } from '@/store/types'

interface TimelapseSettingsPayload extends Partial<ServerTimelapseSettingsState> {
    requestParams?: unknown
}

interface TimelapseLastFramePayload {
    framecount: number
    lastframefile: string
}

interface TimelapseEventPayload {
    action: string
    frame: string
    framefile: string
    status: string
    msg: string
    progress?: number
    filename?: string
}

interface TimelapseCamSettingsPayload {
    oldName: string
    newName: string
}

export const actions: ActionTree<ServerTimelapseState, RootState> = {
    reset({ commit }: ActionContext<ServerTimelapseState, RootState>) {
        commit('reset')
    },

    init() {
        getSocket().emit('machine.timelapse.get_settings', {}, { action: 'server/timelapse/initSettings' })
        getSocket().emit('machine.timelapse.lastframeinfo', {}, { action: 'server/timelapse/initLastFrameinfo' })
    },

    async initSettings(
        { commit, dispatch }: ActionContext<ServerTimelapseState, RootState>,
        payload: TimelapseSettingsPayload
    ) {
        if ('requestParams' in payload) delete payload.requestParams

        await commit('setSettings', payload)
        await dispatch('socket/removeInitModule', 'server/timelapse/init', { root: true })
    },

    initLastFrameinfo({ commit }: ActionContext<ServerTimelapseState, RootState>, payload: TimelapseLastFramePayload) {
        commit('setLastFrame', {
            count: payload.framecount,
            file: payload.lastframefile,
        })
    },

    getEvent({ commit }: ActionContext<ServerTimelapseState, RootState>, payload: TimelapseEventPayload) {
        switch (payload.action) {
            case 'newframe':
                commit('setLastFrame', {
                    count: parseInt(payload.frame),
                    file: payload.framefile,
                })
                break

            case 'render':
                if (payload.status === 'error') {
                    $toast.error(payload.msg)
                    commit('resetSnackbar')
                } else commit('setRenderStatus', payload)
                break

            default:
                window.console.log('unknown timelapse event', payload)
        }
    },

    saveSetting(
        _context: ActionContext<ServerTimelapseState, RootState>,
        payload: Partial<ServerTimelapseSettingsState>
    ) {
        getSocket().emit('machine.timelapse.post_settings', payload, { action: 'server/timelapse/initSettings' })
    },

    updateCamSettings(
        { dispatch, state }: ActionContext<ServerTimelapseState, RootState>,
        payload: TimelapseCamSettingsPayload
    ) {
        // check if the changed webcam is the timelapse webcam, if not stop here
        if (state.settings.camera !== payload.oldName) return

        // send the new webcam name; if it is the same name, it will only update the settings
        dispatch('saveSetting', { camera: payload.newName })
    },

    resetSnackbar({ commit }: ActionContext<ServerTimelapseState, RootState>) {
        commit('resetSnackbar')
    },
}
