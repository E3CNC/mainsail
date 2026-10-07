import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { dispatch: ReturnType<typeof vi.fn>; state: Record<string, any> } = {
    dispatch: vi.fn(),
    state: {},
}

vi.mock('vuex', () => ({
    useStore: () => store,
}))

import { useTimelapse } from '@/composables/useTimelapse'

function defaultState() {
    return {
        server: {
            timelapse: {
                settings: {
                    variable_fps: false,
                    variable_fps_min: 5,
                    variable_fps_max: 60,
                    targetlength: 10,
                    output_framerate: 30,
                    duplicatelastframe: 0,
                },
                lastFrame: { count: 300 },
            },
        },
    }
}

describe('useTimelapse', () => {
    beforeEach(() => {
        store.dispatch.mockReset()
        store.state = reactive(defaultState())
    })

    it('reads settings with defaults', () => {
        const t = useTimelapse()
        expect(t.variable_fps.value).toBe(false)
        expect(t.variable_fps_min.value).toBe(5)
        expect(t.variable_fps_max.value).toBe(60)
        expect(t.targetlength.value).toBe(10)
        expect(t.output_framerate.value).toBe(30)
        expect(t.framesCount.value).toBe(300)
    })

    it('setters dispatch server/timelapse/saveSetting', () => {
        const t = useTimelapse()
        t.setVariable_fps(true)
        t.setTargetlength(20)
        t.setOutput_framerate(60)
        expect(store.dispatch).toHaveBeenNthCalledWith(1, 'server/timelapse/saveSetting', { variable_fps: true })
        expect(store.dispatch).toHaveBeenNthCalledWith(2, 'server/timelapse/saveSetting', { targetlength: 20 })
        expect(store.dispatch).toHaveBeenNthCalledWith(3, 'server/timelapse/saveSetting', { output_framerate: 60 })
    })

    it('variableTargetFps clamps to min/max', () => {
        expect(useTimelapse().variableTargetFps.value).toBe(30)
        store.state.server.timelapse.lastFrame.count = 10
        expect(useTimelapse().variableTargetFps.value).toBe(5)
        store.state.server.timelapse.lastFrame.count = 6000
        expect(useTimelapse().variableTargetFps.value).toBe(60)
    })

    it('estimatedVideoLength formats seconds', () => {
        // 300 frames / 30fps = 10s
        expect(useTimelapse().estimatedVideoLength.value).toBe('10s')
    })

    it('estimatedVideoLength formats minutes and seconds', () => {
        store.state.server.timelapse.lastFrame.count = 3660
        expect(useTimelapse().estimatedVideoLength.value).toBe('2m 2s')
    })

    it('estimatedVideoLength uses the variable target fps with a floor', () => {
        store.state.server.timelapse.settings.variable_fps = true
        // 300 frames / 30 target fps = 10s, floored at targetlength 10
        expect(useTimelapse().estimatedVideoLength.value).toBe('10s')
        store.state.server.timelapse.lastFrame.count = 60
        // 60 frames / 6 target fps = 10s
        expect(useTimelapse().estimatedVideoLength.value).toBe('10s')
    })
})
