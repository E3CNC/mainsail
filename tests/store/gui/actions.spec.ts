import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/gui/actions'
import { getDefaultState } from '@/store/gui/index'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: getDefaultState(),
        rootState: {} as Record<string, unknown>,
        rootGetters: { 'socket/getUrl': 'http://localhost:7125', getVersion: 'v1.0.0' } as Record<string, unknown>,
        getters: {},
        ...overrides,
    }
}

function jsonResponse(value: unknown) {
    return { json: async () => value }
}

describe('gui/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
        fetchMock.mockReset()
        fetchMock.mockResolvedValue(jsonResponse({}))
        // jsdom does not implement navigation: stub reload for reset/restore actions
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.stubGlobal('fetch', fetchMock)
    })

    it('reset commits and dispatches submodule resets', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
        for (const sub of ['console', 'gcodehistory', 'macros', 'presets', 'webcams'])
            expect(c.dispatch).toHaveBeenCalledWith(`${sub}/reset`)
    })

    it('init emits a database get_item for the mainsail namespace', () => {
        actions.init(undefined as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.get_item',
            expect.objectContaining({ namespace: 'mainsail' }),
            expect.objectContaining({ action: 'gui/initStore' })
        )
    })

    it('initStore migrates legacy keys and commits data', async () => {
        const c = ctx({ rootState: { instancesDB: 'moonraker' } })
        const payload = {
            value: {
                remoteprinters: { printers: [{ name: 'p1' }] },
                view: { gcodefiles: { currentPath: 'a' }, configfiles: { currentPath: 'b' } },
                cooldownGcode: 'M104 S0',
                presets: [{ name: 'PLA' }],
                dashboard: {
                    nonExpandPanels: ['temperature'],
                    mobileLayout: [
                        { name: 'tools', visible: true },
                        { name: 'other', visible: true },
                    ],
                },
            },
        }
        await actions.initStore(c as never, payload as never)
        expect(c.dispatch).toHaveBeenCalledWith('remoteprinters/initStore', [{ name: 'p1' }])
        expect(c.dispatch).toHaveBeenCalledWith(
            'saveSetting',
            expect.objectContaining({ name: 'presets.cooldownGcode' })
        )
        expect(c.dispatch).toHaveBeenCalledWith('presets/store', { values: { name: 'PLA' } })
        expect(c.dispatch).toHaveBeenCalledWith(
            'saveSetting',
            expect.objectContaining({ name: 'dashboard.nonExpandPanels.widescreen' })
        )
        expect(c.dispatch).toHaveBeenCalledWith(
            'saveSetting',
            expect.objectContaining({ name: 'dashboard.mobileLayout' })
        )
        expect(payload.value.dashboard.mobileLayout[0].name).toBe('temperature')
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('key=view.gcodefiles.currentPath'), {
            method: 'DELETE',
        })
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('key=view.configfiles.currentPath'), {
            method: 'DELETE',
        })
        expect(c.commit).toHaveBeenCalledWith('setData', expect.anything())
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'gui/init', { root: true })
    })

    it('initStore skips migrations when keys are absent', async () => {
        const c = ctx({ rootState: { instancesDB: 'other' } })
        await actions.initStore(c as never, { value: { remoteprinters: { printers: [] }, dashboard: {} } } as never)
        expect(c.dispatch).not.toHaveBeenCalledWith('remoteprinters/initStore', expect.anything())
        expect(c.dispatch).not.toHaveBeenCalledWith('saveSetting', expect.anything())
        expect(c.commit).toHaveBeenCalledWith('setData', expect.anything())
    })

    it('initDb posts defaults per namespace and re-inits', async () => {
        fetchMock.mockImplementation(async (url: unknown) => {
            if (String(url).includes('default.json'))
                return jsonResponse({ webcams: { cam1: { name: 'c' } }, general: { printername: 'E3' } })
            return jsonResponse({})
        })
        const c = ctx()
        await actions.initDb(c as never)
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/server/database/item'),
            expect.objectContaining({ method: 'POST' })
        )
        const bodies = fetchMock.mock.calls
            .filter(([, opts]) => (opts as { method?: string })?.method === 'POST')
            .map(([, opts]) => JSON.parse((opts as { body: string }).body))
        expect(bodies).toContainEqual(expect.objectContaining({ namespace: 'webcams', key: 'cam1' }))
        expect(bodies).toContainEqual(expect.objectContaining({ namespace: 'mainsail', key: 'general' }))
        expect(bodies).toContainEqual(expect.objectContaining({ key: 'initVersion' }))
        expect(c.dispatch).toHaveBeenCalledWith('init')
    })

    it('initDb treats a 404 default.json as empty and tolerates a missing response', async () => {
        fetchMock.mockResolvedValueOnce(null as never)
        const c = ctx()
        await actions.initDb(c as never)
        expect(c.dispatch).toHaveBeenCalledWith('init')

        fetchMock.mockReset()
        fetchMock.mockResolvedValue(jsonResponse({ error: { code: 404 } }))
        const c2 = ctx()
        await actions.initDb(c2 as never)
        const posts = fetchMock.mock.calls.filter(([, opts]) => (opts as { method?: string })?.method === 'POST')
        expect(posts).toHaveLength(1)
        expect(c2.dispatch).toHaveBeenCalledWith('init')
    })

    it('saveSetting commits, skips excluded keys and emits', () => {
        const c = ctx()
        actions.saveSetting(c as never, { name: 'general.printername', value: 'E3' } as never)
        expect(c.commit).toHaveBeenCalledWith('saveSetting', { name: 'general.printername', value: 'E3' })
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ key: 'general.printername' })
        )
        const c2 = ctx()
        actions.saveSetting(c2 as never, { name: 'view.gcodefiles.currentPath', value: 'x' } as never)
        expect(mocks.emit).not.toHaveBeenCalledTimes(2)
    })

    it('saveSetting applies theme logo and primary colors', () => {
        const c = ctx()
        actions.saveSetting(c as never, { name: 'uiSettings.theme', value: 'e3cnc' } as never)
        expect(c.commit).toHaveBeenCalledWith('saveSetting', expect.objectContaining({ name: 'uiSettings.logo' }))
        expect(c.commit).toHaveBeenCalledWith('saveSetting', expect.objectContaining({ name: 'uiSettings.primary' }))
        const c2 = ctx()
        actions.saveSetting(c2 as never, { name: 'uiSettings.theme', value: 'mainsail' } as never)
        expect(c2.commit).toHaveBeenCalledWith('saveSetting', expect.objectContaining({ name: 'uiSettings.logo' }))
        const c3 = ctx()
        actions.saveSetting(c3 as never, { name: 'uiSettings.theme', value: 'unknown-theme' } as never)
        expect(c3.commit).toHaveBeenCalledTimes(1)
    })

    it('updateSettings merges object values and emits', () => {
        const c = ctx()
        actions.updateSettings(
            c as never,
            {
                keyName: 'general',
                newVal: { printername: 'E3' },
                value: { general: { language: 'en' } },
            } as never
        )
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({
                key: 'general',
                value: expect.objectContaining({ printername: 'E3', language: 'en' }),
            })
        )
        const c2 = ctx()
        actions.updateSettings(c2 as never, { keyName: 'general', newVal: 'plain' } as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ key: 'general', value: 'plain' })
        )
    })

    it('updateSettings skips merging for string and array values', () => {
        const c = ctx()
        actions.updateSettings(
            c as never,
            {
                keyName: 'general',
                newVal: { a: 1 },
                value: { general: 'string-value' },
            } as never
        )
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ value: { a: 1 } })
        )
        const c2 = ctx()
        mocks.emit.mockClear()
        actions.updateSettings(
            c2 as never,
            {
                keyName: 'general',
                newVal: { a: 1 },
                value: { general: [1, 2] },
            } as never
        )
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ value: { a: 1 } })
        )
    })

    it('view setters commit and persist via updateSettings', () => {
        const c = ctx()
        actions.setGcodefilesMetadata(c as never, { name: 'size', value: true } as never)
        expect(c.commit).toHaveBeenCalledWith('setGcodefilesMetadata', { name: 'size', value: true })
        expect(c.dispatch).toHaveBeenCalledWith(
            'updateSettings',
            expect.objectContaining({ keyName: 'view.gcodefiles.hideMetadataColumns' })
        )
        const c2 = ctx()
        actions.setGcodefilesShowHiddenFiles(c2 as never, true as never)
        expect(c2.dispatch).toHaveBeenCalledWith(
            'updateSettings',
            expect.objectContaining({ keyName: 'view.gcodefiles.showHiddenFiles' })
        )
        const c3 = ctx()
        actions.setCurrentWebcam(c3 as never, { page: 'dashboard', value: 'cam1' } as never)
        expect(c3.dispatch).toHaveBeenCalledWith(
            'updateSettings',
            expect.objectContaining({ keyName: 'view.webcam.currentCam' })
        )
        const c4 = ctx()
        actions.setTempchartDatasetAdditionalSensorSetting(
            c4 as never,
            { objectName: 'extruder', dataset: 's', value: true } as never
        )
        expect(c4.dispatch).toHaveBeenCalledWith(
            'updateSettings',
            expect.objectContaining({ keyName: 'view.tempchart' })
        )
    })

    it('resetMoonrakerDB resets a namespaced key with defaults and reloads', async () => {
        fetchMock.mockImplementation(async (url: unknown) => {
            const u = String(url)
            if (u.includes('default.json')) return jsonResponse({ webcams: { cam1: { name: 'c' } } })
            if (u.includes('namespace=webcams') && !u.includes('key='))
                return jsonResponse({ result: { value: { old: {} } } })
            return jsonResponse({})
        })
        const c = ctx()
        await actions.resetMoonrakerDB(c as never, ['webcams'] as never)
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('namespace=webcams&key=old'), {
            method: 'DELETE',
        })
    })

    it('resetMoonrakerDB handles history jobs, totals and plain keys', async () => {
        fetchMock.mockImplementation(async (url: unknown) => {
            if (String(url).includes('default.json')) return jsonResponse({ general: { printername: 'E3' } })
            return jsonResponse({})
        })
        const c = ctx()
        await actions.resetMoonrakerDB(c as never, ['history_jobs', 'history_totals', 'general', 'other'] as never)
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/server/history/job?all=true'), {
            method: 'DELETE',
        })
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/server/history/reset_totals'), {
            method: 'POST',
        })
        const posts = fetchMock.mock.calls.filter(([, opts]) => (opts as { method?: string })?.method === 'POST')
        expect(posts.some(([, opts]) => ((opts as { body?: string }).body ?? '').includes('"key":"general"'))).toBe(
            true
        )
    })

    it('resetMoonrakerDB tolerates a failing default.json fetch', async () => {
        fetchMock.mockImplementation(async (url: unknown) => {
            if (String(url).includes('default.json')) throw new Error('offline')
            return jsonResponse({})
        })
        const c = ctx()
        await actions.resetMoonrakerDB(c as never, ['general'] as never)
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('namespace=mainsail&key=general'), {
            method: 'DELETE',
        })
    })

    it('backupMoonrakerDB downloads filtered namespaces', async () => {
        fetchMock.mockImplementation(async (url: unknown) => {
            const u = String(url)
            if (u.includes('namespace=timelapse')) return jsonResponse({ result: { value: { framerate: 30 } } })
            if (u.includes('namespace=webcams')) return jsonResponse({ result: {} })
            if (u.includes('namespace=mainsail'))
                return jsonResponse({
                    result: { value: { view: { timelapse: { currentPath: 'x', keep: 1 } }, general: 'plain' } },
                })
            return jsonResponse({})
        })
        const captured: Record<string, string> = {}
        const createSpy = vi.spyOn(document, 'createElement')
        createSpy.mockImplementation(((tag: string) => {
            const real = Document.prototype.createElement.call(document, tag) as HTMLAnchorElement
            const orig = real.setAttribute.bind(real)
            real.setAttribute = ((k: string, v: string) => {
                captured[k] = v
                return orig(k, v)
            }) as never
            return real as never
        }) as never)
        const c = ctx()
        await actions.backupMoonrakerDB(c as never, ['timelapse', 'webcams', 'view', 'general'] as never)
        createSpy.mockRestore()
        expect(captured['download']).toBe('backup-mainsail.json')
        const backup = JSON.parse(decodeURIComponent(captured['href'].split(',')[1]))
        expect(backup.timelapse).toEqual({ framerate: 30 })
        expect('webcams' in backup).toBe(false)
        expect(backup.view.timelapse).toEqual({ keep: 1 })
        expect('general' in backup).toBe(false)
        expect(document.body.querySelector('a[download="backup-mainsail.json"]')).toBeNull()
    })

    it('restoreMoonrakerDB deletes, restores and reloads', async () => {
        fetchMock.mockImplementation(async (url: unknown, opts: unknown) => {
            const u = String(url)
            if (u.endsWith('/server/database/list'))
                return jsonResponse({ result: { namespaces: ['mainsail', 'webcams'] } })
            if (u.includes('namespace=webcams') && !(opts as { method?: string })?.method)
                return jsonResponse({ result: { value: { old: {} } } })
            if (u.endsWith('?namespace=mainsail') && !(opts as { method?: string })?.method)
                return jsonResponse({ result: { value: { general: {} } } })
            return jsonResponse({})
        })
        const c = ctx()
        await actions.restoreMoonrakerDB(
            c as never,
            {
                dbCheckboxes: ['webcams', 'general', 'newkey'],
                restoreObjects: { webcams: { cam2: { x: 1 } }, general: { a: 1 }, newkey: { b: 2 } },
            } as never
        )
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('namespace=webcams&key=old'), {
            method: 'DELETE',
        })
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('namespace=mainsail&key=general'), {
            method: 'DELETE',
        })
    })

    it('restoreMoonrakerDB skips deletes for missing namespaces', async () => {
        fetchMock.mockImplementation(async (url: unknown) => {
            if (String(url).endsWith('/server/database/list')) return jsonResponse({ result: { namespaces: [] } })
            return jsonResponse({})
        })
        const c = ctx()
        await actions.restoreMoonrakerDB(
            c as never,
            {
                dbCheckboxes: ['timelapse', 'general'],
                restoreObjects: { timelapse: { a: 1 }, general: { b: 2 } },
            } as never
        )
        expect(fetchMock).not.toHaveBeenCalledWith(
            expect.stringContaining('&key='),
            expect.objectContaining({ method: 'DELETE' })
        )
    })

    it('setHistoryColumns and toggleStatusInHistoryList persist', () => {
        const c = ctx()
        actions.setHistoryColumns(c as never, { name: 'size', value: true } as never)
        expect(c.dispatch).toHaveBeenCalledWith('updateSettings', expect.objectContaining({ keyName: 'view.history' }))
        const c2 = ctx()
        actions.toggleStatusInHistoryList(c2 as never, 'cancelled' as never)
        expect(c2.commit).toHaveBeenCalledWith('setHistoryHidePrintStatus', ['cancelled'])
        const withEntry = ctx({
            state: {
                ...getDefaultState(),
                view: {
                    ...getDefaultState().view,
                    history: { ...getDefaultState().view.history, hidePrintStatus: ['cancelled'] },
                },
            },
        })
        actions.toggleStatusInHistoryList(withEntry as never, 'cancelled' as never)
        expect(withEntry.commit).toHaveBeenCalledWith('setHistoryHidePrintStatus', [])
    })

    it('saveExpandPanel adds or removes close panels', () => {
        const c = ctx()
        actions.saveExpandPanel(c as never, { name: 'temperature', value: false, viewport: 'widescreen' } as never)
        expect(c.commit).toHaveBeenCalledWith('addClosePanel', { name: 'temperature', viewport: 'widescreen' })
        expect(c.dispatch).toHaveBeenCalledWith(
            'updateSettings',
            expect.objectContaining({ keyName: 'dashboard.nonExpandPanels.widescreen' })
        )
        const c2 = ctx()
        actions.saveExpandPanel(c2 as never, { name: 'temperature', value: true, viewport: 'widescreen' } as never)
        expect(c2.commit).toHaveBeenCalledWith('removeClosePanel', { name: 'temperature', viewport: 'widescreen' })
    })

    it('resetLayout restores the default dashboard layout', () => {
        const c = ctx()
        actions.resetLayout(c as never, 'mobileLayout' as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'saveSetting',
            expect.objectContaining({ name: 'dashboard.mobileLayout', value: getDefaultState().dashboard.mobileLayout })
        )
    })

    it('updateGcodeviewerCache saves only changed keys', () => {
        const c = ctx({
            state: {
                ...getDefaultState(),
                gcodeViewer: {
                    ...getDefaultState().gcodeViewer,
                    klipperCache: { kinematics: 'cartesian', axis_minimum: null, axis_maximum: null },
                },
            },
        })
        actions.updateGcodeviewerCache(c as never, { kinematics: 'cartesian', axis_minimum: [0, 0] } as never)
        expect(c.dispatch).toHaveBeenCalledTimes(1)
        expect(c.dispatch).toHaveBeenCalledWith(
            'saveSetting',
            expect.objectContaining({ name: 'gcodeViewer.klipperCache.axis_minimum' })
        )
    })

    it('announcementDismissFlag logs the payload', () => {
        const logSpy = vi.spyOn(window.console, 'log').mockImplementation(() => {})
        actions.announcementDismissFlag(undefined as never, { id: 1 } as never)
        expect(logSpy).toHaveBeenCalledWith({ id: 1 })
        logSpy.mockRestore()
    })

    it('chart dataset setters commit and persist', () => {
        const c = ctx()
        actions.setChartDatasetStatus(
            c as never,
            { objectName: 'extruder', dataset: 'temperature', value: false } as never
        )
        expect(c.commit).toHaveBeenCalledWith(
            'setChartDatasetStatus',
            expect.objectContaining({ objectName: 'extruder' })
        )
        expect(c.dispatch).toHaveBeenCalledWith(
            'updateSettings',
            expect.objectContaining({ keyName: 'view.tempchart.datasetSettings' })
        )
        const c2 = ctx()
        actions.setDatasetAdditionalSensorStatus(
            c2 as never,
            { objectName: 'extruder', dataset: 's', value: true } as never
        )
        expect(c2.commit).toHaveBeenCalledWith('setDatasetAdditionalSensorStatus', expect.objectContaining({}))
        const c3 = ctx()
        actions.setChartColor(c3 as never, { objectName: 'extruder', value: true } as never)
        expect(c3.commit).toHaveBeenCalledWith(
            'setChartDatasetStatus',
            expect.objectContaining({ dataset: 'color', value: true })
        )
    })

    it('saveFloatingPanelPosition removes, sets or keeps panels', () => {
        const withPanel = ctx({
            state: {
                ...getDefaultState(),
                dashboard: {
                    ...getDefaultState().dashboard,
                    floatingPanels: { p1: { x: 0, y: 0, width: 1, height: 1, zIndex: 1 } },
                },
            },
        })
        actions.saveFloatingPanelPosition(withPanel as never, { id: 'p1', remove: true } as never)
        expect(withPanel.commit).toHaveBeenCalledWith('setFloatingPanels', {})
        const c = ctx()
        const position = { x: 1, y: 1, width: 2, height: 2, zIndex: 1 }
        actions.saveFloatingPanelPosition(c as never, { id: 'p1', position } as never)
        expect(c.commit).toHaveBeenCalledWith('setFloatingPanels', { p1: position })
        const c2 = ctx()
        actions.saveFloatingPanelPosition(c2 as never, { id: 'p1' } as never)
        expect(c2.commit).toHaveBeenCalledWith('setFloatingPanels', {})
    })

    it('bringFloatingPanelToFront raises above the current max', () => {
        const panels = {
            a: { x: 0, y: 0, width: 1, height: 1, zIndex: 1 },
            b: { x: 0, y: 0, width: 1, height: 1, zIndex: 3 },
        }
        const c = ctx({
            state: { ...getDefaultState(), dashboard: { ...getDefaultState().dashboard, floatingPanels: panels } },
        })
        actions.bringFloatingPanelToFront(c as never, 'a' as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'saveFloatingPanelPosition',
            expect.objectContaining({ id: 'a', position: expect.objectContaining({ zIndex: 4 }) })
        )
    })
})
