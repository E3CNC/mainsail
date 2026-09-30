import { ActionContext, ActionTree } from 'vuex'
import { getSocket } from '@/store/runtime'
import { ServerPowerState, ServerPowerStateDevice } from '@/store/server/power/types'
import { RootState } from '@/store/types'

interface PowerDevicesPayload {
    error?: unknown
    devices: ServerPowerStateDevice[]
}

interface PowerStatusPayload {
    error?: unknown
    device: string
    status: ServerPowerStateDevice['status']
}

interface PowerTogglePayload {
    requestParams?: unknown
    [device: string]: unknown
}

export const actions: ActionTree<ServerPowerState, RootState> = {
    reset({ commit }: ActionContext<ServerPowerState, RootState>) {
        commit('reset')
    },

    init() {
        getSocket().emit('machine.device_power.devices', {}, { action: 'server/power/getDevices' })
    },

    async getDevices({ commit, dispatch }: ActionContext<ServerPowerState, RootState>, payload: PowerDevicesPayload) {
        if (!payload.error) await commit('setDevices', payload.devices)

        await dispatch('socket/removeInitModule', 'server/power/init', { root: true })
    },

    getStatus({ commit }: ActionContext<ServerPowerState, RootState>, payload: PowerStatusPayload) {
        if (!payload.error) commit('setStatus', payload)
    },

    responseToggle({ commit }: ActionContext<ServerPowerState, RootState>, payload: PowerTogglePayload) {
        if ('requestParams' in payload) delete payload.requestParams

        for (const [key, value] of Object.entries(payload)) {
            commit('setStatus', { device: key, status: value })
        }
    },
}
