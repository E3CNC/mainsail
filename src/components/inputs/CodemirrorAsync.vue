<template>
    <component ref="codemirrorRef" :is="CodemirrorComp" :validation-errors="validationErrors" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted } from 'vue'
import type { ComponentPublicInstance } from 'vue'

const props = defineProps<{
    validationErrors?: { line: number; severity: 'error' | 'warning' }[]
}>()

const CodemirrorComp = shallowRef<unknown>(null)
const codemirrorRef = ref<(ComponentPublicInstance & { gotoLine?: (line: number) => void }) | null>(null)

onMounted(async () => {
    const mod = await import('@/components/inputs/Codemirror.vue')
    CodemirrorComp.value = mod.default
})

function gotoLine(line: number) {
    codemirrorRef.value?.gotoLine?.(line)
}

defineExpose({ gotoLine })
</script>
