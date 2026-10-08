import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/gui/macros/mutations'
import { getDefaultState } from '@/store/gui/macros/index'
import type { GuiMacrosState, GuiMacrosStateMacrogroup } from '@/store/gui/macros/types'

function state(overrides = {}): GuiMacrosState {
    return { ...getDefaultState(), ...overrides }
}

function group(name = 'Main', overrides = {}): GuiMacrosStateMacrogroup {
    return {
        id: null,
        name,
        color: 'primary',
        showInStandby: true,
        showInPrinting: true,
        showInPause: true,
        macros: [],
        ...overrides,
    }
}

describe('gui/macros/mutations', () => {
    it('reset restores defaults', () => {
        const s = state({ mode: 'expert', macrogroups: { a: group() } })
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('groupStore stores values by id', () => {
        const s = state()
        const values = group('Main')
        mutations.groupStore(s, { id: 'abc', values })
        expect(s.macrogroups['abc']).toEqual(values)
    })

    it('groupUpdate merges values and ignores unknown ids', () => {
        const s = state({ macrogroups: { abc: group('Old') } })
        mutations.groupUpdate(s, { id: 'abc', values: { name: 'New' } })
        expect(s.macrogroups['abc'].name).toBe('New')
        mutations.groupUpdate(s, { id: 'missing', values: { name: 'x' } })
        expect('missing' in s.macrogroups).toBe(false)
    })

    it('addMacroToMacrogroup appends with pos 1 for an empty group', () => {
        const s = state({ macrogroups: { abc: group('Main') } })
        mutations.addMacroToMacrogroup(s, { id: 'abc', macro: 'M600' })
        expect(s.macrogroups['abc'].macros).toHaveLength(1)
        expect(s.macrogroups['abc'].macros?.[0]).toMatchObject({ name: 'M600', pos: 1, color: 'group' })
    })

    it('addMacroToMacrogroup increments pos beyond the current max', () => {
        const s = state({
            macrogroups: {
                abc: group('Main', {
                    macros: [
                        {
                            pos: 1,
                            name: 'A',
                            color: 'group',
                            showInStandby: true,
                            showInPrinting: true,
                            showInPause: true,
                        },
                        {
                            pos: 3,
                            name: 'B',
                            color: 'group',
                            showInStandby: true,
                            showInPrinting: true,
                            showInPause: true,
                        },
                    ],
                }),
            },
        })
        mutations.addMacroToMacrogroup(s, { id: 'abc', macro: 'C' })
        expect(s.macrogroups['abc'].macros?.find((m) => m.name === 'C')?.pos).toBe(4)
    })

    it('updateMacroFromMacrogroup updates the named macro and ignores unknown names', () => {
        const s = state({
            macrogroups: {
                abc: group('Main', {
                    macros: [
                        {
                            pos: 1,
                            name: 'M600',
                            color: 'group',
                            showInStandby: true,
                            showInPrinting: true,
                            showInPause: true,
                        },
                    ],
                }),
            },
        })
        mutations.updateMacroFromMacrogroup(s, { id: 'abc', macro: 'M600', option: 'color', value: 'primary' } as never)
        expect(s.macrogroups['abc'].macros?.[0].color).toBe('primary')
        mutations.updateMacroFromMacrogroup(s, {
            id: 'abc',
            macro: 'MISSING',
            option: 'color',
            value: 'error',
        } as never)
        expect(s.macrogroups['abc'].macros).toHaveLength(1)
    })

    it('removeMacroFromMacrogroup removes and renumbers following macros', () => {
        const s = state({
            macrogroups: {
                abc: group('Main', {
                    macros: [
                        {
                            pos: 1,
                            name: 'A',
                            color: 'group',
                            showInStandby: true,
                            showInPrinting: true,
                            showInPause: true,
                        },
                        {
                            pos: 2,
                            name: 'B',
                            color: 'group',
                            showInStandby: true,
                            showInPrinting: true,
                            showInPause: true,
                        },
                        {
                            pos: 3,
                            name: 'C',
                            color: 'group',
                            showInStandby: true,
                            showInPrinting: true,
                            showInPause: true,
                        },
                    ],
                }),
            },
        })
        mutations.removeMacroFromMacrogroup(s, { id: 'abc', macro: 'B' })
        expect(s.macrogroups['abc'].macros?.map((m) => [m.name, m.pos])).toEqual([
            ['A', 1],
            ['C', 2],
        ])
    })

    it('removeMacroFromMacrogroup keeps entries when the macro is missing', () => {
        const s = state({
            macrogroups: {
                abc: group('Main', {
                    macros: [
                        {
                            pos: 1,
                            name: 'A',
                            color: 'group',
                            showInStandby: true,
                            showInPrinting: true,
                            showInPause: true,
                        },
                    ],
                }),
            },
        })
        mutations.removeMacroFromMacrogroup(s, { id: 'abc', macro: 'MISSING' })
        expect(s.macrogroups['abc'].macros).toHaveLength(1)
    })

    it('groupDelete removes existing and ignores unknown ids', () => {
        const s = state({ macrogroups: { abc: group() } })
        mutations.groupDelete(s, 'missing')
        expect('abc' in s.macrogroups).toBe(true)
        mutations.groupDelete(s, 'abc')
        expect('abc' in s.macrogroups).toBe(false)
    })
})
