import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick, reactive } from 'vue'

const mocks = vi.hoisted(() => ({
    selectCncWcs: vi.fn(),
    getCncWcs: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store: {} as Record<string, any>,
}))

vi.mock('vuex', () => ({
    useStore: () => mocks.store,
}))

vi.mock('@/store/files/cncApi', () => ({
    getCncWcs: mocks.getCncWcs,
    selectCncWcs: mocks.selectCncWcs,
}))

// Reference the static store shape here (not inside the vi.mock factory).
const store = mocks.store
store.getters = { 'socket/getUrl': 'http://moonraker:7125' }
// state must be reactive (not a plain object) so the composable's internal
// `watch(() => store.state.printer.print_stats?.state)` fires on mutation.
store.state = reactive({ printer: { print_stats: { state: 'standby' } } })

const selectCncWcs = mocks.selectCncWcs
const getCncWcs = mocks.getCncWcs

import { useCncOffsets, offsetNames } from '@/composables/useCncOffsets'

// Baseline response from the mock Moonraker WCS endpoint.
function defaultWcs() {
    return {
        result: {
            active: 'G55',
            offsets: {
                G54: { X: 0, Y: 0, Z: 0 },
                G55: { X: 10, Y: 20, Z: -5 },
            },
        },
    }
}

describe('useCncOffsets', () => {
    beforeEach(async () => {
        // The composable keeps module-level singleton refs (activeWcs,
        // wcsOffsets, savedWcs), so reset them to a deterministic baseline in
        // every test by refreshing against the default mock response.
        getCncWcs.mockReset()
        getCncWcs.mockResolvedValue(defaultWcs())
        selectCncWcs.mockReset()
        selectCncWcs.mockResolvedValue({})
        await useCncOffsets().refreshWcs()
    })

    it('exposes the six G54-G59 offset names', () => {
        expect(offsetNames).toEqual(['G54', 'G55', 'G56', 'G57', 'G58', 'G59'])
    })

    it('refreshWcs populates active wcs and squared offsets', async () => {
        const { activeWcs, wcsOffsets, refreshWcs } = useCncOffsets()
        await refreshWcs()
        expect(activeWcs.value).toBe('G55')
        expect(wcsOffsets.value['G55']).toEqual({ X: 10, Y: 20, Z: -5 })
        expect(wcsOffsets.value['G54']).toEqual({ X: 0, Y: 0, Z: 0 })
    })

    it('refreshWcs coalesces missing axes to zero', async () => {
        getCncWcs.mockResolvedValue({
            result: { active: 'G54', offsets: { G54: { X: 5 } } },
        })
        const { wcsOffsets, refreshWcs } = useCncOffsets()
        await refreshWcs()
        expect(wcsOffsets.value['G54']).toEqual({ X: 5, Y: 0, Z: 0 })
        expect(useCncOffsets().activeWcs.value).toBe('G54')
    })

    it('setActiveWcs posts and updates the active wcs', async () => {
        const { activeWcs, setActiveWcs } = useCncOffsets()
        selectCncWcs.mockResolvedValue({})
        await setActiveWcs('G56')
        expect(selectCncWcs).toHaveBeenCalledWith('http://moonraker:7125', { wcs: 'G56' })
        expect(activeWcs.value).toBe('G56')
    })

    it('setActiveWcs no-ops when the wcs is already active', async () => {
        const { setActiveWcs } = useCncOffsets()
        // beforeEach refreshed active to G55 (baseline default)
        await setActiveWcs('G55')
        expect(selectCncWcs).not.toHaveBeenCalled()
    })

    it('restores the saved wcs when a job completes back to standby', async () => {
        // baseline: active WCS is G55 (from beforeEach), savedWcs is null

        // Job starts -> save the active WCS (G55)
        store.state.printer.print_stats.state = 'printing'
        await nextTick()

        // User switches WCS mid-job (active WCS is now G56)
        selectCncWcs.mockResolvedValue({})
        await useCncOffsets().setActiveWcs('G56')

        // Job completes back to standby -> restore the saved WCS (G55)
        store.state.printer.print_stats.state = 'standby'
        await nextTick()
        await nextTick()

        expect(selectCncWcs).toHaveBeenCalledWith('http://moonraker:7125', { wcs: 'G55' })
        expect(useCncOffsets().activeWcs.value).toBe('G55')
    })
})
