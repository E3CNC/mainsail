import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { getters } from '@/store/files/getters'
import type { FileState, FileStateFile } from '@/store/files/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyState = any

function dir(name: string, childrens: FileStateFile[] = []): FileStateFile {
    return { isDirectory: true, filename: name, modified: new Date('2024-01-01'), permissions: 'r', childrens }
}

function file(name: string, overrides: Partial<FileStateFile> = {}): FileStateFile {
    return {
        isDirectory: false,
        filename: name,
        modified: new Date('2024-01-01T00:00:00Z'),
        permissions: 'r',
        size: 100,
        ...overrides,
    }
}

function stateWith(...roots: FileStateFile[]): FileState {
    return {
        filetree: roots,
        upload: {
            show: false,
            filename: '',
            currentNumber: 0,
            maxNumber: 0,
            cancelTokenSource: null,
            percent: 0,
            speed: 0,
        },
    }
}

// Wire the real getters together the way vuex would, with overridable root parts
function wired(state: FileState, rootState: AnyState = {}, rootGetters: AnyState = {}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: Record<string, any> = {}
    g['getDirectory'] = (getters.getDirectory as AnyState)(state)
    g['getFile'] = (getters.getFile as AnyState)(state, g)
    g['getGcodeFiles'] = (getters.getGcodeFiles as AnyState)(state, g, rootState, rootGetters)
    // value-style getters (not curried) stay lazy so building the harness
    // never triggers a full gcode scan or theme lookup
    g['getAllGcodes'] = () => (getters.getAllGcodes as AnyState)(state, g)
    g['getThemeFileUrl'] = (getters.getThemeFileUrl as AnyState)(state, g, rootState, rootGetters)
    g['getSidebarLogo'] = () => (getters.getSidebarLogo as AnyState)(state, g)
    g['getCustomSidebarBackground'] = () => (getters.getCustomSidebarBackground as AnyState)(state, g)
    g['getMainBackground'] = () => (getters.getMainBackground as AnyState)(state, g)
    g['getCustomStylesheet'] = () => (getters.getCustomStylesheet as AnyState)(state, g)
    g['getCustomNaviPoints'] = () => (getters.getCustomNaviPoints as AnyState)(state, g)
    g['getCustomFavicons'] = () => (getters.getCustomFavicons as AnyState)(state, g)
    g['getDiskUsage'] = (getters.getDiskUsage as AnyState)(state)
    g['checkConfigFile'] = (getters.checkConfigFile as AnyState)(state, g)
    g['getSmallThumbnail'] = (getters.getSmallThumbnail as AnyState)(state, g, rootState, rootGetters)
    g['getBigThumbnail'] = (getters.getBigThumbnail as AnyState)(state, g, rootState, rootGetters)
    return g
}

function themeState(filenames: string[]): FileState {
    const themeFiles = filenames.map((f) => file(f))
    return stateWith(dir('config', [dir('.theme', themeFiles)]))
}

