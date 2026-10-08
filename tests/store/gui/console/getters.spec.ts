import { describe, expect, it } from 'vitest'
import { getters } from '@/store/gui/console/getters'
import { getDefaultState } from '@/store/gui/console/index'
import type { GuiConsoleState } from '@/store/gui/console/types'

function state(overrides = {}): GuiConsoleState {
    return { ...getDefaultState(), ...overrides }
}

describe('gui/console/getters', () => {
    it('getConsolefilters returns entries with ids sorted case-insensitively', () => {
        const s = state({
            consolefilters: {
                b: { name: 'beta', bool: true, regex: 'b' },
                a: { name: 'Alpha', bool: false, regex: 'a' },
            },
        })
        const out = getters.getConsolefilters(s, undefined as never, undefined as never, undefined as never)
        expect(out.map((f: { name: string }) => f.name)).toEqual(['Alpha', 'beta'])
        expect(out.find((f: { id?: string }) => f.id === 'a')).toMatchObject({ name: 'Alpha' })
    })

    it('getConsolefilters returns empty array when no filters', () => {
        expect(getters.getConsolefilters(state(), undefined as never, undefined as never, undefined as never)).toEqual(
            []
        )
    })

    it('getConsolefilterRules includes wait-temp rule when hidden', () => {
        const s = state()
        const rootState = { gui: { console: { hideWaitTemperatures: true, hideTlCommands: false } } } as never
        const rules = getters.getConsolefilterRules(s, {}, rootState, undefined as never)
        expect(rules).toContain('^(?:ok\\s+)?(B|C|T\\d*):')
    })

    it('getConsolefilterRules includes timelapse rules when hidden', () => {
        const s = state()
        const rootState = { gui: { console: { hideWaitTemperatures: false, hideTlCommands: true } } } as never
        const rules = getters.getConsolefilterRules(s, {}, rootState, undefined as never)
        expect(rules).toContain('^TIMELAPSE_RENDER')
        expect(rules).not.toContain('^(?:ok\\s+)?(B|C|T\\d*):')
    })

    it('getConsolefilterRules collects enabled filter regex lines and skips empties/disabled', () => {
        const s = state({
            consolefilters: {
                on: { name: 'on', bool: true, regex: 'foo\n\nbar' },
                off: { name: 'off', bool: false, regex: 'skipped' },
            },
        })
        const rootState = { gui: { console: { hideWaitTemperatures: false, hideTlCommands: false } } } as never
        const rules = getters.getConsolefilterRules(s, {}, rootState, undefined as never)
        expect(rules).toEqual(['foo', 'bar'])
    })

    it('getConsolefilterRules returns empty when nothing enabled', () => {
        const rootState = { gui: {} } as never
        expect(getters.getConsolefilterRules(state(), {}, rootState, undefined as never)).toEqual([])
    })

    it('getConsoleClearedSince returns cleared_since', () => {
        expect(
            getters.getConsoleClearedSince(
                state({ cleared_since: 123 }),
                undefined as never,
                undefined as never,
                undefined as never
            )
        ).toBe(123)
        expect(
            getters.getConsoleClearedSince(state(), undefined as never, undefined as never, undefined as never)
        ).toBeUndefined()
    })
})
