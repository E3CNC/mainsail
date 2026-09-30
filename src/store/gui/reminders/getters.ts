import { GetterTree } from 'vuex'
import { GuiRemindersState, GuiRemindersStateReminder } from '@/store/gui/reminders/types'
import { RootState } from '@/store/types'

interface RemindersLocalGetters {
    getReminders: GuiRemindersStateReminder[]
    [key: string]: unknown
}

export const getters: GetterTree<GuiRemindersState, RootState> = {
    getReminders: (state: GuiRemindersState) => {
        const reminders: GuiRemindersStateReminder[] = []

        Object.keys(state.reminders).forEach((id: string) => {
            reminders.push({ ...state.reminders[id], id })
        })

        return reminders
    },

    getReminder: (state: GuiRemindersState, getters: RemindersLocalGetters) => (id: string) => {
        const reminders = getters['getReminders'] ?? []

        return reminders.find((reminder: GuiRemindersStateReminder) => reminder.id === id)
    },

    getOverdueReminders: (state: GuiRemindersState, getters: RemindersLocalGetters, rootState: RootState) => {
        const currentTotalPrintTime = rootState.server?.history?.job_totals?.total_print_time ?? 0
        const reminders: GuiRemindersStateReminder[] = getters['getReminders'] ?? []
        return reminders.filter(
            (reminder) => reminder.time_delta - (currentTotalPrintTime ?? 0 - reminder.start_total_print_time) < 0
        )
    },
}
