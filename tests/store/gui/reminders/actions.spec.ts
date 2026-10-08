import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/gui/reminders/actions'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { reminders: {} },
        rootState: {},
        rootGetters: {},
        getters: {},
        ...overrides,
    }
}

const reminder = {
    name: 'clean filter',
    start_total_print_time: 100,
    time_delta: 50,
    repeating: false,
    snooze_print_hours_timestamps: [],
    snooze_epoch_timestamps: [],
}

describe('gui/reminders/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('init requests the reminders namespace', () => {
        const c = ctx()
        actions.init(c as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.get_item',
            { namespace: 'reminders' },
            { action: 'gui/reminders/initStore' }
        )
    })

    it('initStore resets, stores and removes the init module', async () => {
        const c = ctx()
        const payload = { value: { r1: { ...reminder, id: 'r1' } } }
        await actions.initStore(c as never, payload as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
        expect(c.commit).toHaveBeenCalledWith('initStore', payload)
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'gui/reminders/init', { root: true })
    })

    it('upload posts the reminder value', () => {
        const c = ctx()
        actions.upload(c as never, { id: 'r1', value: { ...reminder, id: 'r1' } } as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.database.post_item', {
            namespace: 'reminders',
            key: 'r1',
            value: { ...reminder, id: 'r1' },
        })
    })

    it('store commits and uploads the new reminder', () => {
        const stored = { ...reminder, id: 'new-id' }
        const c = ctx({ state: { reminders: {} } })
        // emulate the commit making the new reminder visible for the upload payload
        c.commit.mockImplementation((name: string, payload: { id: string; values: object }) => {
            if (name === 'store')
                (c.state.reminders as Record<string, unknown>)[payload.id] = { ...payload.values, id: payload.id }
        })
        actions.store(c as never, { values: { ...reminder } } as never)
        expect(c.commit).toHaveBeenCalledWith('store', expect.objectContaining({ values: { ...reminder } }))
        const id = (c.commit.mock.calls[0][1] as { id: string }).id
        expect(c.dispatch).toHaveBeenCalledWith('upload', { id, value: { ...reminder, id } })
        expect(stored.name).toBe('clean filter')
    })

    it('update commits and uploads the current state value', () => {
        const c = ctx({ state: { reminders: { r1: { ...reminder, id: 'r1' } } } })
        actions.update(c as never, { id: 'r1', name: 'renamed' } as never)
        expect(c.commit).toHaveBeenCalledWith('update', { id: 'r1', name: 'renamed' })
        expect(c.dispatch).toHaveBeenCalledWith('upload', { id: 'r1', value: { ...reminder, id: 'r1' } })
    })

    it('delete commits and emits the delete item event', () => {
        const c = ctx()
        actions.delete(c as never, 'r1')
        expect(c.commit).toHaveBeenCalledWith('delete', 'r1')
        expect(mocks.emit).toHaveBeenCalledWith('server.database.delete_item', { namespace: 'reminders', key: 'r1' })
    })

    it('repeat returns early for unknown ids', () => {
        const c = ctx({ state: { reminders: {} }, getters: { getReminder: vi.fn() } })
        actions.repeat(c as never, { id: 'missing' } as never)
        expect(c.dispatch).not.toHaveBeenCalled()
    })

    it('repeat appends print-time and epoch snooze timestamps', () => {
        const existing = { ...reminder, id: 'r1' }
        const c = ctx({
            state: { reminders: { r1: existing } },
            getters: { getReminder: () => existing },
            rootState: { server: { history: { job_totals: { total_print_time: 500 } } } },
        })
        actions.repeat(c as never, { id: 'r1' } as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'update',
            expect.objectContaining({
                id: 'r1',
                snooze_print_hours_timestamps: [500],
            })
        )
        const payload = c.dispatch.mock.calls[0][1] as { snooze_epoch_timestamps: number[] }
        expect(payload.snooze_epoch_timestamps).toHaveLength(1)
    })

    it('repeat falls back to zero print time when history is missing', () => {
        const existing = { ...reminder, id: 'r1' }
        const c = ctx({
            state: { reminders: { r1: existing } },
            getters: { getReminder: () => existing },
            rootState: {},
        })
        actions.repeat(c as never, { id: 'r1' } as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'update',
            expect.objectContaining({ snooze_print_hours_timestamps: [0] })
        )
    })

    it('repeat preserves existing snooze timestamps', () => {
        const existing = {
            ...reminder,
            id: 'r1',
            snooze_print_hours_timestamps: [100],
            snooze_epoch_timestamps: [1000],
        }
        const c = ctx({
            state: { reminders: { r1: existing } },
            getters: { getReminder: () => existing },
            rootState: { server: { history: { job_totals: { total_print_time: 200 } } } },
        })
        actions.repeat(c as never, { id: 'r1' } as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'update',
            expect.objectContaining({ snooze_print_hours_timestamps: [100, 200] })
        )
    })
})
