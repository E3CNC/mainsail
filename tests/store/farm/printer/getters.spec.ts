import { describe, expect, it } from 'vitest'
import { getters } from '@/store/farm/printer/getters'
import { getDefaultState } from '@/store/farm/printer/index'

function state(overrides = {}) {
    return { ...getDefaultState(), ...overrides } as never as ReturnType<typeof getDefaultState>
}

describe('farm/printer/getters', () => {
    it('getSocketUrl normalizes the path', () => {
        const base = state({
            socket: { ...getDefaultState().socket, hostname: 'h.local', port: 7125, protocol: 'ws', path: '' },
        })
        expect(getters.getSocketUrl(base, undefined as never, undefined as never, undefined as never)).toBe(
            'ws://h.local:7125/websocket'
        )
        const withPath = state({
            socket: {
                ...getDefaultState().socket,
                hostname: 'h.local',
                port: 7125,
                protocol: 'ws',
                path: '//prefix//',
            },
        })
        expect(getters.getSocketUrl(withPath, undefined as never, undefined as never, undefined as never)).toBe(
            'ws://h.local:7125/prefix/websocket'
        )
    })

    it('getSocketData returns the socket', () => {
        const s = state()
        expect(getters.getSocketData(s, undefined as never, undefined as never, undefined as never)).toBe(s.socket)
    })

    it('isCurrentPrinter compares hostname and port', () => {
        const s = state({ socket: { ...getDefaultState().socket, hostname: 'a', port: 7125 } })
        const match = { socket: { hostname: 'a', port: 7125 } } as never
        expect(getters.isCurrentPrinter(s, undefined as never, match, undefined as never)).toBe(true)
        const other = { socket: { hostname: 'b', port: 7125 } } as never
        expect(getters.isCurrentPrinter(s, undefined as never, other, undefined as never)).toBe(false)
    })

    it('getSetting returns values or fallback', () => {
        const s = state({ settings: { theme: 'dark' } })
        const run = getters.getSetting(s, undefined as never, undefined as never, undefined as never) as <T>(
            n: string,
            f: T
        ) => T
        expect(run('theme', 'light')).toBe('dark')
        expect(run('missing', 'light')).toBe('light')
    })

    it('getPrinterName prefers the gui name', () => {
        const named = state({
            data: { ...getDefaultState().data, gui: { general: { printername: 'Farm1' } } as never },
        })
        expect(getters.getPrinterName(named, undefined as never, undefined as never, undefined as never)).toBe('Farm1')
        const fallback = state({
            socket: { ...getDefaultState().socket, hostname: 'h.local', port: 7125, path: '/p' },
            data: { ...getDefaultState().data, gui: { general: {} } as never },
        })
        expect(getters.getPrinterName(fallback, undefined as never, undefined as never, undefined as never)).toBe(
            'h.local:7125/p'
        )
        const port80 = state({
            socket: { ...getDefaultState().socket, hostname: 'h.local', port: 80, path: '' },
            data: { ...getDefaultState().data, gui: { general: { printername: '' } } as never },
        })
        expect(getters.getPrinterName(port80, undefined as never, undefined as never, undefined as never)).toBe(
            'h.local'
        )
    })

    it('getPrinterSocketState and getLogoColor', () => {
        const s = state()
        expect(getters.getPrinterSocketState(s, undefined as never, undefined as never, undefined as never)).toBe(
            s.socket
        )
        expect(getters.getLogoColor(s, undefined as never, undefined as never, undefined as never)).toBe('#D41216')
        const custom = state({ data: { ...getDefaultState().data, gui: { uiSettings: { logo: '#fff' } } as never } })
        expect(getters.getLogoColor(custom, undefined as never, undefined as never, undefined as never)).toBe('#fff')
    })

    it('getStatus covers connection, klippy and print states', () => {
        const disc = state({ socket: { ...getDefaultState().socket, isConnected: false, isConnecting: false } })
        expect(getters.getStatus(disc, {}, undefined as never, undefined as never)).toBe('Disconnected')
        const conn = state({ socket: { ...getDefaultState().socket, isConnected: false, isConnecting: true } })
        expect(getters.getStatus(conn, {}, undefined as never, undefined as never)).toBe('Connecting...')
        const err = state({
            socket: { ...getDefaultState().socket, isConnected: true },
            server: { klippy_connected: false },
        })
        expect(getters.getStatus(err, {}, undefined as never, undefined as never)).toBe('ERROR')
        const printing = state({
            socket: { ...getDefaultState().socket, isConnected: true },
            server: { klippy_connected: true },
            data: { ...getDefaultState().data, print_stats: { state: 'printing' } as never },
        })
        expect(getters.getStatus(printing, { getPrintPercent: 0.456 }, undefined as never, undefined as never)).toBe(
            '45% Printing'
        )
        const paused = state({
            socket: { ...getDefaultState().socket, isConnected: true },
            server: { klippy_connected: true },
            data: { ...getDefaultState().data, print_stats: { state: 'paused' } as never },
        })
        expect(getters.getStatus(paused, {}, undefined as never, undefined as never)).toBe('Paused')
        const unknown = state({
            socket: { ...getDefaultState().socket, isConnected: true },
            server: { klippy_connected: true },
            data: { ...getDefaultState().data },
        })
        expect(getters.getStatus(unknown, {}, undefined as never, undefined as never)).toBe('Unknown')
    })

    it('getCurrentFilename returns the filename or empty', () => {
        const s = state({ data: { ...getDefaultState().data, print_stats: { filename: 'a.gcode' } as never } })
        expect(getters.getCurrentFilename(s, undefined as never, undefined as never, undefined as never)).toBe(
            'a.gcode'
        )
        expect(getters.getCurrentFilename(state(), undefined as never, undefined as never, undefined as never)).toBe('')
    })

    it('getPrintPercent routes by calc mode', () => {
        const modes: [string, string][] = [
            ['file-relative', 'getPrintPercentByFilepositionRelative'],
            ['file-absolute', 'getPrintPercentByFilepositionAbsolute'],
            ['slicer', 'getPrintPercentBySlicer'],
            ['filament', 'getPrintPercentByFilament'],
        ]
        modes.forEach(([mode, key]) => {
            const s = state({
                data: { ...getDefaultState().data, gui: { general: { calcPrintProgress: mode } } as never },
            })
            const mg = { [key]: 0.7 } as never
            expect(getters.getPrintPercent(s, mg, undefined as never, undefined as never)).toBe(0.7)
        })
        const fallback = state({ data: { ...getDefaultState().data, gui: { general: {} } as never } })
        expect(
            getters.getPrintPercent(
                fallback,
                { getPrintPercentByFilepositionRelative: 0.3 } as never,
                undefined as never,
                undefined as never
            )
        ).toBe(0.3)
    })

    it('getPrintPercentByFilepositionRelative handles bounds and fallback', () => {
        const mk = (current_file: object, virtual_sdcard: object, filename: string) =>
            state({
                current_file: { filename: '', ...current_file } as never,
                data: {
                    ...getDefaultState().data,
                    print_stats: { filename } as never,
                    virtual_sdcard: virtual_sdcard as never,
                },
            })
        const valid = mk(
            { filename: 'a.gcode', gcode_start_byte: 100, gcode_end_byte: 1100 },
            { file_position: 600, progress: 0.1 },
            'a.gcode'
        )
        expect(
            getters.getPrintPercentByFilepositionRelative(
                valid,
                undefined as never,
                undefined as never,
                undefined as never
            )
        ).toBeCloseTo(0.5)
        const low = mk(
            { filename: 'a.gcode', gcode_start_byte: 100, gcode_end_byte: 1100 },
            { file_position: 50, progress: 0.1 },
            'a.gcode'
        )
        expect(
            getters.getPrintPercentByFilepositionRelative(
                low,
                undefined as never,
                undefined as never,
                undefined as never
            )
        ).toBe(0)
        const high = mk(
            { filename: 'a.gcode', gcode_start_byte: 100, gcode_end_byte: 1100 },
            { file_position: 2000, progress: 0.1 },
            'a.gcode'
        )
        expect(
            getters.getPrintPercentByFilepositionRelative(
                high,
                undefined as never,
                undefined as never,
                undefined as never
            )
        ).toBe(1)
        const mismatch = mk(
            { filename: 'b.gcode', gcode_start_byte: 100, gcode_end_byte: 1100 },
            { file_position: 600, progress: 0.22 },
            'a.gcode'
        )
        expect(
            getters.getPrintPercentByFilepositionRelative(
                mismatch,
                undefined as never,
                undefined as never,
                undefined as never
            )
        ).toBe(0.22)
    })

    it('absolute, slicer and filament percent getters', () => {
        const s = state({ data: { ...getDefaultState().data, virtual_sdcard: { progress: 0.4 } as never } })
        expect(
            getters.getPrintPercentByFilepositionAbsolute(s, undefined as never, undefined as never, undefined as never)
        ).toBe(0.4)
        const slicer = state({ data: { ...getDefaultState().data, display_status: { progress: 0.6 } as never } })
        expect(
            getters.getPrintPercentBySlicer(slicer, undefined as never, undefined as never, undefined as never)
        ).toBe(0.6)
        const fil = state({
            current_file: { filament_total: 100 } as never,
            data: { ...getDefaultState().data, print_stats: { filament_used: 25 } as never },
        })
        expect(getters.getPrintPercentByFilament(fil, undefined as never, undefined as never, undefined as never)).toBe(
            0.25
        )
        const zero = state({
            current_file: { filament_total: 0 } as never,
            data: { ...getDefaultState().data, print_stats: { filament_used: 5 } as never },
        })
        expect(
            getters.getPrintPercentByFilament(zero, undefined as never, undefined as never, undefined as never)
        ).toBe(0)
        const fallback = state({
            data: { ...getDefaultState().data, virtual_sdcard: { progress: 0.9 } as never },
        })
        expect(
            getters.getPrintPercentByFilament(fallback, undefined as never, undefined as never, undefined as never)
        ).toBe(0.9)
    })

    it('getImage builds thumbnail urls or null', () => {
        const s = state({
            socket: { ...getDefaultState().socket, hostname: 'h.local', port: 7125, path: '' },
            current_file: {
                filename: 'sub/benchy.gcode',
                thumbnails: [{ width: 200, relative_path: 'thumb.png' }],
            } as never,
            data: { ...getDefaultState().data, print_stats: { filename: 'benchy.gcode' } as never },
        })
        const url = getters.getImage(s, undefined as never, undefined as never, undefined as never) as string
        expect(url).toContain('h.local:7125')
        expect(url).toContain('thumb.png')
        expect(getters.getImage(state(), undefined as never, undefined as never, undefined as never)).toBeNull()
        const noThumb = state({ current_file: { filename: 'a.gcode', thumbnails: [] } as never })
        expect(getters.getImage(noThumb, undefined as never, undefined as never, undefined as never)).toBeNull()
    })

    it('getThemeFileUrl and getLogo resolve theme files', () => {
        const s = state({
            socket: { ...getDefaultState().socket, hostname: 'h.local', port: 7125, path: '' },
            theme_files: ['.theme/sidebar-logo.png'],
        })
        const run = getters.getThemeFileUrl(s, undefined as never, undefined as never, undefined as never) as (
            n: string,
            e: string[]
        ) => string | null
        expect(run('sidebar-logo', ['png'])).toContain('sidebar-logo.png')
        expect(run('missing', ['png'])).toBeNull()
        expect(
            getters.getLogo(s, { getThemeFileUrl: run }, undefined as never, undefined as never) as string | null
        ).toContain('sidebar-logo.png')
    })

    it('getPosition returns toolhead position or empty', () => {
        const s = state({ data: { ...getDefaultState().data, toolhead: { position: [1, 2, 3] } as never } })
        expect(getters.getPosition(s, undefined as never, undefined as never, undefined as never)).toEqual([1, 2, 3])
        expect(getters.getPosition(state(), undefined as never, undefined as never, undefined as never)).toEqual([])
    })

    it('getPrinterPreview returns empty when klippy is down', () => {
        const s = state({ server: { klippy_connected: false } })
        expect(getters.getPrinterPreview(s, {}, undefined as never, { 'gui/getHours12Format': false })).toEqual([])
    })

    it('getPrinterPreview lists heaters and chamber sensors', () => {
        const s = state({
            server: { klippy_connected: true },
            data: {
                ...getDefaultState().data,
                extruder: { temperature: 200.4, target: 210.1 },
                heater_bed: { temperature: 60, target: 60 },
                'temperature_fan chamber': { temperature: 30, target: 40 },
                'temperature_sensor chamber': { temperature: 31 },
                print_stats: { state: 'standby' },
            } as never,
        })
        const out = getters.getPrinterPreview(s, {}, undefined as never, {}) as { name: string }[]
        expect(out.map((e) => e.name)).toContain('Extruder')
        expect(out.length).toBeGreaterThanOrEqual(4)
    })

    it('estimated times compute remaining time or zero', () => {
        const s = state({
            current_file: { filament_total: 100, estimated_time: 500 } as never,
            data: {
                ...getDefaultState().data,
                print_stats: { print_duration: 100, filament_used: 25 } as never,
                virtual_sdcard: { progress: 0.5 } as never,
            } as never,
        })
        const file = getters.estimated_time_file(s, { getPrintPercent: 0.5 }, undefined as never, undefined as never)
        expect(file).toBe('100')
        expect(getters.estimated_time_filament(s, undefined as never, undefined as never, undefined as never)).toBe(
            '300'
        )
        expect(getters.estimated_time_slicer(s, undefined as never, undefined as never, undefined as never)).toBe('400')
        const empty = state()
        expect(getters.estimated_time_file(empty, { getPrintPercent: 0 }, undefined as never, undefined as never)).toBe(
            0
        )
        expect(getters.estimated_time_filament(empty, undefined as never, undefined as never, undefined as never)).toBe(
            0
        )
        expect(getters.estimated_time_slicer(empty, undefined as never, undefined as never, undefined as never)).toBe(0)
    })

    it('estimated_time_eta averages active estimates', () => {
        const s = state({
            data: {
                ...getDefaultState().data,
                gui: { general: { calcEtaTime: ['file', 'filament', 'slicer'] } } as never,
            },
        })
        const mg = { estimated_time_file: '100', estimated_time_filament: '200', estimated_time_slicer: '300' }
        const eta = getters.estimated_time_eta(s, mg, undefined as never, undefined as never) as number
        expect(eta).toBeGreaterThan(Date.now())
        expect(getters.estimated_time_eta(state(), {}, undefined as never, undefined as never)).toBe(0)
    })

    it('getPrinterWebcams filters disabled webcams', () => {
        const s = state({
            data: {
                ...getDefaultState().data,
                webcams: [
                    { name: 'a', enabled: true },
                    { name: 'b', enabled: false },
                ] as never,
            },
        })
        expect(
            (getters.getPrinterWebcams(s, undefined as never, undefined as never, undefined as never) as unknown[])
                .length
        ).toBe(1)
    })
})
