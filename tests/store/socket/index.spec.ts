import { describe, expect, it, vi, afterEach } from 'vitest'

import { getDefaultState, socket } from '@/store/socket/index'

describe('store/socket/index', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('returns jsdom-derived defaults when no env overrides are set', () => {
        const s = getDefaultState()
        expect(s.hostname).toBe(window.location.hostname)
        expect(typeof s.port).toBe('number')
        expect(s.path).toBe('')
        expect(s.protocol).toBe(document.location.protocol === 'https:' ? 'wss' : 'ws')
        expect(s.reconnectInterval).toBe(2000)
        expect(s.isConnected).toBe(false)
        expect(s.initializationList).toEqual(['server'])
        expect(s.connection_id).toBeNull()
    })

    it('honors VUE_APP_* overrides', () => {
        vi.stubEnv('VUE_APP_HOSTNAME', 'printer.local')
        vi.stubEnv('VUE_APP_PORT', '7126')
        vi.stubEnv('VUE_APP_PATH', '/websocket')
        vi.stubEnv('VUE_APP_RECONNECT_INTERVAL', '5000')
        const s = getDefaultState()
        expect(s.hostname).toBe('printer.local')
        expect(s.port).toBe(7126)
        expect(s.path).toBe('/websocket')
        expect(s.reconnectInterval).toBe(5000)
    })

    it('exposes a namespaced socket module', () => {
        expect(socket.namespaced).toBe(true)
        expect(socket.getters).toBeDefined()
        expect(socket.actions).toBeDefined()
        expect(socket.mutations).toBeDefined()
    })
})
