import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { getters } from '@/store/gui/webcams/getters'

const cams = [
    { name: 'cam1', enabled: true },
    { name: 'cam2', enabled: false },
    { name: 'cam3', enabled: true },
]

describe('gui/webcams/getters', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('getWebcams returns only enabled webcams', () => {
        const result = (getters.getWebcams as (s: unknown) => { name: string }[])({ webcams: cams } as never)
        expect(result.map((w) => w.name)).toEqual(['cam1', 'cam3'])
    })

    it('getWebcams returns an empty array when none are enabled', () => {
        const result = (getters.getWebcams as (s: unknown) => unknown[])({
            webcams: [{ name: 'cam2', enabled: false }],
        } as never)
        expect(result).toEqual([])
    })

    it('getWebcam finds an enabled webcam by name', () => {
        const localGetters = { getWebcams: cams.filter((c) => c.enabled) }
        const fn = (getters.getWebcam as (s: unknown, g: unknown) => (name: string) => { name: string } | undefined)(
            { webcams: cams } as never,
            localGetters as never
        )
        expect(fn('cam3')?.name).toBe('cam3')
    })

    it('getWebcam returns undefined for a disabled webcam', () => {
        const localGetters = { getWebcams: cams.filter((c) => c.enabled) }
        const fn = (getters.getWebcam as (s: unknown, g: unknown) => (name: string) => unknown)(
            { webcams: cams } as never,
            localGetters as never
        )
        expect(fn('cam2')).toBeUndefined()
    })

    it('getWebcam returns undefined when the getter list is missing', () => {
        const fn = (getters.getWebcam as (s: unknown, g: unknown) => (name: string) => unknown)(
            { webcams: cams } as never,
            {} as never
        )
        expect(fn('cam1')).toBeUndefined()
    })
})
