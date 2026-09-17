import { describe, expect, it, beforeEach } from 'vitest'
import {
    dbListNamespaces,
    dbGetItem,
    dbPostItem,
    dbDeleteItem,
    resetDb,
    unflatten,
    getDb,
} from '@/utils/mockMoonrakerDb'

describe('mock-moonraker database', () => {
    beforeEach(() => {
        resetDb()
    })

    describe('unflatten', () => {
        it('reconstructs nested objects from flat dot-notation keys', () => {
            const flat = { 'a.b.c': 1, 'a.b.d': 2, 'x': 3 }
            const result = unflatten(flat)
            expect(result).toEqual({ a: { b: { c: 1, d: 2 } }, x: 3 })
        })

        it('handles single-level keys', () => {
            const flat = { foo: 'bar' }
            expect(unflatten(flat)).toEqual({ foo: 'bar' })
        })

        it('handles empty object', () => {
            expect(unflatten({})).toEqual({})
        })

        it('creates intermediate objects when parent key conflicts with a leaf', () => {
            const flat = { 'a': 1, 'a.b': 2 }
            const result = unflatten(flat)
            expect(result.a).toEqual({ b: 2 })
        })
    })

    describe('list namespaces', () => {
        it('returns default namespaces', () => {
            const result = dbListNamespaces()
            expect(result.namespaces).toContain('mainsail')
            expect(result.namespaces).toContain('maintenance')
        })
    })

    describe('get item', () => {
        it('returns empty object for fresh namespace', () => {
            const result = dbGetItem('testns')
            expect(result.value).toEqual({})
            expect(result.namespaces).toContain('testns')
        })

        it('returns stored value when key exists', () => {
            const db = getDb()
            db.mainsail!['test.key'] = { foo: 'bar', count: 42 }

            const result = dbGetItem('mainsail', 'test.key')
            expect(result.value).toEqual({ foo: 'bar', count: 42 })
            expect(result.key).toBe('test.key')
        })

        it('returns unflattened value for namespace without key', () => {
            const db = getDb()
            db.mainsail!['nested.deep.value'] = { data: 'test' }

            const result = dbGetItem('mainsail')
            expect(result.value).toBeDefined()
            const nested = (result.value as Record<string, unknown>)['nested'] as Record<string, unknown>
            expect(typeof nested).toBe('object')
            expect((nested?.deep as Record<string, unknown>)?.value).toEqual({ data: 'test' })
        })

        it('returns empty object for unknown namespace', () => {
            const result = dbGetItem('unknown')
            expect(result.value).toEqual({})
        })
    })

    describe('post item', () => {
        it('stores items by key', () => {
            const storeRes = dbPostItem('mainsail', 'my.key', { foo: 'bar', count: 42 })
            expect(storeRes).toEqual({})

            const getRes = dbGetItem('mainsail', 'my.key')
            expect(getRes.value).toEqual({ foo: 'bar', count: 42 })
        })

        it('creates namespace if it does not exist', () => {
            dbPostItem('newns', 'k', { v: 1 })
            const result = dbGetItem('newns', 'k')
            expect(result.value).toEqual({ v: 1 })
        })
    })

    describe('delete item', () => {
        it('deletes items by key', () => {
            const db = getDb()
            db.mainsail!['del.key'] = { x: 1 }

            const delRes = dbDeleteItem('mainsail', 'del.key')
            expect(delRes).toEqual({})

            const getRes = dbGetItem('mainsail', 'del.key')
            expect(getRes.value).toEqual({})
        })

        it('returns empty namespace value for missing key', () => {
            const getRes = dbGetItem('mainsail', 'nonexistent')
            expect(getRes.value).toEqual({})
        })
    })
})
