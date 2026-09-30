import { ActionContext, ActionTree } from 'vuex'
import { getSocket } from '@/store/runtime'
import { PrinterState } from '@/store/printer/types'
import { RootState } from '@/store/types'
import { EndstopItem } from '@/store/printer/types'

type EndstopStatusEntry = Partial<EndstopItem> & Record<string, unknown>

interface PrinterInfoPayload {
    state?: string
    state_message?: string
    app?: string
    hostname?: string
    software_version?: string
    cpu_info?: Record<string, unknown>
    [key: string]: unknown
}

interface PrinterStatusPayload {
    status?: Record<string, unknown>
    requestParams?: unknown
    webhooks?: { state: string; state_message: string }
    configfile?: { settings?: { printer?: { kinematics?: string } } }
    toolhead?: { axis_maximum?: number[]; axis_minimum?: number[] }
    [key: string]: unknown
}

export const actions: ActionTree<PrinterState, RootState> = {
    reset({ commit }: ActionContext<PrinterState, RootState>) {
        commit('reset')
        commit('tempHistory/reset')
        commit('socket/clearLoadings', null, { root: true })
    },

    init({ dispatch }: ActionContext<PrinterState, RootState>) {
        window.console.debug('init printer')
        dispatch('reset')

        dispatch('socket/addInitModule', 'printer/info', { root: true })
        dispatch('socket/addInitModule', 'printer/initSubscripts', { root: true })
        dispatch('socket/addInitModule', 'printer/initTempHistory', { root: true })
        dispatch('socket/addInitModule', 'server/gcode_store', { root: true })

        getSocket().emit('printer.info', {}, { action: 'printer/getInfo' })
        getSocket().emit('server.gcode_store', {}, { action: 'server/getGcodeStore' })

        dispatch('initSubscripts')
    },

    getInfo({ commit, dispatch }: ActionContext<PrinterState, RootState>, payload: PrinterInfoPayload) {
        commit(
            'server/setData',
            {
                klippy_state: payload.state,
                klippy_message: payload.state_message,
            },
            { root: true }
        )

        commit('setData', {
            app_name: payload.app ?? null,
            hostname: payload.hostname,
            software_version: payload.software_version,
            cpu_info: payload.cpu_info,
        })

        dispatch('socket/removeInitModule', 'printer/info', { root: true })
    },

    async initSubscripts({ dispatch }: ActionContext<PrinterState, RootState>) {
        const payload = await getSocket().emitAndWait('printer.objects.list')

        let subscripts = {}
        const blocklist = ['menu']

        payload.objects.forEach((key: string) => {
            const nameSplit = key.split(' ')

            if (!blocklist.includes(nameSplit[0])) subscripts = { ...subscripts, [key]: null }
        })

        if (Object.keys(subscripts).length > 0) {
            const result = await getSocket().emitAndWait('printer.objects.subscribe', { objects: subscripts }, {})

            dispatch('getData', result)

            setTimeout(() => {
                dispatch('initExtruderCanExtrude')
            }, 200)
        }

        getSocket().emit('server.temperature_store', { include_monitors: true }, { action: 'printer/tempHistory/init' })

        dispatch('socket/removeInitModule', 'printer/initSubscripts', { root: true })
    },

    getData({ commit, dispatch }: ActionContext<PrinterState, RootState>, payload: PrinterStatusPayload) {
        const data: PrinterStatusPayload = 'status' in payload ? (payload.status as PrinterStatusPayload) : payload
        if ('requestParams' in data) delete data.requestParams

        if ('webhooks' in data && data.webhooks) {
            this.dispatch(
                'server/getData',
                { klippy_state: data.webhooks.state, klippy_message: data.webhooks.state_message },
                { root: true }
            )
            delete data.webhooks
        }

        if (data.configfile?.settings?.printer?.kinematics) {
            dispatch(
                'gui/updateGcodeviewerCache',
                {
                    kinematics: data.configfile?.settings?.printer?.kinematics,
                },
                { root: true }
            )
        }

        if (data.toolhead?.axis_maximum) {
            dispatch(
                'gui/updateGcodeviewerCache',
                {
                    axis_maximum: data.toolhead?.axis_maximum,
                },
                { root: true }
            )
        }

        if (data.toolhead?.axis_minimum) {
            dispatch(
                'gui/updateGcodeviewerCache',
                {
                    axis_minimum: data.toolhead?.axis_minimum,
                },
                { root: true }
            )
        }

        commit('setData', data)
    },

    async initGcodes({ commit }: ActionContext<PrinterState, RootState>) {
        const gcodes = await getSocket().emitAndWait('printer.objects.query', { objects: { gcode: ['commands'] } }, {})

        commit('setData', gcodes.status)
    },

    async initExtruderCanExtrude({ dispatch, state }: ActionContext<PrinterState, RootState>) {
        const extruderList: string[] = Object.keys(state).filter((name) => name.startsWith('extruder'))
        const reInitList: { [key: string]: string[] } = {}

        extruderList.forEach((extruderName) => {
            reInitList[extruderName] = ['can_extrude']
        })

        const result = await getSocket().emitAndWait('printer.objects.query', { objects: reInitList }, {})
        dispatch('getData', result.status)
    },

    getEndstopStatus({ commit }: ActionContext<PrinterState, RootState>, payload: Record<string, EndstopStatusEntry>) {
        commit('setEndstopStatus', payload)
    },

    removeBedMeshProfile({ commit }: ActionContext<PrinterState, RootState>, payload: string) {
        commit('removeBedMeshProfile', payload)
    },

    sendGcode({ dispatch }: ActionContext<PrinterState, RootState>, payload: string) {
        dispatch('server/addEvent', { message: payload, type: 'command' }, { root: true })

        if (payload.toLowerCase().trim() === 'm112') {
            getSocket().emit('printer.emergency_stop', {}, { loading: 'sendGcode' })
            return
        }

        getSocket().emit('printer.gcode.script', { script: payload }, { loading: 'sendGcode' })
    },
}
