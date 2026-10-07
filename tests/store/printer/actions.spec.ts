import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
    emitAndWait: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
}))

import { actions } from '@/store/printer/actions'

function ctx(state = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state,
    }
}

describe('printer/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        vi.useRealTimers()
    })

    it('reset commits reset, tempHistory and loading cleanup', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenNthCalledWith(1, 'reset')
        expect(c.commit).toHaveBeenNthCalledWith(2, 'tempHistory/reset')
        expect(c.commit).toHaveBeenNthCalledWith(3, 'socket/clearLoadings', null, { root: true })
    })

    it('init resets, registers init modules and subscribes', () => {
        const c = ctx()
        actions.init(c as never)
        expect(c.dispatch).toHaveBeenCalledWith('reset')
        expect(c.dispatch).toHaveBeenCalledWith('socket/addInitModule', 'printer/info', { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('initSubscripts')
        expect(mocks.emit).toHaveBeenCalledWith('printer.info', {}, { action: 'printer/getInfo' })
        expect(mocks.emit).toHaveBeenCalledWith('server.gcode_store', {}, { action: 'server/getGcodeStore' })
    })

    it('getInfo commits klippy state to server and printer data', () => {
        const c = ctx()
        actions.getInfo(c as never, {
            state: 'ready',
            state_message: 'ok',
            app: 'Klipper',
            hostname: 'printer.local',
            software_version: 'v0.12',
            cpu_info: { cores: 4 },
        })
        expect(c.commit).toHaveBeenCalledWith(
            'server/setData',
            { klippy_state: 'ready', klippy_message: 'ok' },
            { root: true }
        )
        expect(c.commit).toHaveBeenCalledWith('setData', {
            app_name: 'Klipper',
            hostname: 'printer.local',
            software_version: 'v0.12',
            cpu_info: { cores: 4 },
        })
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'printer/info', { root: true })
    })

    it('getData unwraps status payloads and strips requestParams', () => {
        const c = ctx()
        actions.getData.call({ dispatch: c.dispatch } as never, c as never, {
            status: { toolhead: { homed_axes: 'xyz' }, requestParams: { id: 1 } },
        })
        expect(c.commit).toHaveBeenCalledWith('setData', { toolhead: { homed_axes: 'xyz' } })
    })

    it('getData forwards webhooks to the server module', () => {
        const c = ctx()
        const storeDispatch = vi.fn()
        actions.getData.call({ dispatch: storeDispatch } as never, c as never, {
            webhooks: { state: 'ready', state_message: 'ok' },
        })
        expect(storeDispatch).toHaveBeenCalledWith(
            'server/getData',
            { klippy_state: 'ready', klippy_message: 'ok' },
            { root: true }
        )
        expect(c.commit).toHaveBeenCalledWith('setData', {})
    })

    it('getData caches kinematics and axis limits for the gcode viewer', () => {
        const c = ctx()
        actions.getData.call({ dispatch: c.dispatch } as never, c as never, {
            configfile: { settings: { printer: { kinematics: 'corexy' } } },
            toolhead: { axis_maximum: [200, 200, 200], axis_minimum: [0, 0, 0] },
        })
        expect(c.dispatch).toHaveBeenCalledWith('gui/updateGcodeviewerCache', { kinematics: 'corexy' }, { root: true })
        expect(c.dispatch).toHaveBeenCalledWith(
            'gui/updateGcodeviewerCache',
            { axis_maximum: [200, 200, 200] },
            { root: true }
        )
        expect(c.dispatch).toHaveBeenCalledWith(
            'gui/updateGcodeviewerCache',
            { axis_minimum: [0, 0, 0] },
            { root: true }
        )
    })

    it('sendGcode logs the event and emits the script', () => {
        const c = ctx()
        actions.sendGcode(c as never, 'G28')
        expect(c.dispatch).toHaveBeenCalledWith('server/addEvent', { message: 'G28', type: 'command' }, { root: true })
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'G28' }, { loading: 'sendGcode' })
    })

    it('sendGcode routes M112 to emergency stop', () => {
        const c = ctx()
        actions.sendGcode(c as never, 'm112')
        expect(mocks.emit).toHaveBeenCalledWith('printer.emergency_stop', {}, { loading: 'sendGcode' })
        expect(mocks.emit).not.toHaveBeenCalledWith('printer.gcode.script', expect.anything(), expect.anything())
    })

    it('initGcodes queries gcode commands and commits them', async () => {
        const c = ctx()
        mocks.emitAndWait.mockResolvedValue({ status: { gcode: { commands: { G28: {} } } } })
        await actions.initGcodes(c as never)
        expect(mocks.emitAndWait).toHaveBeenCalledWith(
            'printer.objects.query',
            { objects: { gcode: ['commands'] } },
            {}
        )
        expect(c.commit).toHaveBeenCalledWith('setData', { gcode: { commands: { G28: {} } } })
    })

    it('initExtruderCanExtrude queries can_extrude for each extruder', async () => {
        const c = ctx({ extruder: {}, extruder1: {}, heater_bed: {} })
        mocks.emitAndWait.mockResolvedValue({ status: {} })
        await actions.initExtruderCanExtrude(c as never)
        expect(mocks.emitAndWait).toHaveBeenCalledWith(
            'printer.objects.query',
            { objects: { extruder: ['can_extrude'], extruder1: ['can_extrude'] } },
            {}
        )
        expect(c.dispatch).toHaveBeenCalledWith('getData', {})
    })

    it('initSubscripts subscribes to listed objects minus the blocklist', async () => {
        const c = ctx()
        vi.useFakeTimers()
        mocks.emitAndWait
            .mockResolvedValueOnce({ objects: ['extruder', 'menu something', 'toolhead'] })
            .mockResolvedValueOnce({ eventtime: 1 })
        await actions.initSubscripts(c as never)
        expect(mocks.emitAndWait).toHaveBeenNthCalledWith(1, 'printer.objects.list')
        expect(mocks.emitAndWait).toHaveBeenNthCalledWith(
            2,
            'printer.objects.subscribe',
            { objects: { extruder: null, toolhead: null } },
            {}
        )
        expect(c.dispatch).toHaveBeenCalledWith('getData', { eventtime: 1 })
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.temperature_store',
            { include_monitors: true },
            { action: 'printer/tempHistory/init' }
        )
        await vi.runAllTimersAsync()
        expect(c.dispatch).toHaveBeenCalledWith('initExtruderCanExtrude')
        vi.useRealTimers()
    })

    it('getEndstopStatus and removeBedMeshProfile commit through', () => {
        const c = ctx()
        actions.getEndstopStatus(c as never, { x: {} })
        expect(c.commit).toHaveBeenCalledWith('setEndstopStatus', { x: {} })
        actions.removeBedMeshProfile(c as never, 'default')
        expect(c.commit).toHaveBeenCalledWith('removeBedMeshProfile', 'default')
    })
})
