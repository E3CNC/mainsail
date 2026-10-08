import { describe, expect, it } from 'vitest'
import { buildJogScript, isEditableTarget } from '@/components/panels/Cnc/jogKeyboard'

describe('jogKeyboard isEditableTarget', () => {
    it('returns false for null', () => {
        expect(isEditableTarget(null)).toBe(false)
    })

    it('returns false for a plain div target', () => {
        const el = document.createElement('div')
        expect(isEditableTarget(el)).toBe(false)
    })

    it('returns true for input targets', () => {
        const el = document.createElement('input')
        expect(isEditableTarget(el)).toBe(true)
    })

    it('returns true for textarea targets', () => {
        const el = document.createElement('textarea')
        expect(isEditableTarget(el)).toBe(true)
    })

    it('returns true for select targets', () => {
        const el = document.createElement('select')
        expect(isEditableTarget(el)).toBe(true)
    })

    it('matches tag names case-insensitively', () => {
        const el = { tagName: 'input', isContentEditable: false }
        expect(isEditableTarget(el as never)).toBe(true)
    })

    it('returns true for contentEditable elements', () => {
        const el = document.createElement('div')
        Object.defineProperty(el, 'isContentEditable', { value: true })
        expect(isEditableTarget(el)).toBe(true)
    })
})

describe('jogKeyboard buildJogScript', () => {
    it('wraps a relative move in save/restore state', () => {
        const script = buildJogScript('X', 1, 500)
        expect(script).toBe(
            'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 X1 F30000\nRESTORE_GCODE_STATE NAME=_ui_movement'
        )
    })

    it('converts the feedrate from mm/s to mm/min', () => {
        expect(buildJogScript('Y', 10, 100)).toContain('G1 Y10 F6000')
    })

    it('keeps negative distances for reverse moves', () => {
        expect(buildJogScript('Z', -0.1, 100)).toContain('G1 Z-0.1 F6000')
    })

    it('builds fractional-step scripts exactly', () => {
        expect(buildJogScript('X', 0.05, 500)).toContain('G1 X0.05 F30000')
    })
})
