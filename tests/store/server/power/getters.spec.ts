import { describe, expect, it } from 'vitest'
import { getters } from '@/store/server/power/getters'
import { getDefaultState } from '@/store/server/power/index'

describe('server/power/getters', () => {
    it('getDevices returns the device list', () => {
        const s = getDefaultState()
        expect(getters.getDevices(s, undefined as never, undefined as never, undefined as never)).toEqual([])
        s.devices = [
            { device: 'printer', status: 'on', locked_while_printing: false, type: 'mqtt' },
            { device: 'light', status: 'off', locked_while_printing: true, type: 'gpio' },
        ] as never
        expect(getters.getDevices(s, undefined as never, undefined as never, undefined as never)).toBe(s.devices)
    })
})
