import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { ServerPowerState, ServerPowerStateDevice } from '@/store/server/power/types'

export const mutations: MutationTree<ServerPowerState> = {
    reset(state: ServerPowerState) {
        Object.assign(state, getDefaultState())
    },

    setDevices(state: ServerPowerState, payload: ServerPowerStateDevice[]) {
        state.devices = payload
    },

    setStatus(state: ServerPowerState, payload: { device: string; status: ServerPowerStateDevice['status'] }) {
        const devIdx = state.devices.findIndex((device) => device.device === payload.device)
        if (devIdx >= 0) state.devices[devIdx].status = payload.status
    },
}
