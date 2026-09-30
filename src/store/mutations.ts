import { MutationTree } from 'vuex'
import { ConfigJsonInstance, RootState } from './types'

export const mutations: MutationTree<RootState> = {
    setNaviDrawer(state: RootState, payload: RootState['naviDrawer']) {
        state.naviDrawer = payload
        localStorage.setItem('naviDrawer', String(payload))
    },

    setInstancesDB(state: RootState, payload: RootState['instancesDB']) {
        state.instancesDB = payload
    },

    setConfigInstances(state: RootState, payload: ConfigJsonInstance[]) {
        state.configInstances = payload
    },
}
