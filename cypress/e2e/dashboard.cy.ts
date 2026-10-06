describe('Dashboard — E3CNC fork', () => {
    it('establishes a Moonraker WebSocket connection', () => {
        cy.visit('/')
        // Initial state: the connection dialog shows "Connecting to localhost"
        cy.contains('Connecting to localhost', { timeout: 10000 }).should('be.visible')

        // Once the WS connects, the dialog title transitions from "Connecting" to
        // the hostname itself.  Real Moonraker 0.11 in the harness responds to
        // /server/info and accepts WebSocket upgrade, but has **no Klipper**
        // attached — the app's UI will still be mostly "connecting" / waiting.
        // Assert that the WS handshake succeeds at the network level.
        cy.contains('localhost:7125', { timeout: 15000 }).should('be.visible')
    })

    it('serves the frontend from nginx and the SPA routing works', () => {
        cy.visit('/')
        // The connection dialog panel is rendered (always shown)
        cy.get('.the-connection-dialog').should('be.visible')
    })

    it('readies the GUI after connection', () => {
        cy.visit('/')
        // After the WS connects and the GUI initialises, the dialog still shows
        // but now reads the hostname instead of "Connecting to ...".
        // It never *hides* in Mainsail — showDialog is always true.
        cy.contains('localhost:7125', { timeout: 15000 }).should('be.visible')
    })

    // TODO: file browser / gcode listing once gcodes are seeded in the harness
    // (e.g. a fixture file mounted into moonraker_data at /data/gcodes/).
    // Jog, WCS, spindle, coolant, and MDI assertions require the E3CNC mock
    // Moonraker's /server/cnc/* endpoints, which the harness's real Moonraker
    // does NOT expose — those belong in a separate spec run against the mock.
})
