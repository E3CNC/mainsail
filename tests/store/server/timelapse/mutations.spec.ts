import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/server/timelapse/mutations'
import { getDefaultState } from '@/store/server/timelapse/index'

describe('server/timelapse/mutations', () => {
    it('reset restores defaults', () => {
        const s = { ...getDefaultState(), lastFrame: { count: 5, file: 'f' } } as never
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('setSettings applies known keys only', () => {
        const s = getDefaultState()
        const before = { ...s.settings }
        mutations.setSettings(s, { ...before, unknown_key: 1 } as never)
        expect(s.settings).toEqual(before)
    })

    it('setLastFrame stores count and file', () => {
        const s = getDefaultState()
        mutations.setLastFrame(s, { count: 12, file: 'frame.jpg' } as never)
        expect(s.lastFrame).toEqual({ count: 12, file: 'frame.jpg' })
    })

    it('render status sets and resets', () => {
        const s = getDefaultState()
        mutations.setRenderStatus(s, { status: 'running', progress: 40, filename: 'out.mp4' })
        expect(s.rendering).toEqual({ status: 'running', progress: 40, filename: 'out.mp4' })
        mutations.resetSnackbar(s)
        expect(s.rendering).toEqual({ status: '', progress: 0, filename: '' })
    })
})
