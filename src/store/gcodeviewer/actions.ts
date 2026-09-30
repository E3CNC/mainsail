import { ActionContext, ActionTree } from 'vuex'
import { GcodeviewerState } from '@/store/gcodeviewer/types'
import { RootState } from '@/store/types'

export const actions: ActionTree<GcodeviewerState, RootState> = {
    reset({ commit }: ActionContext<GcodeviewerState, RootState>) {
        commit('reset')
    },

    setViewerBackup({ commit }: ActionContext<GcodeviewerState, RootState>, backup: GcodeviewerState['viewerBackup']) {
        commit('setViewerBackup', backup)
    },

    setCanvasBackup({ commit }: ActionContext<GcodeviewerState, RootState>, backup: GcodeviewerState['canvasBackup']) {
        commit('setCanvasBackup', backup)
    },

    setLoadedFileBackup(
        { commit }: ActionContext<GcodeviewerState, RootState>,
        backup: GcodeviewerState['loadedFileBackup']
    ) {
        commit('setLoadedFileBackup', backup)
    },
}
