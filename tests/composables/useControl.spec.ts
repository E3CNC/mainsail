import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { dispatch: ReturnType<typeof vi.fn>; getters: Record<string, any>; state: Record<string, any> } = {
    dispatch: vi.fn(),
    getters: {},
    state: {},
}

vi.mock('vuex', () => ({
    useStore: () => store,
}))

import { useControl } from '@/composables/useControl'

function defaultState() {
    return {
        printer: {
            gcode_move: { absolute_coordinates: true },
            toolhead: { homed_axes: 'xyz' },
            quad_gantry_level: { applied: true },
            gcode: { commands: {} },
        },
        gui: {
            control: {
                enableXYHoming: false,
                feedrateXY: 100,
                feedrateZ: 10,
            },
        },
    }
}

function defaultGetters() {
    return {
        'printer/existsQGL': false,
        'printer/existsDeltaCalibrate': false,
        'printer/existsFirmwareRetraction': false,
        'printer/existsZTilt': false,
        'printer/getMacros': [],
        'gui/getDefaultControlActionButton': 'm84',
    }
}

describe('useControl', () => {
    beforeEach(() => {
        store.dispatch.mockReset()
        mocks.emit.mockReset()
        store.getters = defaultGetters()
        store.state = reactive(defaultState())
    })

    it('exposes motion defaults from state', () => {
        const c = useControl()
        expect(c.absolute_coordinates.value).toBe(true)
        expect(c.feedrateXY.value).toBe(100)
        expect(c.feedrateZ.value).toBe(10)
        expect(c.enableXYHoming.value).toBe(false)
    })

    it('falls back when motion state is missing', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.state.printer = {} as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.state.gui.control = {} as any
        const c = useControl()
        expect(c.absolute_coordinates.value).toBe(true)
        expect(c.feedrateXY.value).toBe(100)
        expect(c.feedrateZ.value).toBe(10)
    })

    it('parses homed axes into per-axis flags', () => {
        const c = useControl()
        expect(c.homedAxes.value).toBe('xyz')
        expect(c.xAxisHomed.value).toBe(true)
        expect(c.yAxisHomed.value).toBe(true)
        expect(c.zAxisHomed.value).toBe(true)

        store.state.printer.toolhead.homed_axes = 'x'
        expect(c.xAxisHomed.value).toBe(true)
        expect(c.yAxisHomed.value).toBe(false)
        expect(c.zAxisHomed.value).toBe(false)
    })

    it('colors QGL/Z-tilt by applied state', () => {
        const c = useControl()
        expect(c.colorQuadGantryLevel.value).toBe('primary')
        store.state.printer.quad_gantry_level.applied = false
        expect(c.colorQuadGantryLevel.value).toBe('warning')

        store.state.printer.z_tilt = { applied: false }
        expect(c.colorZTilt.value).toBe('warning')
        store.state.printer.z_tilt.applied = true
        expect(c.colorZTilt.value).toBe('primary')
    })

    it('reads z-tilt-ng when z-tilt is absent', () => {
        store.state.printer.z_tilt_ng = { applied: false }
        expect(useControl().colorZTilt.value).toBe('warning')
    })

    it('falls back to the default action button when the hardware is missing', () => {
        store.state.gui.control.actionButton = 'qgl'
        // existsQGL is false -> falls back to default
        expect(useControl().actionButton.value).toBe('m84')

        store.getters['printer/existsQGL'] = true
        expect(useControl().actionButton.value).toBe('qgl')
    })

    it('lists toolchange macros from gcode commands, sorted numerically', () => {
        store.state.printer.gcode.commands = { T10: {}, T2: {}, G28: {}, T1: {} }
        expect(useControl().toolchangeMacros.value).toEqual(['T1', 'T2', 'T10'])
    })

    it('falls back to printer keys when gcode commands are missing', () => {
        store.state.printer.gcode = null
        store.state.printer['gcode_macro T2'] = {}
        store.state.printer['gcode_macro T1'] = {}
        expect(useControl().toolchangeMacros.value).toEqual(['T1', 'T2'])
    })

    it('detects the _CLIENT_LINEAR_MOVE macro', () => {
        expect(useControl().existsClientLinearMoveMacro.value).toBe(false)
        store.state.printer.gcode.commands = { _CLIENT_LINEAR_MOVE: {} }
        expect(useControl().existsClientLinearMoveMacro.value).toBe(true)
    })

    it('doHome/doHomeX/doHomeY/doHomeXY/doHomeZ dispatch and emit', () => {
        const c = useControl()
        c.doHome()
        c.doHomeX()
        c.doHomeY()
        c.doHomeXY()
        c.doHomeZ()
        expect(store.dispatch).toHaveBeenNthCalledWith(1, 'server/addEvent', {
            message: 'G28',
            type: 'command',
        })
        expect(mocks.emit).toHaveBeenNthCalledWith(1, 'printer.gcode.script', { script: 'G28' }, { loading: 'homeAll' })
        expect(mocks.emit).toHaveBeenNthCalledWith(2, 'printer.gcode.script', { script: 'G28 X' }, { loading: 'homeX' })
        expect(mocks.emit).toHaveBeenNthCalledWith(5, 'printer.gcode.script', { script: 'G28 Z' }, { loading: 'homeZ' })
    })

    it('doQGL dispatches and emits', () => {
        useControl().doQGL()
        expect(store.dispatch).toHaveBeenCalledWith('server/addEvent', {
            message: 'QUAD_GANTRY_LEVEL',
            type: 'command',
        })
        expect(mocks.emit).toHaveBeenCalledWith(
            'printer.gcode.script',
            { script: 'QUAD_GANTRY_LEVEL' },
            { loading: 'qgl' }
        )
    })

    it('doSendMove wraps the move in save/restore state with converted feedrate', () => {
        useControl().doSendMove('X10', 50)
        const script = mocks.emit.mock.calls[0][1].script as string
        expect(script).toContain('SAVE_GCODE_STATE NAME=_ui_movement')
        expect(script).toContain('G91')
        expect(script).toContain('G1 X10 F3000')
        expect(script).toContain('RESTORE_GCODE_STATE NAME=_ui_movement')
    })

    it('doSendMove uses _CLIENT_LINEAR_MOVE when the macro exists', () => {
        store.state.printer.gcode.commands = { _CLIENT_LINEAR_MOVE: {} }
        useControl().doSendMove('X10 Y5', 50)
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', {
            script: '_CLIENT_LINEAR_MOVE X=10 Y=5 F=3000',
        })
    })

    it('doSend dispatches the event and emits the gcode', () => {
        useControl().doSend('M104 S200')
        expect(store.dispatch).toHaveBeenCalledWith('server/addEvent', {
            message: 'M104 S200',
            type: 'command',
        })
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M104 S200' })
    })
})
