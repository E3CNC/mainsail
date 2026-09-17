// .cfg file validator for Klipper configuration files.
// It intentionally follows Klipper's parser model more closely than a
// generic INI validator: duplicate sections are allowed, [include ...]
// headers are special, and indented lines are continuation lines for
// multi-line options such as gcode: blocks.

export interface CfgValidationError {
    line: number
    message: string
    severity: 'error' | 'warning'
}

interface CfgSection {
    name: string
    startLine: number
}

interface ParseContext {
    errors: CfgValidationError[]
    sections: CfgSection[]
    filePath: string
    visitedFiles: Set<string>
}

/**
 * Validate a .cfg file content with full Klipper-style parsing.
 * @param content - The file content to validate
 * @param fileName - The name of the file (for error messages)
 * @param includeResolver - Optional async function to resolve [include] file contents
 */
export async function validateCfg(
    content: string,
    fileName: string,
    includeResolver?: (path: string) => Promise<string | null>
): Promise<CfgValidationError[]> {
    const normalizedFileName = normalizePath(fileName)
    const ctx: ParseContext = {
        errors: [],
        sections: [],
        filePath: normalizedFileName,
        visitedFiles: new Set(),
    }

    ctx.visitedFiles.add(normalizedFileName)
    await parseContent(content, ctx, includeResolver)
    return ctx.errors
}

async function parseContent(
    content: string,
    ctx: ParseContext,
    includeResolver?: (path: string) => Promise<string | null>
): Promise<void> {
    const lines = content.split('\n')
    let currentSection: string | null = null
    let currentOption: string | null = null

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i]
        const lineNum = i + 1
        const trimmed = rawLine.trim()

        // Skip empty lines and comments
        if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) continue

        // Check for section header: [section_name]
        if (trimmed.startsWith('[')) {
            // Validate section header format
            if (!trimmed.endsWith(']')) {
                ctx.errors.push({
                    line: lineNum,
                    message: `Unclosed section header: "${trimmed}". Section headers must end with "]".`,
                    severity: 'error',
                })
                continue
            }

            // Check for content inside brackets
            const sectionName = trimmed.slice(1, -1).trim()
            if (sectionName === '') {
                ctx.errors.push({
                    line: lineNum,
                    message: `Empty section header. Section name is required between brackets.`,
                    severity: 'error',
                })
                continue
            }

            currentSection = sectionName
            currentOption = null
            ctx.sections.push({ name: sectionName, startLine: lineNum })

            continue
        }

        // Check for key=value or key:value format
        if (currentSection === null) {
            ctx.errors.push({
                line: lineNum,
                message: `Content outside of any section: "${truncate(trimmed, 40)}". All configuration must be inside a [section].`,
                severity: 'error',
            })
            continue
        }

        // Klipper uses RawConfigParser semantics, so any indented line after a
        // parsed option is part of that option's multiline value.
        if (currentOption !== null && isIndented(rawLine)) {
            continue
        }

        // Check if line looks like a key=value pair
        const eqIdx = trimmed.indexOf('=')
        const colonIdx = trimmed.indexOf(':')

        if (eqIdx === -1 && colonIdx === -1) {
            ctx.errors.push({
                line: lineNum,
                message: `Invalid line format: "${truncate(trimmed, 40)}". Expected option syntax like key: value or key = value.`,
                severity: 'error',
            })
            continue
        }

        // Validate key part
        const key = eqIdx !== -1 ? trimmed.slice(0, eqIdx).trim() : trimmed.slice(0, colonIdx).trim()
        if (key === '') {
            ctx.errors.push({
                line: lineNum,
                message: `Missing key name before "=": "${truncate(trimmed, 40)}".`,
                severity: 'error',
            })
            currentOption = null
            continue
        }

        currentOption = key.toLowerCase()
    }

    // Check for [include] directives - parse raw line for the path
    // We do this in a second pass to keep parsing clean
    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i].trim()
        const lineNum = i + 1
        const includePath = getIncludePath(rawLine)
        if (includePath && includeResolver) {
            const resolvedIncludePath = resolveIncludePath(ctx.filePath, includePath)
            try {
                const includedContent = await includeResolver(includePath)
                if (includedContent !== null) {
                    if (!ctx.visitedFiles.has(resolvedIncludePath)) {
                        ctx.visitedFiles.add(resolvedIncludePath)
                        const subCtx: ParseContext = {
                            errors: ctx.errors,
                            sections: ctx.sections,
                            filePath: resolvedIncludePath,
                            visitedFiles: ctx.visitedFiles,
                        }
                        await parseContent(includedContent, subCtx, includeResolver)
                    }
                } else {
                    ctx.errors.push({
                        line: lineNum,
                        message: `Included file not found: "${includePath}".`,
                        severity: 'warning',
                    })
                }
            } catch {
                ctx.errors.push({
                    line: lineNum,
                    message: `Error reading included file: "${includePath}".`,
                    severity: 'warning',
                })
            }
        }
    }
}

function getIncludePath(rawLine: string): string | null {
    // Extract path from: [include path/to/file.cfg]
    const match = rawLine.match(/^\[include\s+(.+?)\]$/i)
    if (match) {
        return match[1].replace(/^["']|["']$/g, '')
    }
    return null
}

function isIndented(line: string): boolean {
    return line.length > 0 && /\s/.test(line[0])
}

function resolveIncludePath(baseFilePath: string, includePath: string): string {
    if (includePath.startsWith('/')) return normalizePath(includePath)

    const normalizedBase = normalizePath(baseFilePath)
    const lastSlashIndex = normalizedBase.lastIndexOf('/')
    const baseDir = lastSlashIndex === -1 ? '' : normalizedBase.slice(0, lastSlashIndex)
    return normalizePath(baseDir ? `${baseDir}/${includePath}` : includePath)
}

function normalizePath(path: string): string {
    const normalized = path.replace(/\\/g, '/')
    const parts: string[] = []

    for (const segment of normalized.split('/')) {
        if (!segment || segment === '.') continue
        if (segment === '..') {
            if (parts.length > 0 && parts[parts.length - 1] !== '..') parts.pop()
            else parts.push('..')
            continue
        }
        parts.push(segment)
    }

    return normalized.startsWith('/') ? `/${parts.join('/')}` : parts.join('/')
}

function truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}
