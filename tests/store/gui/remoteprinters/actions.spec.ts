import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/gui/remoteprinters/actions'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { printers: {} },
        rootState: {},
        rootGetters: {},
        getters: {},
        ...overrides,
    }
}

const printer = { hostname: 'printer1', port: 7125, path: '', name: 'Printer 1', settings: {} }

function stubLocalStorage() {
    let store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = value
        },
        removeItem: (key: string) => {
            delete store[key]
        },
        clear: () => {
            store = {}
        },
    })
}

describe('gui/remoteprinters/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
        stubLocalStorage()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('reset unregisters every printer and commits reset', () => {
        const c = ctx({ state: { printers: { a: { ...printer }, b: { ...printer } } } })
        actions.reset(c as never)
        expect(c.dispatch).toHaveBeenCalledWith('farm/unregisterPrinter', 'a', { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('farm/unregisterPrinter', 'b', { root: true })
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('reset works with no printers', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.dispatch).not.toHaveBeenCalledWith('farm/unregisterPrinter', expect.anything(), expect.anything())
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('initFromLocalstorage inits from configInstances when not in browser mode', () => {
        const c = ctx({ rootState: { instancesDB: 'moonraker', configInstances: [{ ...printer }] } })
        actions.initFromLocalstorage(c as never)
        expect(c.dispatch).toHaveBeenCalledWith('initStore', expect.objectContaining({}))
        const printers = c.dispatch.mock.calls[0][1] as Record<string, unknown>
        expect(Object.keys(printers)).toHaveLength(1)
    })

    it('initFromLocalstorage reads localStorage in browser mode', () => {
        localStorage.setItem('printers', JSON.stringify([{ ...printer }]))
        const c = ctx({ rootState: { instancesDB: 'browser' } })
        actions.initFromLocalstorage(c as never)
        expect(c.dispatch).toHaveBeenCalledWith('initStore', expect.objectContaining({}))
    })

    it('initFromLocalstorage handles missing localStorage content', () => {
        const c = ctx({ rootState: { instancesDB: 'browser' } })
        actions.initFromLocalstorage(c as never)
        // '{}' parses to a non-array, so initStore is skipped
        expect(c.dispatch).not.toHaveBeenCalledWith('initStore', expect.anything())
    })

    it('initStore resets, stores each printer and registers it with the farm', async () => {
        const c = ctx()
        await actions.initStore(c as never, { p1: { ...printer } } as never)
        expect(c.dispatch).toHaveBeenCalledWith('reset')
        expect(c.commit).toHaveBeenCalledWith('store', { id: 'p1', values: { ...printer } })
        expect(c.dispatch).toHaveBeenCalledWith(
            'farm/registerPrinter',
            expect.objectContaining({ id: 'p1', hostname: 'printer1', port: 7125 }),
            { root: true }
        )
    })

    it('initStore applies port and path fallbacks', async () => {
        const c = ctx()
        await actions.initStore(c as never, { p1: { hostname: 'h' } } as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'farm/registerPrinter',
            expect.objectContaining({ id: 'p1', hostname: 'h', port: 7125, path: '' }),
            { root: true }
        )
    })

    it('upload writes browser printers to localStorage', () => {
        const c = ctx({
            state: { printers: { p1: { ...printer } } },
            rootState: { instancesDB: 'browser' },
        })
        actions.upload(c as never, 'p1')
        const stored = JSON.parse(localStorage.getItem('printers') ?? '[]') as { hostname: string }[]
        expect(stored).toHaveLength(1)
        expect(stored[0].hostname).toBe('printer1')
        expect(mocks.emit).not.toHaveBeenCalled()
    })

    it('upload posts to moonraker when the id exists', () => {
        const c = ctx({
            state: { printers: { p1: { ...printer } } },
            rootState: { instancesDB: 'moonraker' },
        })
        actions.upload(c as never, 'p1')
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ namespace: 'mainsail', key: 'remoteprinters.printers.p1' })
        )
    })

    it('upload skips moonraker posts for unknown ids', () => {
        const c = ctx({ state: { printers: {} }, rootState: { instancesDB: 'moonraker' } })
        actions.upload(c as never, 'missing')
        expect(mocks.emit).not.toHaveBeenCalled()
    })

    it('upload does nothing for other instance databases', () => {
        const c = ctx({ state: { printers: { p1: { ...printer } } }, rootState: { instancesDB: 'other' } })
        actions.upload(c as never, 'p1')
        expect(mocks.emit).not.toHaveBeenCalled()
    })

    it('store commits, registers with the farm and uploads', () => {
        const c = ctx()
        actions.store(c as never, { values: { ...printer } } as never)
        expect(c.commit).toHaveBeenCalledWith('store', expect.objectContaining({ values: { ...printer } }))
        const id = (c.commit.mock.calls[0][1] as { id: string }).id
        expect(c.dispatch).toHaveBeenCalledWith('farm/registerPrinter', expect.objectContaining({ id }), { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('upload', id)
    })

    it('store applies hostname and port fallbacks for farm registration', () => {
        const c = ctx()
        actions.store(c as never, { values: { name: 'n' } } as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'farm/registerPrinter',
            expect.objectContaining({ hostname: '', port: 7125, path: '' }),
            { root: true }
        )
    })

    it('update commits, updates the farm and uploads', () => {
        const c = ctx()
        actions.update(c as never, { id: 'p1', values: { name: 'new' } } as never)
        expect(c.commit).toHaveBeenCalledWith('update', { id: 'p1', values: { name: 'new' } })
        expect(c.dispatch).toHaveBeenCalledWith(
            'farm/updatePrinter',
            { id: 'p1', values: { name: 'new' } },
            { root: true }
        )
        expect(c.dispatch).toHaveBeenCalledWith('upload', 'p1')
    })

    it('updateSettings commits a settings update and uploads', () => {
        const c = ctx()
        actions.updateSettings(c as never, { id: 'p1', values: { theme: 'dark' } } as never)
        expect(c.commit).toHaveBeenCalledWith('update', { id: 'p1', values: { settings: { theme: 'dark' } } })
        expect(c.dispatch).toHaveBeenCalledWith('upload', 'p1')
    })

    it('delete in browser mode commits, unregisters and uploads', () => {
        const c = ctx({ rootState: { instancesDB: 'browser' } })
        actions.delete(c as never, 'p1')
        expect(c.commit).toHaveBeenCalledWith('delete', 'p1')
        expect(c.dispatch).toHaveBeenCalledWith('farm/unregisterPrinter', 'p1', { root: true })
        expect(c.dispatch).toHaveBeenCalledWith('upload')
        expect(mocks.emit).not.toHaveBeenCalled()
    })

    it('delete in moonraker mode emits the delete item event', () => {
        const c = ctx({ rootState: { instancesDB: 'moonraker' } })
        actions.delete(c as never, 'p1')
        expect(c.commit).toHaveBeenCalledWith('delete', 'p1')
        expect(c.dispatch).toHaveBeenCalledWith('farm/unregisterPrinter', 'p1', { root: true })
        expect(mocks.emit).toHaveBeenCalledWith('server.database.delete_item', {
            namespace: 'mainsail',
            key: 'remoteprinters.printers.p1',
        })
    })
})
