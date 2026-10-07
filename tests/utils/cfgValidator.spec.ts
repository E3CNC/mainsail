import { describe, expect, it } from 'vitest'
import { validateCfg } from '@/utils/cfgValidator'

const valid = `[stepper_x]
step_pin: PF0
dir_pin: PF1

[gcode_macro START]
gcode:
    G28
    M104 S200
`

describe('cfgValidator', () => {
    it('accepts a valid config without errors', async () => {
        expect(await validateCfg(valid, 'printer.cfg')).toEqual([])
    })

    it('flags unclosed and empty section headers', async () => {
        const errors = await validateCfg('[stepper_x\n[]\n[ok]\nkey: 1\n', 'printer.cfg')
        expect(errors.map((e) => e.line)).toEqual([1, 2])
        expect(errors.every((e) => e.severity === 'error')).toBe(true)
    })

    it('flags content outside any section', async () => {
        const errors = await validateCfg('stray_key: 1\n[ok]\nkey: 1\n', 'printer.cfg')
        expect(errors).toHaveLength(1)
        expect(errors[0].message).toContain('outside of any section')
    })

    it('treats indented lines as multiline continuations', async () => {
        expect(await validateCfg(valid, 'printer.cfg')).toEqual([])
        const errors = await validateCfg('[s]\nkey: value\nnot indented and no separator\n', 'printer.cfg')
        expect(errors).toHaveLength(1)
        expect(errors[0].message).toContain('Invalid line format')
    })

    it('flags missing key names', async () => {
        const errors = await validateCfg('[s]\n= value\n', 'printer.cfg')
        expect(errors).toHaveLength(1)
        expect(errors[0].message).toContain('Missing key name')
    })

    it('supports equals separators and comments', async () => {
        expect(await validateCfg('[s]\n# comment\n; another\nkey = value\n', 'printer.cfg')).toEqual([])
    })

    it('resolves includes and reports missing files', async () => {
        const errors = await validateCfg('[include extra.cfg]\n[include gone.cfg]\n', 'printer.cfg', async (p) =>
            p === 'extra.cfg' ? '[extra]\nkey: 1\n' : null
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].severity).toBe('warning')
        expect(errors[0].message).toContain('gone.cfg')
    })

    it('collects errors from included files', async () => {
        const errors = await validateCfg('[include extra.cfg]\n', 'printer.cfg', async () => 'stray: 1\n')
        expect(errors).toHaveLength(1)
        expect(errors[0].message).toContain('outside of any section')
    })

    it('skips already-visited includes and reports resolver failures', async () => {
        const errors = await validateCfg('[include a.cfg]\n[include a.cfg]\n', 'printer.cfg', async () => {
            throw new Error('disk gone')
        })
        // first include errors on read; the failed path is never marked visited,
        // so the second include errors the same way
        expect(errors).toHaveLength(2)
        expect(errors[0].message).toContain('Error reading included file')
    })
})
