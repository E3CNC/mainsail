import { describe, expect, it } from 'vitest'
import { getters } from '@/store/server/sensor/getters'
import { getDefaultState } from '@/store/server/sensor/index'

describe('server/sensor/getters', () => {
    it('getSensors returns sensor ids', () => {
        const s = getDefaultState()
        expect(getters.getSensors(s, undefined as never, undefined as never, undefined as never)).toEqual([])
        s.sensors = {
            aht10: { friendly_name: 'AHT10', id: 'aht10', type: 'aht10', values: { temperature: 21 } },
            bme280: { friendly_name: 'BME280', id: 'bme280', type: 'bme280', values: { temperature: 22 } },
        } as never
        expect(getters.getSensors(s, undefined as never, undefined as never, undefined as never)).toEqual([
            'aht10',
            'bme280',
        ])
    })
})
