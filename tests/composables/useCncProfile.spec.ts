import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

const store = {
    getters: {
        'socket/getUrl': 'http://moonraker:7125',
    },
    state: {},
}

vi.mock('vuex', () => ({
    useStore: () => store,
}))

const getCncState = vi.fn()
vi.mock('@/store/files/cncApi', () => ({
    getCncState: (...args: unknown[]) => getCncState(...args),
}))

import { useCncProfile } from '@/composables/useCncProfile'

function profileState(profile: unknown) {
    return { profile, state: 'ready' }
}

describe('useCncProfile', () => {
    beforeEach(() => {
        getCncState.mockReset()
    })

    it('derives computed capability flags from the profile state', async () => {
        getCncState.mockResolvedValue(
            profileState({
                name: 'E3CNC Mill',
                capabilities: {
                    spindle: { enabled: true },
                    coolant: { channels: 2 },
                    probe: { enabled: true },
                    tool_setter: { enabled: false },
                },
                frontend: {
                    show_machine_coords: true,
                    reverse_y_preview: true,
                },
                safety: {
                    require_confirm_for_zero_reset: true,
                },
            })
        )
        const cncs = useCncProfile()
        await cncs.load()

        await nextTick()
        expect(cncs.machineName.value).toBe('E3CNC Mill')
        expect(cncs.spindleEnabled.value).toBe(true)
        expect(cncs.coolantChannelCount.value).toBe(2)
        expect(cncs.coolantEnabled.value).toBe(true)
        expect(cncs.probeEnabled.value).toBe(true)
        expect(cncs.toolSetterEnabled.value).toBe(false)
        expect(cncs.showMachineCoords.value).toBe(true)
        expect(cncs.showWorkCoords.value).toBe(true)
        expect(cncs.reverseYPreview.value).toBe(true)
        expect(cncs.requireConfirmForZeroReset.value).toBe(true)
        expect(cncs.requireHomingBeforeOffsets.value).toBe(true)
    })

    it('defaults flags when profile/capabilities are missing', async () => {
        getCncState.mockResolvedValue(profileState({}))
        const cncs = useCncProfile()
        await cncs.load()
        await nextTick()

        expect(cncs.machineName.value).toBe('')
        expect(cncs.spindleEnabled.value).toBe(true) // enabled !== false
        expect(cncs.coolantChannelCount.value).toBe(0)
        expect(cncs.coolantEnabled.value).toBe(false)
        expect(cncs.probeEnabled.value).toBe(false)
        expect(cncs.reverseYPreview.value).toBe(false)
    })

    it('respects explicit disabled spindle and safety flags', async () => {
        getCncState.mockResolvedValue(
            profileState({
                capabilities: { spindle: { enabled: false } },
                frontend: { show_machine_coords: false },
                safety: {
                    require_confirm_for_zero_reset: false,
                    require_confirm_for_spindle_start: false,
                    require_homing_before_offsets: false,
                },
            })
        )
        const cncs = useCncProfile()
        await cncs.load()
        await nextTick()

        expect(cncs.spindleEnabled.value).toBe(false)
        expect(cncs.showMachineCoords.value).toBe(false)
        expect(cncs.requireConfirmForZeroReset.value).toBe(false)
        expect(cncs.requireConfirmForSpindleStart.value).toBe(false)
        expect(cncs.requireHomingBeforeOffsets.value).toBe(false)
    })

    it('load() is a no-op when there is no socket url', async () => {
        const orig = store.getters['socket/getUrl']
        store.getters['socket/getUrl'] = ''
        try {
            const cncs = useCncProfile()
            await cncs.load()
            expect(getCncState).not.toHaveBeenCalled()
        } finally {
            store.getters['socket/getUrl'] = orig
        }
    })
})
