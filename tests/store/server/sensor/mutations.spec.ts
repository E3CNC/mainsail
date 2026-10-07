import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/server/sensor/mutations'
import { getDefaultState } from '@/store/server/sensor/index'

describe('server/sensor/mutations', () => {
    it('reset restores defaults', () => {
        const s = { ...getDefaultState(), sensors: { a: {} } } as never
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('setSensors replaces, updateSensor patches known keys', () => {
        const s = getDefaultState()
        mutations.setSensors(s, { chamber: { values: { temperature: 25 } } } as never)
        expect(Object.keys(s.sensors)).toEqual(['chamber'])
        mutations.updateSensor(s, { key: 'chamber', value: { temperature: 26 } } as never)
        expect(s.sensors['chamber'].values).toEqual({ temperature: 26 })
        mutations.updateSensor(s, { key: 'missing', value: {} } as never)
    })
})
