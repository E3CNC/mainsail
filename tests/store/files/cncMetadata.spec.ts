import { describe, expect, it, vi, afterEach } from 'vitest'
import { buildCncMetadataViewModel, loadCncMetadata, type CncMetadata } from '@/store/files/cncMetadata'

describe('buildCncMetadataViewModel', () => {
    it('returns null for undefined/null metadata', () => {
        expect(buildCncMetadataViewModel(undefined)).toBeNull()
        expect(buildCncMetadataViewModel(null)).toBeNull()
    })

    it('falls back to "--" when metadata fields are absent', () => {
        const view = buildCncMetadataViewModel({
            schema_version: 1,
        })
        expect(view).not.toBeNull()
        expect(view!.camTool).toBe('--')
        expect(view!.workEnvelope).toBe('--')
        expect(view!.stock).toBe('--')
        expect(view!.tool).toBe('--')
        expect(view!.spindle).toBe('--')
        expect(view!.feeds).toBe('--')
        expect(view!.plungeFeed).toBe('--')
    })

    it('formats cam tool, envelope, stock, tool, spindle, and feeds', () => {
        const metadata: CncMetadata = {
            schema_version: 1,
            cam_tool: 'Fusion360',
            work_envelope: { x_min: 0, x_max: 200, y_min: 0, y_max: 100, z_min: -5, z_max: 50 },
            stock: { x: { size: 200 }, y: { size: 100 }, z: { size: 20 } },
            tools: [{ id: 'T1', type: 'flat', diameter_mm: 6 }],
            spindle_rpm: 12000,
            feeds_mm_per_min: { plunge: 100, cut: 500, rapid: 3000 },
        }
        const view = buildCncMetadataViewModel(metadata)!
        expect(view.camTool).toBe('Fusion360')
        expect(view.workEnvelope).toBe('X 0 → 200 · Y 0 → 100 · Z -5 → 50')
        expect(view.stock).toBe('X 200 mm · Y 100 mm · Z 20 mm')
        expect(view.tool).toBe('T1 · flat · 6 mm')
        expect(view.spindle).toBe('12000 RPM')
        expect(view.plungeFeed).toBe('100 mm/min')
        expect(view.cutFeed).toBe('500 mm/min')
        expect(view.rapidFeed).toBe('3000 mm/min')
        expect(view.feeds).toBe('Plunge 100 · Cut 500 · Rapid 3000 mm/min')
    })

    it('handles partial envelope bounds as "--"', () => {
        const view = buildCncMetadataViewModel({
            schema_version: 1,
            work_envelope: { x_min: 0, x_max: 200 },
            stock: {},
        })!
        expect(view.workEnvelope).toBe('X 0 → 200 · Y -- · Z --')
        expect(view.stock).toBe('X -- · Y -- · Z --')
        expect(view.tool).toBe('--')
    })

    it('drops trailing zeros from numeric formatting', () => {
        const view = buildCncMetadataViewModel({
            schema_version: 1,
            spindle_rpm: 10000.0,
            feeds_mm_per_min: { plunge: 100.5, cut: 300.0, rapid: 2500 },
        })!
        expect(view.spindle).toBe('10000 RPM')
        expect(view.plungeFeed).toBe('100.5 mm/min')
        expect(view.cutFeed).toBe('300 mm/min')
    })

    it('builds a card fields list', () => {
        const view = buildCncMetadataViewModel({
            schema_version: 1,
            work_envelope: { x_min: 0, x_max: 100 },
            spindle_rpm: 6000,
        })!
        expect(view.fields).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ label: 'Work Envelope', value: 'X 0 → 100' }),
                expect.objectContaining({ label: 'Spindle', value: '6000 RPM' }),
            ])
        )
        expect(view.fields).toHaveLength(5)
    })
})

describe('loadCncMetadata', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('returns null on non-ok response', async () => {
        const origDateNow = Date.now
        Date.now = () => 1234
        try {
            fetchMock = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }))
            vi.stubGlobal('fetch', fetchMock)
            await expect(loadCncMetadata('http://m', 'dir/file name')).resolves.toBeNull()
            expect(fetchMock).toHaveBeenCalledWith('http://m/server/files/gcodes/dir/file%20name.cnc-meta.json?_t=1234')
        } finally {
            Date.now = origDateNow
        }
    })

    it('returns the parsed metadata payload', async () => {
        const payload = { schema_version: 1, cam_tool: 'Fusion360' }
        fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        await expect(loadCncMetadata('http://m', 'job1')).resolves.toEqual(payload)
    })

    it('returns null when the payload is not an object', async () => {
        fetchMock = vi.fn().mockResolvedValue(new Response('42', { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        await expect(loadCncMetadata('http://m', 'job1')).resolves.toBeNull()
    })

    it('returns null when fetch rejects', async () => {
        fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
        vi.stubGlobal('fetch', fetchMock)
        await expect(loadCncMetadata('http://m', 'job1')).resolves.toBeNull()
    })
})
