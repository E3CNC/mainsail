import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { state: Record<string, any> } = { state: {} }

vi.mock('vuex', () => ({
    useStore: () => store,
}))

import { useServices } from '@/composables/useServices'

describe('useServices', () => {
    beforeEach(() => {
        store.state = reactive({
            gui: { uiSettings: {} },
            server: { system_info: { instance_ids: { klipper: 'k1', moonraker: 'm1' } } },
        })
    })

    it('reads instance ids with defaults', () => {
        const s = useServices()
        expect(s.hideOtherInstances.value).toBe(false)
        expect(s.klipperInstance.value).toBe('k1')
        expect(s.moonrakerInstance.value).toBe('m1')
    })

    it('falls back when system info is missing', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.state.server = {} as any
        const s = useServices()
        expect(s.klipperInstance.value).toBe('')
        expect(s.moonrakerInstance.value).toBe('')
    })
})
