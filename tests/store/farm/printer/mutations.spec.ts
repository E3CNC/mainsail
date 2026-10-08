import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/farm/printer/mutations'
import { getDefaultState } from '@/store/farm/printer/index'

function state(overrides = {}) {
    return { ...getDefaultState(), ...overrides }
}

describe('farm/printer/mutations', () => {
    it('reset restores defaults', () => {
        const s = state({ _namespace: 'p1' })
        mutations.reset(s as never)
        const fresh = getDefaultState()
        expect(s._namespace).toBe('')
        expect(s.socket).toEqual(fresh.socket)
        expect(s.server).toEqual(fresh.server)
        expect(s.current_file.filename).toBe('')
    })

    it('resetData restores default data entries', () => {
        const s = state()
        s.data.extruder = { temperature: 200 } as never
        mutations.resetData(s as never)
        expect(s.data.gui).toEqual(getDefaultState().data.gui)
        expect(s.data.webcams).toEqual([])
    })

    it('setSocketData unwraps status, strips meta and assigns', () => {
        const s = state()
        mutations.setSocketData(s as never, { status: { isConnecting: true } })
        expect(s.socket.isConnecting).toBe(true)

        const s2 = state()
        mutations.setSocketData(s2 as never, {
            requestParams: { id: 1 },
            _namespace: 'p1',
            hostname: 'a.local',
        })
        expect(s2._namespace).toBe('p1')
        expect(s2.socket.hostname).toBe('a.local')
        expect('requestParams' in (s2.socket as unknown as Record<string, unknown>)).toBe(false)
    })

    it('setData merges objects and strips requestParams', () => {
        const s = state()
        s.data.toolhead = { position: [0, 0, 0] } as never
        mutations.setData(s as never, {
            requestParams: { id: 1 },
            toolhead: { homed_axes: 'xyz' },
            print_stats: 'printing',
        })
        expect(s.data.toolhead).toEqual({ position: [0, 0, 0], homed_axes: 'xyz' })
        expect(s.data.print_stats).toBe('printing')
    })

    it('setSettings merges settings', () => {
        const s = state({ settings: { a: 1 } })
        mutations.setSettings(s as never, { b: 2 })
        expect(s.settings).toEqual({ a: 1, b: 2 })
    })

    it('addWsData / removeWsData manage the queue', () => {
        const s = state()
        mutations.addWsData(s as never, { id: 1 })
        mutations.addWsData(s as never, { id: 2 })
        expect(s.socket.wsData).toHaveLength(2)
        mutations.removeWsData(s as never, 0)
        expect(s.socket.wsData).toEqual([{ id: 2 }])
    })

    it('setKlippyConnected toggles the flag', () => {
        const s = state()
        mutations.setKlippyConnected(s as never, true)
        expect(s.server.klippy_connected).toBe(true)
        mutations.setKlippyConnected(s as never, false)
        expect(s.server.klippy_connected).toBe(false)
    })

    it('setCurrentFile strips requestParams and stores the file', () => {
        const s = state()
        const file = { filename: 'a.gcode', requestParams: { id: 1 } } as never
        mutations.setCurrentFile(s as never, file)
        expect(s.current_file).toEqual({ filename: 'a.gcode' })
    })

    it('setConfigDir collects theme files only', () => {
        const s = state()
        mutations.setConfigDir(s as never, {
            '0': { path: '.theme/sidebar-logo.png' },
            '1': { path: 'printer.cfg' },
            '2': {},
        })
        expect(s.theme_files).toEqual(['.theme/sidebar-logo.png'])
    })

    it('setDatabases stores namespaces', () => {
        const s = state()
        mutations.setDatabases(s as never, ['mainsail'])
        expect(s.databases).toEqual(['mainsail'])
    })

    it('setMainsailData deep-merges gui data', () => {
        const s = state()
        mutations.setMainsailData(s as never, { general: { printername: 'Farm1' } })
        expect((s.data.gui as { general: { printername: string } }).general.printername).toBe('Farm1')
    })

    it('setWebcamsData replaces webcams', () => {
        const s = state()
        const webcams = [{ name: 'cam', enabled: true }] as never
        mutations.setWebcamsData(s as never, webcams)
        expect(s.data.webcams).toEqual(webcams)
    })
})
