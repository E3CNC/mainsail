import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

vi.mock('vuetify', () => ({
    useDisplay: () => ({
        mobile: { value: false },
        smAndUp: { value: true },
        lgAndUp: { value: true },
        xl: { value: false },
    }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { getters: Record<string, any>; state: Record<string, any> } = {
    getters: {},
    state: {},
}

vi.mock('vuex', () => ({
    useStore: () => store,
}))

import { useBase } from '@/composables/useBase'

function defaultState() {
    return {
        socket: {
            port: 7125,
            hostname: 'printer.local',
            isConnected: true,
            initializationList: [],
            loadings: [],
        },
        server: {
            klippy_connected: true,
            klippy_state: 'ready',
            components: ['history'],
            registered_directories: ['gcodes', 'config'],
            config: { config: {} },
        },
        printer: {
            app_name: 'Klipper',
            print_stats: { state: 'standby' },
        },
        gui: {
            uiSettings: {},
            general: { timeFormat: '24hours', dateFormat: 'iso' },
        },
        instancesDB: 'moonraker',
    }
}

describe('useBase', () => {
    beforeEach(() => {
        store.getters = {
            'socket/getUrl': 'http://printer.local',
            'socket/getHostUrl': 'http://printer.local',
            'server/power/getDevices': [],
            'gui/getHours12Format': false,
        }
        store.state = reactive(defaultState())
    })

    it('klipperState is disconnected without klippy, else the klippy state', () => {
        expect(useBase().klipperState.value).toBe('ready')
        store.state.server.klippy_connected = false
        expect(useBase().klipperState.value).toBe('disconnected')
    })

    it('printer_state prefers print_stats, falls back to idle_timeout', () => {
        expect(useBase().printer_state.value).toBe('standby')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.state.printer = { idle_timeout: { state: 'Idle' } } as any
        expect(useBase().printer_state.value).toBe('Idle')
    })

    it('printer_state reports printing when timelapse pauses a paused print', () => {
        store.state.printer.print_stats = { state: 'paused' }
        store.state.printer['gcode_macro TIMELAPSE_TAKE_FRAME'] = { is_paused: true }
        expect(useBase().printer_state.value).toBe('printing')
    })

    it('printerIsPrinting covers printing and paused; Only covers printing', () => {
        store.state.printer.print_stats = { state: 'printing' }
        expect(useBase().printerIsPrinting.value).toBe(true)
        expect(useBase().printerIsPrintingOnly.value).toBe(true)
        store.state.printer.print_stats = { state: 'paused' }
        expect(useBase().printerIsPrinting.value).toBe(true)
        expect(useBase().printerIsPrintingOnly.value).toBe(false)
        store.state.printer.print_stats = { state: 'standby' }
        expect(useBase().printerIsPrinting.value).toBe(false)
    })

    it('printerIsPrinting is false when klipper is not ready', () => {
        store.state.printer.print_stats = { state: 'printing' }
        store.state.server.klippy_connected = false
        expect(useBase().printerIsPrinting.value).toBe(false)
    })

    it('printerPowerDevice prefers the setting, then a printer-named device', () => {
        expect(useBase().printerPowerDevice.value).toBe('printer')
        store.getters['server/power/getDevices'] = [{ device: 'Chamber', status: 'on' }]
        expect(useBase().printerPowerDevice.value).toBe('printer')
        store.getters['server/power/getDevices'] = [{ device: 'Printer_PSU', status: 'on' }]
        expect(useBase().printerPowerDevice.value).toBe('printer')
        store.getters['server/power/getDevices'] = [{ device: 'printer', status: 'on' }]
        expect(useBase().printerPowerDevice.value).toBe('printer')
        store.state.gui.uiSettings.powerDeviceName = 'Chamber'
        expect(useBase().printerPowerDevice.value).toBe('Chamber')
    })

    it('isPrinterPowerOff is true only when the device is off and klippy is down', () => {
        expect(useBase().isPrinterPowerOff.value).toBe(false)
        store.getters['server/power/getDevices'] = [{ device: 'printer', status: 'off' }]
        store.state.server.klippy_connected = false
        expect(useBase().isPrinterPowerOff.value).toBe(true)
        store.state.server.klippy_connected = true
        expect(useBase().isPrinterPowerOff.value).toBe(false)
        store.getters['server/power/getDevices'] = [{ device: 'printer', status: 'on' }]
        store.state.server.klippy_connected = false
        expect(useBase().isPrinterPowerOff.value).toBe(false)
    })

    it('existGcodesRootDirectory checks registered directories', () => {
        expect(useBase().existGcodesRootDirectory.value).toBe(true)
        store.state.server.registered_directories = ['config']
        expect(useBase().existGcodesRootDirectory.value).toBe(false)
    })

    it('spoolManagerUrl rewrites loopback hosts to the socket hostname', () => {
        expect(useBase().spoolManagerUrl.value).toBeUndefined()
        store.state.server.config.config = { spoolman: { server: 'http://localhost:7912' } }
        expect(useBase().spoolManagerUrl.value).toBe('http://printer.local:7912/')
        store.state.server.config.config = { spoolman: { server: 'http://spoolman.lan:7912' } }
        expect(useBase().spoolManagerUrl.value).toBe('http://spoolman.lan:7912/')
        store.state.server.config.config = { spoolman: { server: 'not a url' } }
        expect(useBase().spoolManagerUrl.value).toBeUndefined()
    })

    it('formatTimeOptions follows the time format setting', () => {
        expect(useBase().formatTimeOptions.value).toEqual({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        store.state.gui.general.timeFormat = '12hours'
        expect(useBase().formatTimeOptions.value).toEqual({ hour: '2-digit', minute: '2-digit', hourCycle: 'h12' })
        store.state.gui.general.timeFormat = 'locale'
        expect(useBase().formatTimeOptions.value).toEqual({ timeStyle: 'short' })
    })

    it('formatDate handles iso and custom formats deterministically', () => {
        const b = useBase()
        const ts = Date.UTC(2026, 9, 7, 12, 0, 0)
        expect(b.formatDate(ts, 'iso')).toBe('2026-10-07')
        expect(b.formatDate(ts, 'dd/mm/yyyy')).toBe('07/10/2026')
        expect(b.formatDate(ts, 'd-m-yy')).toBe('7-10-26')
    })

    it('exposes socket basics and viewport from the mocked display', () => {
        const b = useBase()
        expect(b.hostPort.value).toBe(7125)
        expect(b.instancesDB.value).toBe('moonraker')
        expect(b.socketIsConnected.value).toBe(true)
        expect(b.guiIsReady.value).toBe(true)
        expect(b.isMobile.value).toBe(false)
        expect(b.isDesktop.value).toBe(true)
        expect(b.viewport.value).toBe('desktop')
        expect(b.klipperAppName.value).toBe('Klipper')
    })
})
