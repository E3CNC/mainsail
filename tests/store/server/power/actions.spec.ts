import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
}))

vi.mock('@/store/runtime', () => ({
    getSocket: () => ({ emit: mocks.emit }),
}))

import { actions } from '@/store/server/power/actions'

function ctx() {
    return { commit: vi.fn(), dispatch: vi.fn() }
}

describe('server/power/actions', () => {
    beforeEach(() => {
        mocks.emit.mockReset()
    })

    it('reset commits reset', () => {
        const c = ctx()
        actions.reset(c as never)
        expect(c.commit).toHaveBeenCalledWith('reset')
    })

    it('init requests the device list', () => {
        actions.init({} as never)
        expect(mocks.emit).toHaveBeenCalledWith(
            'machine.device_power.devices',
            {},
            { action: 'server/power/getDevices' }
        )
    })

    it('getDevices commits unless errored', async () => {
        const c = ctx()
        await actions.getDevices(c as never, { devices: [{ device: 'printer' }] } as never)
        expect(c.commit).toHaveBeenCalledWith('setDevices', [{ device: 'printer' }])
        expect(c.dispatch).toHaveBeenCalledWith('socket/removeInitModule', 'server/power/init', { root: true })
        const c2 = ctx()
        await actions.getDevices(c2 as never, { error: 'x', devices: [] } as never)
        expect(c2.commit).not.toHaveBeenCalled()
    })

    it('getStatus commits unless errored', () => {
        const c = ctx()
        actions.getStatus(c as never, { device: 'printer', status: 'on' } as never)
        expect(c.commit).toHaveBeenCalledWith('setStatus', { device: 'printer', status: 'on' })
        actions.getStatus(c as never, { error: 'x', device: 'printer', status: 'on' } as never)
        expect(c.commit).toHaveBeenCalledTimes(1)
    })

    it('responseToggle strips params and commits each device', () => {
        const c = ctx()
        actions.responseToggle(c as never, { requestParams: {}, printer: 'off', light: 'on' } as never)
        expect(c.commit).toHaveBeenCalledWith('setStatus', { device: 'printer', status: 'off' })
        expect(c.commit).toHaveBeenCalledWith('setStatus', { device: 'light', status: 'on' })
    })
})
