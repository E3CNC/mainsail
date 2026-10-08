import { describe, expect, it } from 'vitest'
import { getters } from '@/store/gui/gcodehistory/getters'

describe('gui/gcodehistory/getters', () => {
    it('exposes no getters', () => {
        expect(getters).toEqual({})
        expect(Object.keys(getters)).toHaveLength(0)
    })
})
