import { describe, expect, it } from 'vitest'

import { getDefaultState, printer } from '@/store/farm/printer/index'
import type { FarmPrinterState } from '@/store/farm/printer/types'

describe('store/farm/printer/index', () => {
    it('returns the default state', () => {
        const s = getDefaultState()
        expect(s._namespace).toBe('')
        expect(s.socket.port).toBe(7125)
        expect(s.socket.protocol).toBe(document.location.protocol === 'https:' ? 'wss' : 'ws')
        expect(s.data.webcams).toEqual([])
        expect(s.databases).toEqual([])
    })

    it('state() factory returns a fresh default state', () => {
        expect(typeof printer.state).toBe('function')
        const s = (printer.state as unknown as () => FarmPrinterState)()
        expect(s._namespace).toBe('')
        expect(s.socket.port).toBe(7125)
    })

    it('exposes a namespaced printer module', () => {
        expect(printer.namespaced).toBe(true)
        expect(printer.getters).toBeDefined()
        expect(printer.actions).toBeDefined()
        expect(printer.mutations).toBeDefined()
    })
})
