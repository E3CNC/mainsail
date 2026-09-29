import { describe, expect, it } from 'vitest'
import { formatConsoleMessage, isRecord, parseNumber } from '@/plugins/helpers'

describe('helpers', () => {
    describe('formatConsoleMessage', () => {
        it('keeps plain messages unchanged', () => {
            expect(formatConsoleMessage('Stats ')).toBe('Stats')
        })

        it('converts linebreaks to <br>', () => {
            expect(formatConsoleMessage('one\ntwo')).toBe('one<br>two')
        })

        it('strips echo:, debug: and // prefixes', () => {
            expect(formatConsoleMessage('echo: hello')).toBe('hello')
            expect(formatConsoleMessage('debug: x=1')).toBe('x=1')
            expect(formatConsoleMessage('// configfile changed')).toBe('configfile changed')
        })

        it('sanitizes script tags from klipper responses', () => {
            const out = formatConsoleMessage('<script>alert(1)</script>saved')
            expect(out).not.toContain('<script>')
            expect(out).toContain('saved')
        })

        it('sanitizes event handler attributes', () => {
            const out = formatConsoleMessage('<img src=x onerror="alert(1)">')
            expect(out).not.toContain('onerror')
        })
    })

    describe('parseNumber', () => {
        it('returns number values unchanged', () => {
            expect(parseNumber(250, 0)).toBe(250)
        })

        it('parses numeric strings', () => {
            expect(parseNumber('250', 0)).toBe(250)
            expect(parseNumber('0.400', 0)).toBe(0.4)
        })

        it('returns fallback for undefined or invalid values', () => {
            expect(parseNumber(undefined, 170)).toBe(170)
            expect(parseNumber('abc', 170)).toBe(170)
            expect(parseNumber(Infinity, 170)).toBe(170)
        })
    })

    describe('isRecord', () => {
        it('returns true for plain objects', () => {
            expect(isRecord({ foo: 'bar' })).toBe(true)
        })

        it('returns false for null', () => {
            expect(isRecord(null)).toBe(false)
        })

        it('returns false for arrays', () => {
            expect(isRecord(['a', 'b'])).toBe(false)
        })

        it('returns false for primitives', () => {
            expect(isRecord('foo')).toBe(false)
            expect(isRecord(1)).toBe(false)
            expect(isRecord(true)).toBe(false)
        })
    })
})
