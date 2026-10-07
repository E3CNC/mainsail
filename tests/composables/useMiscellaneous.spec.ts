import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { state: Record<string, any> } = { state: {} }

vi.mock('vuex', () => ({
    useStore: () => store,
}))

import { useMiscellaneous } from '@/composables/useMiscellaneous'

describe('useMiscellaneous', () => {
    beforeEach(() => {
        store.state = reactive({ printer: {} })
    })

    it('collects supported light objects', () => {
        store.state.printer = {
            'neopixel chamber': {},
            'led status': {},
            extruder: {},
        }
        expect(useMiscellaneous().lights.value).toEqual([
            { type: 'neopixel', name: 'chamber' },
            { type: 'led', name: 'status' },
        ])
    })

    it('skips underscore-prefixed names and unsupported types', () => {
        store.state.printer = {
            'neopixel _hidden': {},
            heater_bed: {},
            'pca9632 display': {},
        }
        expect(useMiscellaneous().lights.value).toEqual([{ type: 'pca9632', name: 'display' }])
    })

    it('returns an empty list when no lights exist', () => {
        expect(useMiscellaneous().lights.value).toEqual([])
    })
})
