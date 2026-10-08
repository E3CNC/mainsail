import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/gui/console/mutations'
import { getDefaultState } from '@/store/gui/console/index'
import type { GuiConsoleState } from '@/store/gui/console/types'

function state(overrides = {}): GuiConsoleState {
    return { ...getDefaultState(), ...overrides }
}

describe('gui/console/mutations', () => {
    it('reset restores defaults', () => {
        const s = state({ autoscroll: false })
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('clear sets cleared_since', () => {
        const s = state()
        mutations.clear(s, { cleared_since: 999 })
        expect(s.cleared_since).toBe(999)
    })

    it('filterStore stores values by id', () => {
        const s = state()
        const values = { name: 'f', bool: true, regex: 'x' }
        mutations.filterStore(s, { id: 'abc', values })
        expect(s.consolefilters['abc']).toEqual(values)
    })

    it('filterUpdate merges values and ignores unknown ids', () => {
        const s = state({ consolefilters: { abc: { name: 'f', bool: true, regex: 'x' } } })
        mutations.filterUpdate(s, { id: 'abc', values: { name: 'g' } })
        expect(s.consolefilters['abc']).toMatchObject({ name: 'g', bool: true, regex: 'x' })
        mutations.filterUpdate(s, { id: 'missing', values: { name: 'z' } })
        expect('missing' in s.consolefilters).toBe(false)
    })

    it('filterDelete removes existing and ignores unknown ids', () => {
        const s = state({ consolefilters: { abc: { name: 'f', bool: true, regex: 'x' } } })
        mutations.filterDelete(s, 'missing')
        expect('abc' in s.consolefilters).toBe(true)
        mutations.filterDelete(s, 'abc')
        expect('abc' in s.consolefilters).toBe(false)
    })
})
