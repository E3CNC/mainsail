import { describe, expect, it } from 'vitest'
import { getters } from '@/store/socket/getters'
import type { SocketState } from '@/store/socket/types'

function state(overrides: Partial<SocketState> = {}): SocketState {
    return {
        hostname: 'printer.local',
        port: 7125,
        path: '',
        protocol: 'ws',
        reconnectInterval: 2000,
        isConnected: false,
        isConnecting: false,
        connectingFailed: false,
        connectionFailedMessage: null,
        loadings: [],
        initializationList: [],
        connection_id: null,
        reconnectAttempts: 0,
        reconnecting: false,
        ...overrides,
    }
}

function getUrl(s: SocketState): string {
    return getters.getUrl(s, undefined as never, undefined as never, undefined as never)
}

describe('socket/getters', () => {
    it('getUrl includes a non-default port', () => {
        expect(getUrl(state({ hostname: 'printer.local', port: 7125, path: '' }))).toBe('//printer.local:7125')
    })

    it('getUrl omits port 80', () => {
        expect(getUrl(state({ hostname: 'printer.local', port: 80, path: '' }))).toBe('//printer.local')
    })

    it('getUrl normalizes single leading and trailing slashes', () => {
        expect(getUrl(state({ path: 'api' }))).toBe('//printer.local:7125/api')
        expect(getUrl(state({ path: '/api' }))).toBe('//printer.local:7125/api')
        expect(getUrl(state({ path: 'api/' }))).toBe('//printer.local:7125/api')
        expect(getUrl(state({ path: '/api/' }))).toBe('//printer.local:7125/api')
    })

    it('getUrl drops a root-only path', () => {
        expect(getUrl(state({ path: '/' }))).toBe('//printer.local:7125')
    })

    it('getUrl collapses a leftover trailing slash', () => {
        expect(getUrl(state({ path: 'api//' }))).toBe('//printer.local:7125/api')
    })

    it('getHostUrl maps wss to https and anything else to http', () => {
        const https = getters.getHostUrl(
            state({ protocol: 'wss', hostname: 'printer.local' }),
            undefined as never,
            undefined as never,
            undefined as never
        )
        expect(https).toBe('https://printer.local/')

        const http = getters.getHostUrl(
            state({ protocol: 'ws', hostname: 'printer.local' }),
            undefined as never,
            undefined as never,
            undefined as never
        )
        expect(http).toBe('http://printer.local/')
    })

    it('getWebsocketUrl appends the websocket suffix', () => {
        const url = getters.getWebsocketUrl(
            state({ protocol: 'ws' }),
            { getUrl: '//printer.local:7125/api' } as never,
            undefined as never,
            undefined as never
        )
        expect(url).toBe('ws://printer.local:7125/api/websocket')

        const secure = getters.getWebsocketUrl(
            state({ protocol: 'wss' }),
            { getUrl: '//printer.local' } as never,
            undefined as never,
            undefined as never
        )
        expect(secure).toBe('wss://printer.local/websocket')
    })
})
