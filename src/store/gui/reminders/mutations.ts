import { MutationTree } from 'vuex'
import { GuiRemindersState, GuiRemindersStateReminder } from '@/store/gui/reminders/types'
import { getDefaultState } from './index'

export const mutations: MutationTree<GuiRemindersState> = {
    reset(state: GuiRemindersState) {
        Object.assign(state, getDefaultState())
    },

    initStore(state: GuiRemindersState, payload: { value: GuiRemindersState['reminders'] }) {
        state.reminders = payload.value
    },

    store(state: GuiRemindersState, payload: { id: string; values: GuiRemindersStateReminder }) {
        state.reminders[payload.id] = payload.values
    },

    update(state: GuiRemindersState, payload: { id: string } & Partial<GuiRemindersStateReminder>) {
        if (payload.id in state.reminders) {
            const reminder = { ...state.reminders[payload.id] }
            Object.assign(reminder, payload)
            state.reminders[payload.id] = reminder
        }
    },

    delete(state: GuiRemindersState, payload: string) {
        if (payload in state.reminders) {
            delete state.reminders[payload]
        }
    },
}
