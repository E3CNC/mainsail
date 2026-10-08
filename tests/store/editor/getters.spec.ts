import { describe, expect, it } from 'vitest'
import { getters } from '@/store/editor/getters'

describe('editor/getters', () => {
    it('returns the configured klipper restart method', () => {
        const rootState = { gui: { editor: { klipperRestartMethod: 'RESTART' } } } as never
        expect(getters.getKlipperRestartMethod({}, undefined as never, rootState, undefined as never)).toBe('RESTART')
    })

    it('falls back to FIRMWARE_RESTART when unset', () => {
        expect(getters.getKlipperRestartMethod({}, undefined as never, {} as never, undefined as never)).toBe(
            'FIRMWARE_RESTART'
        )
        const noMethod = { gui: { editor: {} } } as never
        expect(getters.getKlipperRestartMethod({}, undefined as never, noMethod, undefined as never)).toBe(
            'FIRMWARE_RESTART'
        )
        const noEditor = { gui: {} } as never
        expect(getters.getKlipperRestartMethod({}, undefined as never, noEditor, undefined as never)).toBe(
            'FIRMWARE_RESTART'
        )
    })
})
