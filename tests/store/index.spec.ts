import { describe, expect, it } from 'vitest'
import { getDefaultState } from '@/store/index'

describe('store/index', () => {
    it('getDefaultState returns the root defaults', () => {
        const s = getDefaultState()
        expect(s.naviDrawer).toBeNull()
        expect(s.instancesDB).toBe('moonraker')
        expect(s.configInstances).toEqual([])
        expect(typeof s.packageVersion).toBe('string')
        expect(typeof s.debugMode).toBe('boolean')
    })

    it('exposes a vuex store with the registered modules', async () => {
        const mod = await import('@/store/index')
        const store = mod.default
        expect(store).toBeTruthy()
        expect(store.state.naviDrawer).toBeNull()
        expect(store.hasModule(['farm'])).toBe(true)
        expect(store.hasModule(['editor'])).toBe(true)
        expect(store.hasModule(['gcodeviewer'])).toBe(true)
    })
})
