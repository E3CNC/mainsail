import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { dispatch: ReturnType<typeof vi.fn>; getters: Record<string, any>; state: Record<string, any> } = {
    dispatch: vi.fn(),
    getters: {},
    state: {},
}

vi.mock('vuex', () => ({
    useStore: () => store,
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

import { useGcodeFiles } from '@/composables/useGcodeFiles'

function defaultState() {
    return {
        gui: {
            view: {
                gcodefiles: {
                    search: '',
                    currentPath: '',
                    showHiddenFiles: false,
                    showCompletedFiles: true,
                    hideMetadataColumns: [],
                    orderMetadataColumns: [],
                    selectedFiles: [],
                },
            },
        },
    }
}

const gcodeFiles = [{ filename: 'benchy.gcode' }, { filename: 'cube.gcode' }]

describe('useGcodeFiles', () => {
    beforeEach(() => {
        store.dispatch.mockReset()
        store.state = reactive(defaultState())
        store.getters = {
            'files/getGcodeFiles': vi.fn(() => gcodeFiles),
        }
    })

    it('reads search, path and visibility flags with defaults', () => {
        const g = useGcodeFiles()
        expect(g.search.value).toBe('')
        expect(g.currentPath.value).toBe('')
        expect(g.showHiddenFiles.value).toBe(false)
        expect(g.showCompletedFiles.value).toBe(true)
        expect(g.selectedFiles.value).toEqual([])
    })

    it("maps the legacy 'gcodes' root path to empty", () => {
        store.state.gui.view.gcodefiles.currentPath = 'gcodes'
        expect(useGcodeFiles().currentPath.value).toBe('')
    })

    it('setters dispatch gui/saveSetting with the right names', () => {
        const g = useGcodeFiles()
        g.setSearch('benchy')
        g.setCurrentPath('sub/dir')
        g.setShowHiddenFiles(true)
        g.setShowCompletedFiles(false)
        g.setSelectedFiles(['benchy.gcode'])
        expect(store.dispatch).toHaveBeenNthCalledWith(1, 'gui/saveSetting', {
            name: 'view.gcodefiles.search',
            value: 'benchy',
        })
        expect(store.dispatch).toHaveBeenNthCalledWith(2, 'gui/saveSetting', {
            name: 'view.gcodefiles.currentPath',
            value: 'sub/dir',
        })
        expect(store.dispatch).toHaveBeenNthCalledWith(3, 'gui/saveSetting', {
            name: 'view.gcodefiles.showHiddenFiles',
            value: true,
        })
        expect(store.dispatch).toHaveBeenNthCalledWith(4, 'gui/saveSetting', {
            name: 'view.gcodefiles.showCompletedFiles',
            value: false,
        })
        expect(store.dispatch).toHaveBeenNthCalledWith(5, 'gui/saveSetting', {
            name: 'view.gcodefiles.selectedFiles',
            value: ['benchy.gcode'],
        })
    })

    it('files delegates to the getter with path and visibility flags', () => {
        store.state.gui.view.gcodefiles.currentPath = 'sub'
        const g = useGcodeFiles()
        expect(g.files.value).toEqual(gcodeFiles)
        expect(store.getters['files/getGcodeFiles']).toHaveBeenCalledWith('sub', false, true)
    })

    it('existsFilename matches on filename', () => {
        const g = useGcodeFiles()
        expect(g.existsFilename('benchy.gcode')).toBe(true)
        expect(g.existsFilename('missing.gcode')).toBe(false)
    })

    it('configurableHeaders hides columns listed in hideMetadataColumns', () => {
        store.state.gui.view.gcodefiles.hideMetadataColumns = ['size']
        const headers = useGcodeFiles().configurableHeaders.value
        expect(headers.find((h) => h.value === 'size')?.visible).toBe(false)
        expect(headers.find((h) => h.value === 'modified')?.visible).toBe(true)
    })

    it('configurableHeaders respects a custom column order', () => {
        store.state.gui.view.gcodefiles.orderMetadataColumns = ['slicer', 'size']
        const values = useGcodeFiles().configurableHeaders.value.map((h) => h.value)
        expect(values[0]).toBe('slicer')
        expect(values[1]).toBe('size')
    })

    it('headers combine fixed and configurable; filteredHeaders drops hidden', () => {
        store.state.gui.view.gcodefiles.hideMetadataColumns = ['size']
        const g = useGcodeFiles()
        expect(g.headers.value.length).toBe(3 + g.configurableHeaders.value.length)
        expect(g.headers.value.slice(0, 3).map((h) => h.value)).toEqual(['', 'filename', 'status'])
        expect(g.filteredHeaders.value.find((h) => h.value === 'size')).toBeUndefined()
        expect(g.tableColumns.value.find((c) => c.value === 'size')).toBeUndefined()
    })

    it('setConfigurableHeaders persists the value order', () => {
        useGcodeFiles().setConfigurableHeaders([
            { text: 'Slicer', value: 'slicer', visible: true },
            { text: 'Size', value: 'size', visible: true },
        ])
        expect(store.dispatch).toHaveBeenCalledWith('gui/saveSetting', {
            name: 'view.gcodefiles.orderMetadataColumns',
            value: ['slicer', 'size'],
        })
    })

    it('setHideMetadataColumns / setOrderMetadataColumns persist', () => {
        const g = useGcodeFiles()
        g.setHideMetadataColumns(['size'])
        g.setOrderMetadataColumns(['slicer'])
        expect(store.dispatch).toHaveBeenNthCalledWith(1, 'gui/saveSetting', {
            name: 'view.gcodefiles.hideMetadataColumns',
            value: ['size'],
        })
        expect(store.dispatch).toHaveBeenNthCalledWith(2, 'gui/saveSetting', {
            name: 'view.gcodefiles.orderMetadataColumns',
            value: ['slicer'],
        })
    })
})
