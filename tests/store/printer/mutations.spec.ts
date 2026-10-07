import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/printer/mutations'
import type { PrinterState } from '@/store/printer/types'

function state(overrides: Record<string, unknown> = {}): PrinterState {
    return { ...overrides } as PrinterState
}

describe('printer/mutations', () => {
    it('reset drops unknown keys but keeps tempHistory', () => {
        const s = state({ extruder: { temp: 200 }, tempHistory: { kept: true }, custom: 1 })
        mutations.reset(s)
        expect(s).toEqual({ tempHistory: { kept: true } })
    })

    it('setData assigns flat values and merges nested objects', () => {
        const s = state({ toolhead: { homed_axes: '', position: [0, 0, 0] } })
        mutations.setData(s, {
            hostname: 'printer.local',
            toolhead: { homed_axes: 'xyz' },
        })
        expect(s.hostname).toBe('printer.local')
        expect(s.toolhead).toEqual({ homed_axes: 'xyz', position: [0, 0, 0] })
    })

    it('setData assigns new keys directly without merging', () => {
        const s = state({})
        mutations.setData(s, { brandNew: { nested: true } })
        expect(s.brandNew).toEqual({ nested: true })
    })

    it('clearCurrentFile empties the current file', () => {
        const s = state({ current_file: { filename: 'benchy.gcode' } })
        mutations.clearCurrentFile(s)
        expect(s.current_file).toEqual({})
    })

    it('setEndstopStatus strips requestParams and stores the payload', () => {
        const s = state({})
        mutations.setEndstopStatus(s, { x: { state: 'open' }, requestParams: { id: 1 } } as never)
        expect(s.endstops).toEqual({ x: { state: 'open' } })
    })

    it('removeBedMeshProfile deletes the profile and clears the active name', () => {
        const s = state({
            bed_mesh: { profile_name: 'default', profiles: { default: {}, fine: {} } },
        })
        mutations.removeBedMeshProfile(s, 'default')
        expect(s.bed_mesh.profiles).toEqual({ fine: {} })
        expect(s.bed_mesh.profile_name).toBe('')
    })

    it('removeBedMeshProfile leaves a non-active removal untouched', () => {
        const s = state({
            bed_mesh: { profile_name: 'fine', profiles: { default: {}, fine: {} } },
        })
        mutations.removeBedMeshProfile(s, 'default')
        expect(s.bed_mesh.profiles).toEqual({ fine: {} })
        expect(s.bed_mesh.profile_name).toBe('fine')
    })

    it('removeBedMeshProfile no-ops for missing profiles or mesh', () => {
        const s = state({ bed_mesh: { profile_name: 'fine', profiles: { fine: {} } } })
        mutations.removeBedMeshProfile(s, 'missing')
        expect(s.bed_mesh.profiles).toEqual({ fine: {} })
        mutations.removeBedMeshProfile(state({}), 'anything')
    })
})
