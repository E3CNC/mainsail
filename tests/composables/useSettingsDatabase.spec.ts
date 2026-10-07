import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ apiUrl: { value: 'http://printer.local' } }),
}))

import { useSettingsDatabase } from '@/composables/useSettingsDatabase'

function jsonResponse(payload: unknown) {
    return { json: () => Promise.resolve(payload) }
}

describe('useSettingsDatabase', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('availableKeys lists the known namespaces', () => {
        const keys = useSettingsDatabase().availableKeys.value
        expect(keys.map((k) => k.value)).toContain('general')
        expect(keys.map((k) => k.value)).toContain('timelapse')
        expect(keys).toHaveLength(15)
    })

    it('sortNamespaces pins general first, then sorts by label', () => {
        const { sortNamespaces } = useSettingsDatabase()
        expect(sortNamespaces({ value: 'general', label: 'g' }, { value: 'a', label: 'a' })).toBe(-1)
        expect(sortNamespaces({ value: 'a', label: 'a' }, { value: 'general', label: 'g' })).toBe(1)
        expect(sortNamespaces({ value: 'b', label: 'Beta' }, { value: 'a', label: 'alpha' })).toBe(1)
        expect(sortNamespaces({ value: 'a', label: 'same' }, { value: 'b', label: 'same' })).toBe(0)
    })

    it('loadBackupableNamespaces resolves mainsail keys and extra namespaces', async () => {
        const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ result: { namespaces: ['mainsail', 'timelapse'] } }))
            .mockResolvedValueOnce(jsonResponse({ result: { value: { general: {}, console: {}, initVersion: 1 } } }))
        const namespaces = await useSettingsDatabase().loadBackupableNamespaces()
        expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://printer.local/server/database/list')
        expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://printer.local/server/database/item?namespace=mainsail')
        expect(namespaces.map((n) => n.value)).toEqual(['general', 'console', 'timelapse'])
    })

    it('loadBackupableNamespaces returns empty when the db list fails', async () => {
        const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
        fetchMock.mockRejectedValueOnce(new Error('down'))
        const error = vi.spyOn(window.console, 'error').mockImplementation(() => undefined)
        try {
            expect(await useSettingsDatabase().loadBackupableNamespaces()).toEqual([])
        } finally {
            error.mockRestore()
        }
    })
})
