import { describe, expect, it } from 'vitest'
import { getDynamicCamImport } from '@/components/webcams/streamers/DynamicCamLoader'

describe('DynamicCamLoader', () => {
    it.each([
        'Hlsstreamer',
        'HtmlIframe',
        'HtmlVideo',
        'JanusStreamer',
        'JMuxerStream',
        'Mjpegstreamer',
        'MjpegstreamerAdaptive',
        'Uv4lMjpeg',
        'WebrtcCameraStreamer',
        'WebrtcMediaMTX',
        'WebrtcGo2rtc',
    ] as const)('returns a lazy loader for %s', (name) => {
        expect(typeof getDynamicCamImport(name)).toBe('function')
    })

    it('resolves the loader to a Vue component', async () => {
        const component = await getDynamicCamImport('Mjpegstreamer')()
        expect((component as unknown as { default: unknown }).default).toBeTruthy()
    })
})
