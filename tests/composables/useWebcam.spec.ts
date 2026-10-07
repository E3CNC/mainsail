import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { mdiCampfire, mdiWebcam } from '@mdi/js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { state: Record<string, any> } = { state: {} }

vi.mock('vuex', () => ({
    useStore: () => store,
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        hostUrl: { value: 'http://printer.local/' },
        hostPort: { value: 80 },
    }),
}))

import { useWebcam } from '@/composables/useWebcam'

describe('useWebcam', () => {
    beforeEach(() => {
        store.state = reactive({ server: { config: { config: {} } } })
    })

    it('convertUrl resolves relative urls against the host', () => {
        expect(useWebcam().convertUrl('webcam/?action=stream', null)).toBe('http://printer.local/webcam/?action=stream')
    })

    it('convertUrl prefers the printer url when given', () => {
        expect(useWebcam().convertUrl('webcam/?action=stream', 'http://cam.lan/')).toBe(
            'http://cam.lan/webcam/?action=stream'
        )
    })

    it('convertUrl keeps absolute urls as-is', () => {
        expect(useWebcam().convertUrl('http://other.lan/stream', null)).toBe('http://other.lan/stream')
    })

    it('convertWebcamIcon maps known icons and defaults', () => {
        const { convertWebcamIcon } = useWebcam()
        expect(convertWebcamIcon('mdiCampfire')).toBe(mdiCampfire)
        expect(convertWebcamIcon('nope')).toBe(mdiWebcam)
    })

    it('generateTransform combines flips and rotation', () => {
        const { generateTransform } = useWebcam()
        expect(generateTransform(false, false, 0)).toBe('none')
        expect(generateTransform(true, false, 0)).toBe('scaleX(-1)')
        expect(generateTransform(true, true, 90, 2)).toBe('scaleX(-1) scaleY(-1) rotate(90deg) scale(0.5)')
        expect(generateTransform(false, false, 180, 2)).toBe('rotate(180deg)')
    })

    it('getWrapperStyle handles aspect-ratio edge cases', () => {
        const { getWrapperStyle } = useWebcam()
        expect(getWrapperStyle(null, 90)).toEqual({})
        expect(getWrapperStyle(1, 90)).toEqual({})
        expect(getWrapperStyle(2, 0)).toEqual({})
        expect(getWrapperStyle(0.5, 90)).toEqual({ aspectRatio: 2 })
        expect(getWrapperStyle(2, 90)).toEqual({ aspectRatio: 2 })
    })

    it('updateAspectRatio helpers derive ratios or null', () => {
        const { updateAspectRatioFromVideo, updateAspectRatioFromImage } = useWebcam()
        expect(updateAspectRatioFromVideo({ videoWidth: 640, videoHeight: 480 } as HTMLVideoElement)).toBe(640 / 480)
        expect(updateAspectRatioFromVideo(null)).toBeNull()
        expect(updateAspectRatioFromImage({ naturalWidth: 0, naturalHeight: 480 } as HTMLImageElement)).toBeNull()
        expect(updateAspectRatioFromImage({ naturalWidth: 1920, naturalHeight: 1080 } as HTMLImageElement)).toBe(
            1920 / 1080
        )
    })
})
