import { GetterTree } from 'vuex'
import { GuiRemoteprintersState, GuiRemoteprintersStatePrinter } from '@/store/gui/remoteprinters/types'
import { caseInsensitiveSort } from '@/plugins/helpers'
import { RootState } from '@/store/types'
import type { FarmPrinterStateSocket } from '@/store/farm/printer/types'

interface RemoteprintersLocalGetters {
    [key: string]: unknown
}

interface RemoteprintersRootGetters {
    'farm/getPrinterSocketState': (id: string) => FarmPrinterStateSocket
    [key: string]: unknown
}

export const getters: GetterTree<GuiRemoteprintersState, RootState> = {
    getRemoteprinters: (
        state: GuiRemoteprintersState,
        getters: RemoteprintersLocalGetters,
        rootState: RootState,
        rootGetters: RemoteprintersRootGetters
    ) => {
        const printers: GuiRemoteprintersStatePrinter[] = []

        Object.keys(state.printers).forEach((id: string) => {
            const socket = { ...rootGetters['farm/getPrinterSocketState'](id) }

            printers.push({ ...state.printers[id], id, socket })
        })

        return caseInsensitiveSort(printers, 'hostname')
    },
}
