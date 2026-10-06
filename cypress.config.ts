import { defineConfig } from 'cypress'
import pluginConfig from './cypress/plugins/index.js'

export default defineConfig({
    e2e: {
        setupNodeEvents(on, config) {
            return pluginConfig(on, config)
        },
        // Default base URL points at the dev/preview server. CI overrides this
        // to http://localhost:8080 when running against the Docker dev harness
        // (see .github/workflows/ci.yml).
        baseUrl: 'http://localhost:8080',
    },
})
