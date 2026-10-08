import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ emit: vi.fn(), emitAndWait: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit, emitAndWait: mocks.emitAndWait }),
    $toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}))

import { actions } from '@/store/gui/macros/actions'
import { getDefaultState as getGuiDefaultState } from '@/store/gui/index'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: { macrogroups: {} as Record<string, unknown> },
        rootState: {} as Record<string, unknown>,
        rootGetters: {},
        getters: {},
        ...overrides,
    }
}

function group(name = 'Main') {
    return {
        id: null,
        name,
        color: 'primary',
        showInStandby: true,
        showInPrinting: true,
        showInPause: true,
    }
}

describe('gui/macros/actions', () => {
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

    it('saveSetting proxies to gui/saveSetting with macros prefix', () => {
        const c = ctx()
        actions.saveSetting(c as never, { name: 'mode', value: 'expert' } as never)
        expect(c.dispatch).toHaveBeenCalledWith(
            'gui/saveSetting',
            { name: 'macros.mode', value: 'expert' },
            { root: true }
        )
    })

    it('groupUpload emits the group to the db', () => {
        const g = group()
        const c = ctx({ state: { macrogroups: { abc: g } } })
        actions.groupUpload(c as never, 'abc' as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.post_item',
            expect.objectContaining({ namespace: 'mainsail', key: 'macros.macrogroups.abc', value: g })
        )
    })

    it('groupStore commits, uploads and returns the id', async () => {
        const c = ctx()
        const id = await actions.groupStore(c as never, { values: group() } as never)
        expect(typeof id).toBe('string')
        expect(c.commit).toHaveBeenCalledWith('groupStore', expect.objectContaining({ id }))
        expect(c.dispatch).toHaveBeenCalledWith('groupUpload', id)
    })

    it('groupUpdate commits and uploads', () => {
        const c = ctx()
        actions.groupUpdate(c as never, { id: 'abc', values: { name: 'New' } } as never)
        expect(c.commit).toHaveBeenCalledWith('groupUpdate', { id: 'abc', values: { name: 'New' } })
        expect(c.dispatch).toHaveBeenCalledWith('groupUpload', 'abc')
    })

    it('addMacroToMacrogroup commits and uploads', () => {
        const c = ctx()
        actions.addMacroToMacrogroup(c as never, { id: 'abc', macro: 'M600' } as never)
        expect(c.commit).toHaveBeenCalledWith('addMacroToMacrogroup', { id: 'abc', macro: 'M600' })
        expect(c.dispatch).toHaveBeenCalledWith('groupUpload', 'abc')
    })

    it('updateMacroFromMacrogroup uploads unless skipUpload is set', () => {
        const c = ctx()
        const payload = { id: 'abc', macro: 'M600', option: 'color', value: 'primary' }
        actions.updateMacroFromMacrogroup(c as never, payload as never)
        expect(c.commit).toHaveBeenCalledWith('updateMacroFromMacrogroup', payload)
        expect(c.dispatch).toHaveBeenCalledWith('groupUpload', 'abc')
        const c2 = ctx()
        actions.updateMacroFromMacrogroup(c2 as never, { ...payload, skipUpload: true } as never)
        expect(c2.dispatch).not.toHaveBeenCalled()
    })

    it('removeMacroFromMacrogroup commits and uploads', () => {
        const c = ctx()
        actions.removeMacroFromMacrogroup(c as never, { id: 'abc', macro: 'M600' } as never)
        expect(c.commit).toHaveBeenCalledWith('removeMacroFromMacrogroup', { id: 'abc', macro: 'M600' })
        expect(c.dispatch).toHaveBeenCalledWith('groupUpload', 'abc')
    })

    it('groupDelete emits db delete and cleans dashboard layouts', () => {
        const c = ctx({
            rootState: {
                gui: {
                    dashboard: {
                        ...getGuiDefaultState().dashboard,
                        mobileLayout: [{ name: 'macrogroup_abc', visible: true }],
                        desktopLayout1: [{ name: 'macros', visible: true }],
                    },
                },
            },
        })
        actions.groupDelete(c as never, 'abc' as never)
        expect(c.commit).toHaveBeenCalledWith('groupDelete', 'abc')
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.database.delete_item',
            expect.objectContaining({ key: 'macros.macrogroups.abc' })
        )
        expect(c.commit).toHaveBeenCalledWith(
            'gui/deleteFromDashboardLayout',
            expect.objectContaining({ layoutname: 'mobileLayout' }),
            { root: true }
        )
        expect(c.dispatch).toHaveBeenCalledWith('gui/updateSettings', expect.objectContaining({}), { root: true })
    })

    it('groupDelete skips layouts without the macrogroup and without dashboard', () => {
        const c = ctx({
            rootState: {
                gui: {
                    dashboard: { ...getGuiDefaultState().dashboard, mobileLayout: [{ name: 'other', visible: true }] },
                },
            },
        })
        actions.groupDelete(c as never, 'abc' as never)
        expect(c.commit).toHaveBeenCalledWith('groupDelete', 'abc')
        expect(c.commit).not.toHaveBeenCalledWith('gui/deleteFromDashboardLayout', expect.anything(), expect.anything())
        const c2 = ctx({ rootState: {} })
        actions.groupDelete(c2 as never, 'abc' as never)
        expect(c2.commit).toHaveBeenCalledWith('groupDelete', 'abc')
        expect(c2.dispatch).not.toHaveBeenCalled()
    })
})
