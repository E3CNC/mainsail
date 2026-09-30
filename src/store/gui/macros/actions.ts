import { ActionContext, ActionTree } from 'vuex'
import { RootState } from '@/store/types'
import type { GuiStateDashboardLayoutKey, GuiStateLayoutoption } from '@/store/gui/types'
import { v4 as uuidv4 } from 'uuid'
import { GuiMacrosState, GuiMacrosStateMacrogroup, GuiMacrosStateMacrogroupMacro } from '@/store/gui/macros/types'
import { getSocket } from '@/store/runtime'

interface MacrogroupUpdatePayload {
    id: string
    macro: string
    option?: keyof GuiMacrosStateMacrogroupMacro
    value?: GuiMacrosStateMacrogroupMacro[keyof GuiMacrosStateMacrogroupMacro]
    skipUpload?: boolean
    values?: Partial<GuiMacrosStateMacrogroup>
}

export const actions: ActionTree<GuiMacrosState, RootState> = {
    reset({ commit }: ActionContext<GuiMacrosState, RootState>) {
        commit('reset')
    },

    saveSetting({ dispatch }: ActionContext<GuiMacrosState, RootState>, payload: { name: string; value: unknown }) {
        dispatch(
            'gui/saveSetting',
            {
                name: 'macros.' + payload.name,
                value: payload.value,
            },
            { root: true }
        )
    },

    groupUpload({ state }: ActionContext<GuiMacrosState, RootState>, id: string) {
        getSocket().emit('server.database.post_item', {
            namespace: 'mainsail',
            key: 'macros.macrogroups.' + id,
            value: state.macrogroups[id],
        })
    },

    async groupStore(
        { commit, dispatch }: ActionContext<GuiMacrosState, RootState>,
        payload: { values: GuiMacrosStateMacrogroup }
    ) {
        const id = uuidv4()

        await commit('groupStore', { id, values: payload.values })
        await dispatch('groupUpload', id)

        return id
    },

    groupUpdate(
        { commit, dispatch }: ActionContext<GuiMacrosState, RootState>,
        payload: { id: string; values?: Partial<GuiMacrosStateMacrogroup> }
    ) {
        commit('groupUpdate', payload)
        dispatch('groupUpload', payload.id)
    },

    addMacroToMacrogroup(
        { commit, dispatch }: ActionContext<GuiMacrosState, RootState>,
        payload: { id: string; macro: string }
    ) {
        commit('addMacroToMacrogroup', payload)
        dispatch('groupUpload', payload.id)
    },

    updateMacroFromMacrogroup(
        { commit, dispatch }: ActionContext<GuiMacrosState, RootState>,
        payload: MacrogroupUpdatePayload
    ) {
        commit('updateMacroFromMacrogroup', payload)

        if (!payload.skipUpload) dispatch('groupUpload', payload.id)
    },

    removeMacroFromMacrogroup(
        { commit, dispatch }: ActionContext<GuiMacrosState, RootState>,
        payload: { id: string; macro: string }
    ) {
        commit('removeMacroFromMacrogroup', payload)
        dispatch('groupUpload', payload.id)
    },

    groupDelete({ commit, dispatch, rootState }: ActionContext<GuiMacrosState, RootState>, id: string) {
        commit('groupDelete', id)
        getSocket().emit('server.database.delete_item', { namespace: 'mainsail', key: 'macros.macrogroups.' + id })

        const layouts: GuiStateDashboardLayoutKey[] = [
            'mobileLayout',
            'tabletLayout1',
            'tabletLayout2',
            'desktopLayout1',
            'desktopLayout2',
            'widescreenLayout1',
            'widescreenLayout2',
            'widescreenLayout3',
        ]

        layouts.forEach((layoutname) => {
            const dashboard = rootState.gui?.dashboard
            if (!dashboard) return

            const layoutArray = [...(dashboard[layoutname] as GuiStateLayoutoption[])]
            const index = layoutArray.findIndex((layoutPos) => layoutPos.name === 'macrogroup_' + id)
            if (index === -1) return

            commit('gui/deleteFromDashboardLayout', { layoutname, index }, { root: true })
            dispatch(
                'gui/updateSettings',
                {
                    keyName: 'dashboard.' + layoutname,
                    newVal: dashboard[layoutname],
                },
                { root: true }
            )
        })
    },
}
