import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit }),
}))

import { actions } from '@/store/server/sensor/actions'

function ctx() {
    return { commit: vi.fn(), dispatch: vi.fn() }
}

describe('server/sensor/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
    })

    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('init requests the sensor list', () => {
        actions.init({} as never)
        expect(mocks.emit).toHaveBeenCalledWith('server.sensors.list', {}, { action: 'server/sensor/getSensors' })
    })

    it('getSensors commits and clears the init module', () => {
        const c = ctx()
        actions.getSensors(c as never, { sensors: { a: {} } } as never)
        expect(c.commit).toHaveBeenCalledWith('setSensors', { a: {} })
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/sensor/init', { root: true })
    })

    it('updateSensors commits each entry', () => {
        const c = ctx()
        actions.updateSensors(c as never, { a: { temperature: 25 } } as never)
        expect(c.commit).toHaveBeenCalledWith('updateSensor', { key: 'a', value: { temperature: 25 } })
    })
})
