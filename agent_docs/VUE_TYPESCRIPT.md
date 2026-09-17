# Vue & TypeScript

## Vue 3 `<script setup>`

Use the Composition API with `<script setup lang="ts">`.
Never use Vue Class Components, decorators, or mixins. Shared logic lives in
composables under `src/composables/` (e.g. `useSocket`, `useCncOffsets`).

See canonical example: [examples/VueComponentExample.vue](examples/VueComponentExample.vue)

### Script Order

1. Imports
2. Props (`defineProps`) and emits (`defineEmits`)
3. Store/composable bindings (`useStore`, composables)
4. Reactive state (`ref`, `reactive`)
5. Computed properties
6. Watchers
7. Lifecycle hooks (`onMounted`, `onBeforeUnmount`)
8. Methods

### Documentation

- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [`<script setup>`](https://vuejs.org/api/sfc-script-setup.html)

## TypeScript

Use explicit types for props, return values, and complex objects.
Use `@/` alias for imports (e.g., `import { foo } from '@/store/types'`).

Define `type`, `required`, and `default` for all props.

## Template Best Practices

Extract complex logic into computed properties.
Keep templates declarative - no inline filtering or complex expressions.

## Cleanup in onBeforeUnmount

Always clean up resources:

- Event listeners
- Timers and intervals
- Observers (ResizeObserver, MutationObserver)
- ECharts instances
- WebSocket/WebRTC connections
- `requestAnimationFrame` handles
