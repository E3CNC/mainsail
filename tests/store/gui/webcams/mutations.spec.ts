import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { mutations } from '@/store/gui/webcams/mutations'
import { getDefaultState } from '@/store/gui/webcams/index'

const webcam = {
    name: 'cam1',
    service: 'mjpegstreamer',
    enabled: true,
    icon: 'mdiCamera',
    target_fps: 15,
    stream_url: 'http://localhost/stream',
    snapshot_url: 'http://localhost/snapshot',
    flip_horizontal: false,
    flip_vertical: false,
    rotation: 0,
}

describe('gui/webcams/mutations', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reset restores the default state', () => {
        const state = { webcams: [webcam] } as never
        mutations.reset(state as never)
        expect(state).toEqual(getDefaultState())
    })

    it('initStore replaces the webcam list', () => {
        const state = getDefaultState()
        mutations.initStore(state as never, [webcam] as never)
        expect(state.webcams).toEqual([webcam])
    })

    it('initStore replaces existing webcams instead of appending', () => {
        const state = getDefaultState()
        mutations.initStore(state as never, [webcam] as never)
        mutations.initStore(state as never, [] as never)
        expect(state.webcams).toEqual([])
    })
})