describe('files/getters', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('getDirectory resolves roots, strips slashes and returns null for misses', () => {
        const g = wired(stateWith(dir('gcodes', [dir('sub', [file('a.gcode')])])))
        expect(g['getDirectory']('gcodes')?.filename).toBe('gcodes')
        expect(g['getDirectory']('/gcodes')?.filename).toBe('gcodes')
        expect(g['getDirectory']('gcodes/')?.filename).toBe('gcodes')
        expect(g['getDirectory']('gcodes/sub')?.filename).toBe('sub')
        expect(g['getDirectory']('gcodes/nope')).toBeNull()
        expect(g['getDirectory']('unknown')).toBeNull()
    })

    it('getFile finds files but not directories of the same name', () => {
        const g = wired(stateWith(dir('gcodes', [file('a.gcode'), dir('sub')])))
        expect(g['getFile']('gcodes/a.gcode')?.filename).toBe('a.gcode')
        expect(g['getFile']('gcodes/sub')).toBeUndefined()
        expect(g['getFile']('gcodes/ghost.gcode')).toBeUndefined()
        expect(g['getFile']('unknown/a.gcode')).toBeUndefined()
    })

    it('getGcodeFiles returns [] when there is no gcodes root', () => {
        const g = wired(stateWith(), {}, { 'server/history/getPrintJobsForGcodes': () => [] })
        expect(g['getGcodeFiles'](null, true, true)).toEqual([])
    })

    it('getGcodeFiles lists a subdirectory and filters hidden and non-gcode files', () => {
        const rootGetters = { 'server/history/getPrintJobsForGcodes': () => [] }
        const rootState = { printer: { gcode: { commands: {} } } }
        const g = wired(
            stateWith(dir('gcodes', [file('a.gcode'), file('notes.txt'), file('.hidden.gcode'), dir('sub')])),
            rootState,
            rootGetters
        )
        const visible = g['getGcodeFiles']('', false, true).map((f: FileStateFile) => f.filename)
        expect(visible).toContain('a.gcode')
        expect(visible).toContain('sub')
        expect(visible).not.toContain('notes.txt')
        expect(visible).not.toContain('.hidden.gcode')
        const withHidden = g['getGcodeFiles']('', true, true).map((f: FileStateFile) => f.filename)
        expect(withHidden).toContain('.hidden.gcode')
    })

    it('getGcodeFiles recurses the whole tree when path is null', () => {
        const rootGetters = { 'server/history/getPrintJobsForGcodes': () => [] }
        const rootState = { printer: { gcode: { commands: {} } } }
        const g = wired(
            stateWith(dir('gcodes', [file('top.gcode'), dir('sub', [file('nested.gcode'), file('skip.txt')])])),
            rootState,
            rootGetters
        )
        const all = g['getGcodeFiles'](null, false, true)
        const names = all.map((f: AnyState) => f.filename)
        expect(names).toContain('top.gcode')
        expect(names).toContain('sub/nested.gcode')
        expect(names).not.toContain('skip.txt')
        expect(all.find((f: AnyState) => f.filename === 'sub/nested.gcode').full_filename).toBe('sub/nested.gcode')
    })

    it('getGcodeFiles builds preheat gcode only for known commands above threshold', () => {
        const rootGetters = { 'server/history/getPrintJobsForGcodes': () => [] }
        const rootState = { printer: { gcode: { commands: { M104: {}, M140: {} } } } }
        const g = wired(
            stateWith(
                dir('gcodes', [
                    file('hot.gcode', { first_layer_extr_temp: 210, first_layer_bed_temp: 60, chamber_temp: 0 }),
                    file('cold.gcode', { first_layer_extr_temp: 1 }),
                ])
            ),
            rootState,
            rootGetters
        )
        const all = g['getGcodeFiles']('', false, true)
        const hot = all.find((f: AnyState) => f.filename === 'hot.gcode')
        // chamber_temp is not in gcode commands, so only M104/M140 lines appear
        expect(hot.preheat_gcode).toBe('M104 S210\nM140 S60')
        expect(all.find((f: AnyState) => f.filename === 'cold.gcode').preheat_gcode).toBeNull()
    })

    it('getGcodeFiles merges print history and hides completed files on request', () => {
        const histories = [
            {
                status: 'completed',
                start_time: 1000,
                end_time: 2000,
                filament_used: 5,
                print_duration: 900,
                total_duration: 1000,
            },
            {
                status: 'cancelled',
                start_time: 3000,
                end_time: 3100,
                filament_used: 1,
                print_duration: 50,
                total_duration: 100,
            },
        ]
        const rootGetters = { 'server/history/getPrintJobsForGcodes': () => histories }
        const rootState = { printer: { gcode: { commands: {} } } }
        const g = wired(stateWith(dir('gcodes', [file('a.gcode')])), rootState, rootGetters)
        const all = g['getGcodeFiles']('', false, true)
        expect(all[0].count_printed).toBe(1)
        expect(all[0].last_status).toBe('cancelled')
        expect(all[0].last_start_time).toEqual(new Date(1000 * 1000))
        expect(all[0].last_end_time).toEqual(new Date(2000 * 1000))
        expect(all[0].last_filament_used).toBe(5)
        const uncompletedOnly = g['getGcodeFiles']('', false, false)
        expect(uncompletedOnly).toEqual([])
    })

    it('getGcodeFiles keeps never-printed files when completed files are hidden', () => {
        const rootGetters = { 'server/history/getPrintJobsForGcodes': () => [] }
        const rootState = { printer: { gcode: { commands: {} } } }
        const g = wired(stateWith(dir('gcodes', [file('fresh.gcode')])), rootState, rootGetters)
        expect(g['getGcodeFiles']('', false, false)).toHaveLength(1)
    })

    it('getGcodeFiles tolerates a non-Date modified value', () => {
        const rootGetters = {
            'server/history/getPrintJobsForGcodes': (filename: string, modified: number) => {
                expect(modified).toBe(0)
                return []
            },
        }
        const rootState = { printer: { gcode: { commands: {} } } }
        const g = wired(
            stateWith(dir('gcodes', [file('odd.gcode', { modified: 'not-a-date' as never })])),
            rootState,
            rootGetters
        )
        expect(g['getGcodeFiles']('', false, true)).toHaveLength(1)
    })

    it('getAllGcodes delegates with (null, false, true)', () => {
        const stub = vi.fn().mockReturnValue(['x'])
        const out = (getters.getAllGcodes as AnyState)({}, { getGcodeFiles: stub })
        expect(stub).toHaveBeenCalledWith(null, false, true)
        expect(out).toEqual(['x'])
        const rootGetters = { 'server/history/getPrintJobsForGcodes': () => [] }
        const g = wired(
            stateWith(dir('gcodes', [file('a.gcode')])),
            { printer: { gcode: { commands: {} } } },
            rootGetters
        )
        expect(g['getAllGcodes']()).toHaveLength(1)
    })

    it('getThemeFileUrl resolves themed files with a cache-busting timestamp', () => {
        const rootGetters = { 'socket/getUrl': 'http://host' }
        const g = wired(themeState(['sidebar-logo.png']), {}, rootGetters)
        const url = g['getThemeFileUrl']('sidebar-logo', ['svg', 'png'])
        expect(url).toContain('http://host/server/files/config/.theme/sidebar-logo.png?timestamp=')
        expect(g['getThemeFileUrl']('missing', ['png'])).toBeNull()
        expect(g['getThemeFileUrl']('sidebar-logo', ['css'])).toBeNull()
        expect(g['getThemeFileUrl']('sidebar-logo', [])).toBeNull()
    })

    it('sidebar and background getters fall back correctly', () => {
        const withLogo = wired(themeState(['sidebar-logo.svg']), {}, { 'socket/getUrl': 'http://h' })
        expect(withLogo['getSidebarLogo']()).toContain('sidebar-logo.svg')
        const withoutLogo = wired(themeState([]), {}, { 'socket/getUrl': 'http://h' })
        expect(withoutLogo['getSidebarLogo']()).toBe('')
        expect(withoutLogo['getCustomSidebarBackground']()).toBeNull()
        expect(withLogo['getMainBackground']()).toBeNull()
        expect(withLogo['getCustomStylesheet']()).toBeNull()
        expect(withLogo['getCustomNaviPoints']()).toBeNull()
        const withBg = wired(
            themeState(['sidebar-background.png', 'main-background.png', 'custom.css', 'navi.json']),
            {},
            { 'socket/getUrl': 'http://h' }
        )
        expect(withBg['getCustomSidebarBackground']()).toContain('sidebar-background.png')
        expect(withBg['getMainBackground']()).toContain('main-background.png')
        expect(withBg['getCustomStylesheet']()).toContain('custom.css')
        expect(withBg['getCustomNaviPoints']()).toContain('navi.json')
    })

    it('getCustomFavicons covers all presence combinations', () => {
        const both = { getThemeFileUrl: vi.fn().mockReturnValue('url') }
        expect((getters.getCustomFavicons as AnyState)({}, both)).toEqual(['url', 'url'])
        const onlyFirst = { getThemeFileUrl: vi.fn().mockReturnValueOnce('a').mockReturnValueOnce(null) }
        expect((getters.getCustomFavicons as AnyState)({}, onlyFirst)).toEqual(['a', 'a'])
        const onlySecond = { getThemeFileUrl: vi.fn().mockReturnValueOnce(null).mockReturnValueOnce('b') }
        expect((getters.getCustomFavicons as AnyState)({}, onlySecond)).toEqual(['b', 'b'])
        const neither = { getThemeFileUrl: vi.fn().mockReturnValue(null) }
        expect((getters.getCustomFavicons as AnyState)({}, neither)).toBeNull()
    })

    it('getDiskUsage resolves roots, strips slashes and returns null otherwise', () => {
        const usage = { free: 1, total: 2, used: 1 }
        const g = wired(stateWith({ ...dir('gcodes'), disk_usage: usage }, dir('plain')))
        expect(g['getDiskUsage']('gcodes')).toEqual(usage)
        expect(g['getDiskUsage']('/gcodes')).toEqual(usage)
        expect(g['getDiskUsage']('gcodes/sub')).toEqual(usage)
        expect(g['getDiskUsage']('plain')).toBeNull()
        expect(g['getDiskUsage']('unknown')).toBeNull()
    })

    it('checkConfigFile detects config files', () => {
        const g = wired(stateWith(dir('config', [file('printer.cfg')])))
        expect(g['checkConfigFile']('printer.cfg')).toBe(true)
        expect(g['checkConfigFile']('missing.cfg')).toBe(false)
    })

    it('getSmallThumbnail returns matching thumbnails and empty strings otherwise', () => {
        const rootGetters = { 'socket/getUrl': 'http://h' }
        const g = wired(stateWith(), {}, rootGetters)
        const item = file('a.gcode', {
            thumbnails: [
                { width: 20, height: 20, size: 1, relative_path: 'tiny.png' },
                { width: 50, height: 50, size: 2, relative_path: '.thumbs/small.png' },
            ],
        })
        expect(g['getSmallThumbnail'](item, 'gcodes')).toContain('.thumbs/small.png')
        expect(g['getSmallThumbnail'](file('b.gcode'), 'gcodes')).toBe('')
        expect(g['getSmallThumbnail'](file('c.gcode', { thumbnails: [] }), 'gcodes')).toBe('')
        expect(
            g['getSmallThumbnail'](
                file('d.gcode', { thumbnails: [{ width: 500, height: 500, size: 3, relative_path: 'big.png' }] }),
                'gcodes'
            )
        ).toBe('')
        const noRelPath = file('e.gcode', { thumbnails: [{ width: 50, height: 50, size: 1 } as never] })
        expect(g['getSmallThumbnail'](noRelPath, 'gcodes')).toBe('')
    })

    it('getBigThumbnail returns the first large thumbnail', () => {
        const rootGetters = { 'socket/getUrl': 'http://h' }
        const g = wired(stateWith(), {}, rootGetters)
        const item = file('a.gcode', {
            thumbnails: [
                { width: 50, height: 50, size: 1, relative_path: 'small.png' },
                { width: 300, height: 300, size: 5, relative_path: '.thumbs/big.png' },
            ],
        })
        expect(g['getBigThumbnail'](item, 'gcodes')).toContain('.thumbs/big.png')
        expect(g['getBigThumbnail'](file('b.gcode'), 'gcodes')).toBe('')
        const noRelPath = file('c.gcode', { thumbnails: [{ width: 400, height: 400, size: 2 } as never] })
        expect(g['getBigThumbnail'](noRelPath, 'gcodes')).toBe('')
    })
})
