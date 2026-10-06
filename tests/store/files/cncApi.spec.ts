import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
    getCncState,
    getCncSpindle,
    setCncSpindle,
    getCncCoolant,
    setCncCoolant,
    getCncUnits,
    setCncUnits,
    getCncWcs,
    selectCncWcs,
    setCncZero,
    getCncSettings,
    updateCncSettings,
    execBash,
} from '@/store/files/cncApi'

const API = 'http://moonraker:7125'

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('cncApi', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    describe('GET endpoints', () => {
        it('getCncState returns raw json', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ state: 'idle' }))
            await expect(getCncState(API)).resolves.toEqual({ state: 'idle' })
            expect(fetchMock).toHaveBeenCalledWith(`${API}/server/cnc/state`)
        })

        it('getCncSpindle returns raw json', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ state: 'cw' }))
            await expect(getCncSpindle(API)).resolves.toEqual({ state: 'cw' })
            expect(fetchMock).toHaveBeenCalledWith(`${API}/server/cnc/spindle`)
        })

        it('getCncCoolant returns raw json', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ flood: true }))
            await expect(getCncCoolant(API)).resolves.toEqual({ flood: true })
        })

        it('getCncUnits returns raw json', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ units: 'metric' }))
            await expect(getCncUnits(API)).resolves.toEqual({ units: 'metric' })
        })

        it('getCncWcs returns raw json', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ active: 'G54' }))
            await expect(getCncWcs(API)).resolves.toEqual({ active: 'G54' })
        })

        it('getCncSettings returns raw json', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ theme: 'dark' }))
            await expect(getCncSettings(API)).resolves.toEqual({ theme: 'dark' })
        })
    })

    describe('POST endpoints', () => {
        it('setCncSpindle posts a JSON body and unwraps the result envelope', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ result: { ok: true } }))
            await expect(setCncSpindle(API, { state: 'cw', rpm: 12000 })).resolves.toEqual({ ok: true })
            expect(fetchMock).toHaveBeenCalledWith(
                `${API}/server/cnc/spindle`,
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state: 'cw', rpm: 12000 }),
                })
            )
        })

        it('setCncCoolant returns null on 204', async () => {
            fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
            await expect(setCncCoolant(API, { flood: true })).resolves.toBeNull()
            expect(fetchMock).toHaveBeenCalledWith(
                `${API}/server/cnc/coolant`,
                expect.objectContaining({ body: JSON.stringify({ flood: true }) })
            )
        })

        it('selectCncWcs posts the wcs payload', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ result: {} }))
            await expect(selectCncWcs(API, { wcs: 'G55' })).resolves.toEqual({})
            expect(fetchMock).toHaveBeenCalledWith(
                `${API}/server/cnc/wcs/select`,
                expect.objectContaining({ body: JSON.stringify({ wcs: 'G55' }) })
            )
        })

        it('setCncZero defaults to empty axes payload', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ result: {} }))
            await expect(setCncZero(API)).resolves.toEqual({})
            expect(fetchMock).toHaveBeenCalledWith(
                `${API}/server/cnc/wcs/set-zero`,
                expect.objectContaining({ body: JSON.stringify({}) })
            )
        })

        it('setCncZero forwards axes', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ result: {} }))
            await setCncZero(API, { axes: ['X', 'Y'] })
            expect(fetchMock).toHaveBeenCalledWith(
                `${API}/server/cnc/wcs/set-zero`,
                expect.objectContaining({ body: JSON.stringify({ axes: ['X', 'Y'] }) })
            )
        })

        it('updateCncSettings posts settings', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ result: { saved: true } }))
            await expect(updateCncSettings(API, { jog_speed: 5000 })).resolves.toEqual({ saved: true })
        })

        it('execBash posts command and timeout', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ result: { stdout: 'ok', stderr: '', returncode: 0 } }))
            await expect(execBash(API, 'gcode_macro CHECK', 15)).resolves.toEqual({
                stdout: 'ok',
                stderr: '',
                returncode: 0,
            })
            expect(fetchMock).toHaveBeenCalledWith(
                `${API}/server/cnc/bash`,
                expect.objectContaining({ body: JSON.stringify({ command: 'gcode_macro CHECK', timeout: 15 }) })
            )
        })

        it('throws on non-2xx response with the failing path', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, 500))
            await expect(setCncSpindle(API, { state: 'cw' })).rejects.toThrow(
                'CNC request failed for /server/cnc/spindle: 500'
            )
        })

        it('returns unwrapped body when no result envelope present', async () => {
            fetchMock.mockResolvedValue(jsonResponse({ foo: 'bar' }))
            await expect(execBash(API, 'echo hi')).resolves.toEqual({ foo: 'bar' })
        })
    })
})
