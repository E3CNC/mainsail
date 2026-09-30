import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { ServerSensorState, ServerSensorStateSensor } from '@/store/server/sensor/types'

export const mutations: MutationTree<ServerSensorState> = {
    reset(state: ServerSensorState) {
        Object.assign(state, getDefaultState())
    },

    setSensors(state: ServerSensorState, payload: ServerSensorState['sensors']) {
        state.sensors = payload
    },

    updateSensor(state: ServerSensorState, payload: { key: string; value: ServerSensorStateSensor['values'] }) {
        if (!(payload.key in state.sensors)) return

        state.sensors[payload.key].values = payload.value
    },
}
