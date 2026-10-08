import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/socket/mutations'
import { getDefaultState } from '@/store/socket/index'
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

describe('socket/mutations', () => {
    it('reset restores only the initialization list', () => {
        const s = state({ isConnected: true, initializationList: ['custom', 'server/history'] })
        mutations.reset(s)
        expect(s.initializationList).toEqual(getDefaultState().initializationList)
        expect(s.isConnected).toBe(true)
    })

    it('setConnected sets the connected flags', () => {
        const s = state({ isConnected: false, isConnecting: true, connectingFailed: true })
        mutations.setConnected(s)
        expect(s.isConnected).toBe(true)
        expect(s.isConnecting).toBe(false)
        expect(s.connectingFailed).toBe(false)
    })

    it('setDisconnected clears the connection without a message', () => {
        const s = state({
            isConnected: true,
            isConnecting: true,
            connection_id: 7,
            connectionFailedMessage: 'old message',
        })
        mutations.setDisconnected(s)
        expect(s.isConnected).toBe(false)
        expect(s.isConnecting).toBe(false)
        expect(s.connectingFailed).toBe(true)
        expect(s.connection_id).toBeNull()
        expect(s.connectionFailedMessage).toBe('old message')
    })

    it('setDisconnected stores the message when given', () => {
        const s = state()
        mutations.setDisconnected(s, 'connection refused')
        expect(s.connectionFailedMessage).toBe('connection refused')
    })

    it('setReconnecting counts attempts while reconnecting and resets after', () => {
        const s = state({ reconnectAttempts: 2 })
        mutations.setReconnecting(s, true)
        expect(s.reconnecting).toBe(true)
        expect(s.reconnectAttempts).toBe(3)
        mutations.setReconnecting(s, true)
        expect(s.reconnectAttempts).toBe(4)
        mutations.setReconnecting(s, false)
        expect(s.reconnecting).toBe(false)
        expect(s.reconnectAttempts).toBe(0)
    })

    it('setData assigns top-level keys', () => {
        const s = state()
        mutations.setData(s, { hostname: 'other.local', port: 80 })
        expect(s.hostname).toBe('other.local')
        expect(s.port).toBe(80)
    })

    it('setData unwraps the socket envelope', () => {
        const s = state()
        mutations.setData(s, { socket: { hostname: 'wrapped.local', port: 7126 } } as never)
        expect(s.hostname).toBe('wrapped.local')
        expect(s.port).toBe(7126)
    })

    it('addLoading and removeLoading track entries', () => {
        const s = state()
        mutations.addLoading(s, { name: 'sendGcode' })
        mutations.addLoading(s, { name: 'home' })
        expect(s.loadings).toEqual(['sendGcode', 'home'])
        mutations.removeLoading(s, { name: 'sendGcode' })
        expect(s.loadings).toEqual(['home'])
    })

    it('removeLoading ignores unknown entries', () => {
        const s = state({ loadings: ['home'] })
        mutations.removeLoading(s, { name: 'missing' })
        expect(s.loadings).toEqual(['home'])
    })

    it('clearLoadings empties a non-empty list and keeps an empty one', () => {
        const s = state({ loadings: ['a', 'b'] })
        mutations.clearLoadings(s)
        expect(s.loadings).toEqual([])
        const empty = state()
        mutations.clearLoadings(empty)
        expect(empty.loadings).toEqual([])
    })

    it('addInitModule adds new modules and ignores duplicates', () => {
        const s = state({ initializationList: ['server'] })
        mutations.addInitModule(s, 'server/history')
        expect(s.initializationList).toEqual(['server', 'server/history'])
        mutations.addInitModule(s, 'server/history')
        expect(s.initializationList).toEqual(['server', 'server/history'])
    })

    it('removeInitModule removes existing modules and ignores missing ones', () => {
        const s = state({ initializationList: ['server', 'server/history'] })
        mutations.removeInitModule(s, 'server/history')
        expect(s.initializationList).toEqual(['server'])
        mutations.removeInitModule(s, 'server/history')
        expect(s.initializationList).toEqual(['server'])
    })

    it('removeInitComponent removes every module with the prefix', () => {
        const s = state({ initializationList: ['server', 'server/spoolman/getActiveSpoolId', 'printer'] })
        mutations.removeInitComponent(s, 'server/spoolman')
        expect(s.initializationList).toEqual(['server', 'printer'])
    })

    it('removeInitComponent keeps the list when nothing matches', () => {
        const s = state({ initializationList: ['server', 'printer'] })
        mutations.removeInitComponent(s, 'gui')
        expect(s.initializationList).toEqual(['server', 'printer'])
    })
})
