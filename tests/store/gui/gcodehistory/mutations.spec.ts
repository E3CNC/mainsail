import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/gui/gcodehistory/mutations'
import { getDefaultState } from '@/store/gui/gcodehistory/index'
import type { GuiGcodehistoryState } from '@/store/gui/gcodehistory/types'

function state(overrides = {}): GuiGcodehistoryState {
    return { ...getDefaultState(), ...overrides }
}

describe('gui/gcodehistory/mutations', () => {
    it('reset restores defaults', () => {
        const s = state({ entries: ['G28'] })
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('updateHistory replaces entries', () => {
        const s = state()
        mutations.updateHistory(s, ['G28', 'M104'])
        expect(s.entries).toEqual(['G28', 'M104'])
    })
})
