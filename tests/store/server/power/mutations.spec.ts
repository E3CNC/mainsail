import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/server/power/mutations'
import { getDefaultState } from '@/store/server/power/index'

describe('server/power/mutations', () => {
    it('reset restores defaults', () => {
        const s = { ...getDefaultState(), devices: [{ device: 'printer' }] } as never
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('setDevices stores the list, setStatus updates one device', () => {
        const s = getDefaultState()
        mutations.setDevices(s, [
            { device: 'printer', status: 'on' },
            { device: 'light', status: 'off' },
        ] as never)
        expect(s.devices).toHaveLength(2)
        mutations.setStatus(s, { device: 'light', status: 'on' })
        expect(s.devices[1].status).toBe('on')
        mutations.setStatus(s, { device: 'missing', status: 'on' })
        expect(s.devices).toHaveLength(2)
    })
})
