import { describe, expect, it } from 'vitest'
import { getters } from '@/store/gcodeviewer/getters'

describe('gcodeviewer/getters', () => {
    it('exposes an empty getter tree', () => {
        expect(getters).toEqual({})
    })
})
