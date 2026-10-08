import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/gui/maintenance/actions'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { entries: {} },
        rootState: {},
        rootGetters: { 'socket/getUrl': 'http://localhost' },
        getters: {},
        ...overrides,
    }
}

const entry = {
    name: 'belt check',
    note: 'note',
    start_time: 1000,
    end_time: null,
    start_filament: 0,
    end_filament: null,
    start_printtime: 0,
    end_printtime: null,
    last_entry: null,
    reminder: {
        type: 'repeat',
        filament: { bool: false, value: null },
        printtime: { bool: false, value: null },
        date: { bool: false, value: null },
    },
}

function jsonResponse(payload: unknown, status = 200) {
    return { status, json: async () => payload }
}

describe('gui/maintenance/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
        vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('init requests the maintenance namespace', () => {
        const c = ctx()
        actions.init(c as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.get_item',
            { namespace: 'maintenance' },
            { action: 'gui/maintenance/initStore' }
        )
    })

    it('initDb posts MAINTENANCE_INIT and returns when the defaults response is not ok', async () => {
        const c = ctx()
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 404 })
        await actions.initDb(c as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ namespace: 'maintenance', value: { name: 'MAINTENANCE_INIT' } })
        )
        expect(c.dispatch).not.toHaveBeenCalledWith('store', expect.anything())
    })

    it('initDb posts MAINTENANCE_INIT when defaults contain no entries', async () => {
        const c = ctx()
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse({ entries: [] }))
        await actions.initDb(c as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ value: { name: 'MAINTENANCE_INIT' } })
        )
        expect(fetch as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1)
    })

    it('initDb treats a fetch rejection as empty entries', async () => {
        const c = ctx()
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('nope'))
        await actions.initDb(c as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ value: { name: 'MAINTENANCE_INIT' } })
        )
    })

    it('initDb stores defaults with history totals and reminder fallbacks', async () => {
        const c = ctx()
        const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ entries: [{ name: 'belts', reminder: { type: 'repeat' } }] }))
            .mockResolvedValueOnce(
                jsonResponse({ result: { job_totals: { total_filament_used: 5, total_print_time: 60 } } })
            )
        await actions.initDb(c as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'store',
            expect.objectContaining({ entry: expect.objectContaining({ name: 'belts' }) })
        )
        const stored = c.dispatch.mock.calls[0][1] as { entry: typeof entry }
        expect(stored.entry.start_filament).toBe(5)
        expect(stored.entry.start_printtime).toBe(60)
        expect(stored.entry.reminder.filament).toEqual({ bool: false, value: null })
        expect(stored.entry.reminder.type).toBe('repeat')
    })

    it('initDb falls back to zero totals when the totals response is not ok', async () => {
        const c = ctx()
        const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ entries: [{ name: 'belts' }] }))
            .mockResolvedValueOnce({ status: 500 })
        await actions.initDb(c as never)
        const stored = c.dispatch.mock.calls[0][1] as { entry: typeof entry }
        expect(stored.entry.start_filament).toBe(0)
        expect(stored.entry.start_printtime).toBe(0)
    })

    it('initDb falls back to zero totals when the totals fetch rejects', async () => {
        const c = ctx()
        const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ entries: [{ name: 'belts' }] }))
            .mockRejectedValueOnce(new Error('nope'))
        await actions.initDb(c as never)
        const stored = c.dispatch.mock.calls[0][1] as { entry: typeof entry }
        expect(stored.entry.start_filament).toBe(0)
    })

    it('initStore resets, strips MAINTENANCE_INIT and removes the init module', async () => {
        const c = ctx()
        const payload = { value: { k1: { name: 'MAINTENANCE_INIT' }, k2: { ...entry } } }
        await actions.initStore(c as never, payload as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
        const stored = c.commit.mock.calls.find(([name]) => name === 'initStore')?.[1] as Record<string, unknown>
        expect(stored).not.toHaveProperty('k1')
        expect(stored).toHaveProperty('k2')
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'gui/maintenance/init', { root: true })
    })

    it('initStore handles a missing value payload', async () => {
        const c = ctx()
        await actions.initStore(c as never, {} as never)
        expect(c.commit).toHaveBeenCalledWith('initStore', {})
    })

    it('upload posts the entry to the maintenance namespace', () => {
        const c = ctx()
        actions.upload(c as never, { id: 'k1', value: entry } as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.database.post_item', {
            namespace: 'maintenance',
            key: 'k1',
            value: entry,
        })
    })

    it('store commits and uploads the new entry', () => {
        const c = ctx({ state: { entries: {} } })
        actions.store(c as never, { entry } as never)
        expect(c.commit).toHaveBeenCalledWith('store', expect.objectContaining({ values: entry }))
        const id = (c.commit.mock.calls[0][1] as { id: string }).id
        expect(c.dispatch).toHaveBeenCalledWith('upload', { id, value: undefined })
    })

    it('update strips the id, commits and uploads the remainder', () => {
        const c = ctx()
        actions.update(c as never, { id: 'k1', note: 'new' } as never)
        expect(c.commit).toHaveBeenCalledWith('update', { id: 'k1', entry: { note: 'new' } })
        expect(c.dispatch).toHaveBeenCalledWith('upload', { id: 'k1', value: { note: 'new' } })
    })

    it('delete commits and emits the delete item event', () => {
        const c = ctx()
        actions.delete(c as never, 'k1')
        expect(c.commit).toHaveBeenCalledWith('delete', 'k1')
        expect(mocks.emit).toHaveBeenCalledWith('server.database.delete_item', { namespace: 'maintenance', key: 'k1' })
    })

    it('perform returns early when the entry is missing', () => {
        const c = ctx({ state: { entries: {} } })
        actions.perform(c as never, { id: 'missing', note: 'x' } as never)
        expect(c.dispatch).not.toHaveBeenCalled()
    })

    it('perform closes a one-time entry without storing a follow-up', () => {
        const c = ctx({
            state: { entries: { k1: { ...entry, reminder: { ...entry.reminder, type: 'one-time' } } } },
            rootState: { server: { history: { job_totals: { total_filament_used: 9, total_print_time: 90 } } } },
        })
        actions.perform(c as never, { id: 'k1', note: ' done ' } as never)
        expect(c.dispatch).toHaveBeenCalledWith('update', expect.objectContaining({ perform_note: 'done' }))
        expect(c.dispatch).not.toHaveBeenCalledWith('store', expect.anything())
    })

    it('perform stores a follow-up entry for repeat reminders and nulls blank notes', () => {
        const c = ctx({
            state: { entries: { k1: { ...entry } } },
            rootState: { server: { history: { job_totals: { total_filament_used: 9, total_print_time: 90 } } } },
        })
        actions.perform(c as never, { id: 'k1', note: '   ' } as never)
        expect(c.dispatch).toHaveBeenCalledWith('update', expect.objectContaining({ perform_note: null }))
        expect(c.dispatch).toHaveBeenCalledWith(
            'store',
            expect.objectContaining({
                entry: expect.objectContaining({ name: entry.name, last_entry: 'k1', end_time: null }),
            })
        )
    })

    it('perform falls back to zero totals when history is missing', () => {
        const c = ctx({ state: { entries: { k1: { ...entry } } }, rootState: {} })
        actions.perform(c as never, { id: 'k1', note: 'x' } as never)
        const updated = c.dispatch.mock.calls.find(([name]) => name === 'update')?.[1] as {
            end_filament: number
            end_printtime: number
        }
        expect(updated.end_filament).toBe(0)
        expect(updated.end_printtime).toBe(0)
    })
})
