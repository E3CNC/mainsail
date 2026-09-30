import type { Plugin } from 'vue'

export const ToastPlugin: Plugin = {
    install(app) {
        // Lazy-load vue-toast-notification and install as a plugin
        ;(async () => {
            const mod = await import('vue-toast-notification')
            const modTyped = mod as unknown as { default?: Plugin; ToastPlugin?: Plugin }
            const plugin = (modTyped.default ?? modTyped.ToastPlugin ?? (mod as unknown as Plugin)) as Plugin
            app.use(plugin as Plugin, {
                duration: 3000,
                position: 'top-right',
            })
        })()
    },
}
