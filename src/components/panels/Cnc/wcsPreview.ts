export const previewCursorStyle = { cursor: 'none' } as const

export function getCursorTooltipPosition(clientX: number, clientY: number) {
    return {
        left: clientX + 18,
        top: clientY - 34,
    }
}
