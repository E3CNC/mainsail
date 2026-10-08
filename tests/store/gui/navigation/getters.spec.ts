import { describe, expect, it } from 'vitest'
import { getters } from '@/store/gui/navigation/getters'

describe('gui/navigation/getters', () => {
    it('exposes no getters', () => {
        expect(getters).toEqual({})
        expect(Object.keys(getters)).toHaveLength(0)
    })
})
