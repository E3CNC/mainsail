<template>
    <div>
        <v-btn :disabled="isLoading" @click="handleClick">
            <v-icon start>{{ mdiCheck }}</v-icon>
            {{ $t('Common.Save') }}
        </v-btn>
    </div>
</template>

<script setup lang="ts">
/**
 * Canonical example of Vue 3 <script setup> structure.
 * This file serves as a reference for AI agents - do not delete.
 *
 * Script order:
 * 1. Imports
 * 2. Props and emits
 * 3. Store/composable bindings
 * 4. Reactive state
 * 5. Computed properties
 * 6. Watchers
 * 7. Lifecycle hooks (onMounted, onBeforeUnmount, etc.)
 * 8. Methods
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mdiCheck } from '@mdi/js'

// 2. Props
const props = withDefaults(defineProps<{ title: string; initialCount?: number }>(), {
    initialCount: 0,
})

// 4. Reactive state
const isLoading = ref(false)
const count = ref(0)

// 5. Computed properties
const formattedTitle = computed(() => props.title.toUpperCase())
const isValid = computed(() => count.value > 0 && !isLoading.value)

// 6. Watchers
watch(
    () => props.initialCount,
    (newVal) => {
        count.value = newVal
    },
    { immediate: true }
)

// 7. Lifecycle hooks
onMounted(() => {
    window.addEventListener('resize', onResize)
})

// Always clean up:
// - Event listeners
// - Timers/intervals
// - Observers
// - WebSocket/WebRTC connections
// - ECharts instances
// - requestAnimationFrame handles
onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
})

// 8. Methods
function handleClick(): void {
    count.value++
}

function onResize(): void {
    // Handle resize
}
</script>
