import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { dispatch: ReturnType<typeof vi.fn>; state: Record<string, any> } = {
    dispatch: vi.fn(),
    state: {},
}

vi.mock('vuex', () => ({
    useStore: () => store,
}))

import { useConsole } from '@/composables/useConsole'

function defaultState() {
    return {
        printer: {
            gcode: {
                commands: {
                    G28: { help: 'Home all axes' },
                    M104: {},
                },
            },
        },
        gui: {
            console: {
                direction: 'table',
                hideWaitTemperatures: false,
                hideTlCommands: true,
                consolefilters: { f1: { name: 'temp' } },
                autoscroll: true,
                rawOutput: false,
            },
            gcodehistory: {
                entries: ['G28', 'M104 S200'],
            },
        },
    }
}

describe('useConsole', () => {
    beforeEach(() => {
        store.dispatch.mockReset()
        store.state = reactive(defaultState())
    })

    it('helplist maps gcode commands to command/help pairs', () => {
        const { helplist } = useConsole()
        expect(helplist.value).toEqual([
            { command: 'G28', help: 'Home all axes' },
            { command: 'M104', help: '' },
        ])
    })

    it('helplist is empty when no commands are present', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.state.printer = {} as any
        expect(useConsole().helplist.value).toEqual([])
    })

    it('consoleDirection defaults to table when unset', () => {
        expect(useConsole().consoleDirection.value).toBe('table')
        store.state.gui.console.direction = 'shell'
        expect(useConsole().consoleDirection.value).toBe('shell')
    })

    it('setting setters dispatch gui/saveSetting with the right names', () => {
        const { setHideWaitTemperatures, setHideTlCommands, setAutoscroll, setRawOutput } = useConsole()
        setHideWaitTemperatures(true)
        setHideTlCommands(false)
        setAutoscroll(false)
        setRawOutput(true)
        expect(store.dispatch).toHaveBeenNthCalledWith(1, 'gui/saveSetting', {
            name: 'console.hideWaitTemperatures',
            value: true,
        })
        expect(store.dispatch).toHaveBeenNthCalledWith(2, 'gui/saveSetting', {
            name: 'console.hideTlCommands',
            value: false,
        })
        expect(store.dispatch).toHaveBeenNthCalledWith(3, 'gui/saveSetting', {
            name: 'console.autoscroll',
            value: false,
        })
        expect(store.dispatch).toHaveBeenNthCalledWith(4, 'gui/saveSetting', {
            name: 'console.rawOutput',
            value: true,
        })
    })

    it('applies defaults for autoscroll, rawOutput, filters and history', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.state.gui.console = {} as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.state.gui.gcodehistory = {} as any
        const { autoscroll, rawOutput, customFilters, lastCommands } = useConsole()
        expect(autoscroll.value).toBe(true)
        expect(rawOutput.value).toBe(false)
        expect(customFilters.value).toEqual({})
        expect(lastCommands.value).toEqual([])
    })

    it('toggleFilter dispatches filterUpdate with id and values', () => {
        const filter = { name: 'temp', bool: true, regex: 'B\d+' }
        useConsole().toggleFilter('f1', filter)
        expect(store.dispatch).toHaveBeenCalledWith('gui/console/filterUpdate', {
            id: 'f1',
            values: filter,
        })
    })

    it('clearConsole dispatches gui/console/clear', () => {
        useConsole().clearConsole()
        expect(store.dispatch).toHaveBeenCalledWith('gui/console/clear')
    })
})
