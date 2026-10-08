import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    fullPath: '/',
}))

vi.mock('@/plugins/router', () => ({
    default: {
        get currentRoute() {
            return { value: { fullPath: mocks.fullPath } }
        },
        push: (...args: unknown[]) => mocks.push(...args),
    },
}))

import { actions } from '@/store/actions'

function ctx(overrides = {}) {
    return {
        commit: vi.fn(),
        dispatch: vi.fn(),
        state: {},
        rootState: {},
        rootGetters: {},
        getters: {},
        ...overrides,
    }
}

describe('store/actions', () => {
    beforeEach(() => {
        mocks.push.mockReset()
        mocks.fullPath = '/'
    })

    it('switchToDashboard navigates home from other routes', () => {
        mocks.fullPath = '/console'
        actions.switchToDashboard({} as never)
        expect(mocks.push).toHaveBeenCalledWith('/')
    })

    it('switchToDashboard stays when already home', () => {
        mocks.fullPath = '/'
        actions.switchToDashboard({} as never)
        expect(mocks.push).not.toHaveBeenCalled()
    })

    it('changePrinter resets modules and applies the farm socket', () => {
        const c = ctx({
            getters: {
                'farm/printer1/getSocketData': { hostname: 'a.local', port: 7125, path: '/x' },
            },
        })
        actions.changePrinter(c as never, { printer: 'printer1' })
        expect(c.dispatch).toHaveBeenCalledWith('files/reset')
        expect(c.dispatch).toHaveBeenCalledWith('gui/reset')
        expect(c.dispatch).toHaveBeenCalledWith('printer/reset')
        expect(c.dispatch).toHaveBeenCalledWith('server/reset')
        expect(c.dispatch).toHaveBeenCalledWith('socket/reset')
        expect(c.dispatch).toHaveBeenCalledWith('socket/setSocket', {
            hostname: 'a.local',
            port: 7125,
            path: '/x',
        })
    })

    it('setNaviDrawer commits through', () => {
        const c = ctx()
        actions.setNaviDrawer(c as never, true)
        expect(c.commit).toHaveBeenCalledWith('setNaviDrawer', true)
    })

    it('importConfigJson stores json instances and returns early', async () => {
        const c = ctx()
        await actions.importConfigJson(c as never, {
            instancesDB: 'json',
            instances: [{ hostname: 'a.local' }],
        })
        expect(c.commit).toHaveBeenCalledWith('setInstancesDB', 'json')
        expect(c.commit).toHaveBeenCalledWith('setConfigInstances', [{ hostname: 'a.local' }])
        expect(c.commit).not.toHaveBeenCalledWith('socket/setData', expect.anything())
    })

    it('importConfigJson with browser db only sets the backend', async () => {
        const c = ctx()
        await actions.importConfigJson(c as never, { instancesDB: 'browser' })
        expect(c.commit).toHaveBeenCalledWith('setInstancesDB', 'browser')
        expect(c.commit).not.toHaveBeenCalledWith('setConfigInstances', expect.anything())
    })

    it('importConfigJson with json db but no instances only sets the backend', async () => {
        const c = ctx()
        await actions.importConfigJson(c as never, { instancesDB: 'json' })
        expect(c.commit).toHaveBeenCalledWith('setInstancesDB', 'json')
        expect(c.commit).not.toHaveBeenCalledWith('setConfigInstances', expect.anything())
    })

    it('importConfigJson applies moonraker socket fields', async () => {
        const c = ctx()
        await actions.importConfigJson(c as never, {
            hostname: 'printer.local',
            port: 7125,
            path: 'prefix',
        })
        expect(c.commit).toHaveBeenCalledWith('socket/setData', { hostname: 'printer.local' })
        expect(c.commit).toHaveBeenCalledWith('socket/setData', { port: 7125 })
        expect(c.commit).toHaveBeenCalledWith('socket/setData', { route_prefix: 'prefix' })
    })

    it('importConfigJson skips empty moonraker fields', async () => {
        const c = ctx()
        await actions.importConfigJson(c as never, {})
        expect(c.commit).not.toHaveBeenCalled()
    })
})
