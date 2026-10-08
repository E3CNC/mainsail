import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/gui/gcodehistory/actions'
import { maxGcodeHistory } from '@/store/variables'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { entries: [] as string[] },
        rootState: {},
        rootGetters: {},
        getters: {},
        ...overrides,
    }
}

describe('gui/gcodehistory/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
        mocks.emitAndWait.mockReset()
        mocks.toastError.mockReset()
    })

    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('upload emits current entries to the db', () => {
        const c = ctx({ state: { entries: ['G28', 'M104'] } })
        actions.upload(c as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ namespace: 'mainsail', key: 'gcodehistory.entries', value: ['G28', 'M104'] })
        )
    })

    it('addToHistory appends and uploads', async () => {
        const c = ctx({ state: { entries: ['G28'] } })
        await actions.addToHistory(c as never, 'M104' as never)
        expect(c.commit).toHaveBeenCalledWith('updateHistory', ['G28', 'M104'])
        expect(c.dispatch).toHaveBeenCalledWith('upload')
    })

    it('addToHistory trims to maxGcodeHistory', async () => {
        const entries = Array.from({ length: maxGcodeHistory }, (_, i) => `G${i}`)
        const c = ctx({ state: { entries } })
        await actions.addToHistory(c as never, 'NEW' as never)
        const updated = (c.commit as ReturnType<typeof vi.fn>).mock.calls[0][1] as string[]
        expect(updated).toHaveLength(maxGcodeHistory)
        expect(updated[updated.length - 1]).toBe('NEW')
        expect(updated).not.toContain('G0')
        expect(c.dispatch).toHaveBeenCalledWith('upload')
    })
})
