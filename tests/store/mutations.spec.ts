import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mutations } from '@/store/mutations'

function state(overrides = {}) {
    return {
        packageVersion: '0.0.0',
        debugMode: false,
        naviDrawer: null,
        instancesDB: 'moonraker',
        configInstances: [],
        ...overrides,
    } as never
}

describe('store/mutations', () => {
    beforeEach(() => {
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
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })
    it('setNaviDrawer stores the value and persists to localStorage', () => {
        const s = state()
        mutations.setNaviDrawer(s, true)
        expect((s as { naviDrawer: boolean }).naviDrawer).toBe(true)
        expect(localStorage.getItem('naviDrawer')).toBe('true')
        mutations.setNaviDrawer(s, null)
        expect((s as { naviDrawer: null }).naviDrawer).toBeNull()
    })

    it('setInstancesDB stores the backend', () => {
        const s = state()
        mutations.setInstancesDB(s, 'browser')
        expect((s as { instancesDB: string }).instancesDB).toBe('browser')
    })

    it('setConfigInstances stores the list', () => {
        const s = state()
        const instances = [{ hostname: 'a.local' }, { hostname: 'b.local', port: 7125 }] as never
        mutations.setConfigInstances(s, instances)
        expect((s as { configInstances: unknown }).configInstances).toEqual(instances)
    })
})
