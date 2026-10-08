import { describe, expect, it } from 'vitest'
import { getters } from '@/store/gui/macros/getters'
import { getDefaultState } from '@/store/gui/macros/index'
import type { GuiMacrosState } from '@/store/gui/macros/types'

function state(overrides = {}): GuiMacrosState {
    return { ...getDefaultState(), ...overrides }
}

function group(name: string) {
    return {
        id: null,
        name,
        color: 'primary' as const,
        showInStandby: true,
        showInPrinting: true,
        showInPause: true,
    }
}

describe('gui/macros/getters', () => {
    it('getAllMacrogroups returns entries with ids sorted case-insensitively', () => {
        const s = state({ macrogroups: { b: group('beta'), a: group('Alpha') } })
        const out = getters.getAllMacrogroups(s, undefined as never, undefined as never, undefined as never)
        expect(out.map((g: { name: string }) => g.name)).toEqual(['Alpha', 'beta'])
        expect(out.find((g: { id: string }) => g.id === 'a')).toMatchObject({ name: 'Alpha' })
    })

    it('getAllMacrogroups returns empty array when no groups', () => {
        expect(getters.getAllMacrogroups(state(), undefined as never, undefined as never, undefined as never)).toEqual(
            []
        )
    })

    it('getMacrogroup returns the group by id', () => {
        const g = group('Main')
        const s = state({ macrogroups: { abc: g } })
        const run = getters.getMacrogroup(s, undefined as never, undefined as never, undefined as never)
        expect(run('abc')).toEqual(g)
        expect(run('missing')).toBeUndefined()
    })
})
