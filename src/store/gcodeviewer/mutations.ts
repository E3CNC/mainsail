import { getDefaultState } from './index'
import { MutationTree } from 'vuex'
import { GcodeviewerState } from '@/store/gcodeviewer/types'
import { markRaw } from 'vue'

export const mutations: MutationTree<GcodeviewerState> = {
    reset(state: GcodeviewerState) {
        Object.assign(state, getDefaultState())
    },

    setViewerBackup(state: GcodeviewerState, backup: GcodeviewerState['viewerBackup']) {
        // markRaw guards non-objects internally, so null passes through as before
        state.viewerBackup =
            backup === null ? null : markRaw(backup) /* viewer object is large and quite slow to proxy */
    },

    setCanvasBackup(state: GcodeviewerState, backup: GcodeviewerState['canvasBackup']) {
        state.canvasBackup = backup
    },

    setLoadedFileBackup(state: GcodeviewerState, backup: GcodeviewerState['loadedFileBackup']) {
        state.loadedFileBackup = backup
    },
}
