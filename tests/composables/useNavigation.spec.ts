import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

const mocks = vi.hoisted(() => ({
    klippyConnected: true,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: { getters: Record<string, any>; state: Record<string, any> } = {
    getters: {},
    state: {},
}

vi.mock('vuex', () => ({
    useStore: () => store,
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        get klippyIsConnected() {
            return { value: mocks.klippyConnected }
        },
    }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const routesMock: any[] = vi.hoisted(() => [])

vi.mock('@/routes', () => ({
    default: routesMock,
}))

import { useNavigation } from '@/composables/useNavigation'

function defaultState() {
    return {
        server: {
            klippy_state: 'ready',
            components: ['history'],
            registered_directories: ['gcodes'],
        },
        printer: {
            configfile: { settings: { extruder: {} } },
        },
        gui: {
            navigationSettings: { entries: [] },
            uiSettings: { boolWebcamNavi: false },
        },
    }
}

function route(overrides = {}) {
    return {
        title: 'Dashboard',
        path: '/',
        icon: 'mdi-view',
        showInNavi: true,
        position: 1,
        ...overrides,
    }
}

describe('useNavigation', () => {
    beforeEach(() => {
        mocks.klippyConnected = true
        routesMock.length = 0
        store.getters = {
            'farm/countPrinters': 0,
            'files/getCustomNaviPoints': '',
            'gui/webcams/getWebcams': [],
        }
        store.state = reactive(defaultState())
    })

    it('adds the printers point when farm printers exist', () => {
        store.getters['farm/countPrinters'] = 2
        const points = useNavigation().routesNaviPoints.value
        expect(points.find((p) => p.to === '/allCncMachines')).toBeTruthy()
    })

    it('builds route points with default positions', () => {
        routesMock.push(route())
        const points = useNavigation().routesNaviPoints.value
        expect(points).toHaveLength(1)
        expect(points[0].to).toBe('/')
        expect(points[0].visible).toBe(true)
    })

    it('hides routes when klippy is down unless alwaysShow', () => {
        routesMock.push(route(), route({ title: 'Other', path: '/other', alwaysShow: true }))
        store.state.server.klippy_state = 'error'
        const points = useNavigation().routesNaviPoints.value
        expect(points.map((p) => p.to)).toEqual(['/other'])
    })

    it('showInNavi gates webcam, components, directories and klipper parts', () => {
        const n = useNavigation()
        expect(n.showInNavi(route({ title: 'Webcam' }) as never)).toBe(false)
        store.getters['gui/webcams/getWebcams'] = [{}]
        expect(useNavigation().showInNavi(route({ title: 'Webcam' }) as never)).toBe(true)
        expect(n.showInNavi(route({ moonrakerComponent: 'spoolman' }) as never)).toBe(false)
        expect(n.showInNavi(route({ moonrakerComponent: 'history' }) as never)).toBe(true)
        expect(n.showInNavi(route({ registeredDirectory: 'timelapse' }) as never)).toBe(false)
        expect(n.showInNavi(route({ registeredDirectory: 'gcodes' }) as never)).toBe(true)
        expect(n.showInNavi(route({ klipperComponent: 'bed_mesh' }) as never)).toBe(false)
        expect(n.showInNavi(route({ klipperComponent: 'extruder' }) as never)).toBe(true)
        mocks.klippyConnected = false
        expect(n.showInNavi(route({ klipperIsConnected: true }) as never)).toBe(false)
    })

    it('getUiSettings returns stored positions, defaults when missing', () => {
        store.state.gui.navigationSettings.entries = [
            { type: 'route', title: 'Dashboard', position: 5, visible: false },
        ]
        const n = useNavigation()
        expect(n.getUiSettings({ type: 'route', title: 'Dashboard', position: 1, visible: true })).toEqual([5, false])
        expect(n.getUiSettings({ type: 'route', title: 'Missing', position: 3, visible: true })).toEqual([3, true])
    })

    it('naviPoints sorts by position and visibleNaviPoints filters', () => {
        routesMock.push(route({ position: 9 }), route({ title: 'Second', path: '/s', position: 1 }))
        const n = useNavigation()
        expect(n.naviPoints.value.map((p) => p.to)).toEqual(['/s', '/'])
        expect(n.visibleNaviPoints.value).toHaveLength(2)
    })
})
