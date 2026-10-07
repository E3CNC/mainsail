// E2E against `npm run mock` (fake Moonraker on 127.0.0.1:7125), which also
// serves the built frontend from dist/ same-origin (see mock-moonraker.cjs).
//
// Covers the CNC interactions the Docker-harness spec cannot exercise: the
// harness Moonraker has no Klipper attached and no `/server/cnc/*`
// endpoints, while the mock simulates motion (G28/G91/G0/G1), WCS select,
// spindle/coolant state, and a seeded gcode file.
//
// Uses absolute URLs so it runs regardless of the configured baseUrl (which
// defaults to the harness at :8080). CI runs this file as its own job with
// `--spec` (see .github/workflows/ci.yml).
const MOCK = 'http://127.0.0.1:7125'

describe('CNC mock — E3CNC fork', () => {
    it('connects to the mock and renders the full layout', () => {
        cy.visit(`${MOCK}/`)
        cy.get('.sidebar-shell', { timeout: 20000 }).should('exist')
        cy.get('#page-container', { timeout: 20000 }).should('exist')
    })

    it('DRO renders the mock machine state', () => {
        cy.visit(`${MOCK}/`)
        cy.get('.dro-panel', { timeout: 20000 }).should('exist')
        // Mock starts at machine [100, 100, 10] with G54 offsets at zero.
        cy.get('.dro-panel__axis-card')
            .first()
            .within(() => {
                cy.contains('.dro-panel__axis-section', 'Work').find('.dro-panel__value').should('have.text', '100')
            })
    })

    it('jog moves the toolhead (observable in the DRO)', () => {
        cy.visit(`${MOCK}/`)
        const workValue = () =>
            cy
                .get('.dro-panel__axis-card', { timeout: 20000 })
                .first()
                .contains('.dro-panel__axis-section', 'Work')
                .find('.dro-panel__value')

        let before = ''
        workValue()
            .invoke('text')
            .then((text: string) => {
                before = text
            })
        // XY pad order: +Y, -X, stop, +X, -Y — the 4th button jogs +X.
        cy.get('.jog-panel__xy-btn').eq(3).click()
        // The frontend only learns the new position on the mock's 2s status
        // broadcast; allow ample time.
        workValue().should(
            ($el) => {
                expect($el.text()).not.to.eq(before)
            },
            { timeout: 15000 }
        )
    })

    it('MDI console accepts and echoes input', () => {
        cy.visit(`${MOCK}/console`)
        // Two textareas can match (e.g. a hidden auto-grow mirror); the
        // page-order first visible one is the main console input.
        cy.get('.gcode-command-field textarea:visible', { timeout: 20000 }).first().type('M117 E2E-PROBE-7{enter}')
        cy.contains('M117 E2E-PROBE-7', { timeout: 15000 }).should('exist')
    })

    it('WCS select changes the active coordinate system', () => {
        cy.visit(`${MOCK}/`)
        cy.contains('.offset-preview-legend__card', 'G55', { timeout: 20000 }).click()
        cy.get('.offset-preview-legend__card--active', { timeout: 15000 }).should('contain', 'G55')
        // Restore the default so reruns and other specs see G54.
        cy.contains('.offset-preview-legend__card', 'G54').click()
        cy.get('.offset-preview-legend__card--active', { timeout: 15000 }).should('contain', 'G54')
    })

    it('file browser lists the seeded gcodes', () => {
        cy.visit(`${MOCK}/files`)
        cy.contains('.gcode-card__name', 'benchy_pla.gcode', { timeout: 20000 }).should('exist')
    })
})
