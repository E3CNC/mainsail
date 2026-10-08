<template>
    <panel
        v-if="klipperReadyForGui"
        :icon="mdiThermometerLines"
        :title="$t('Panels.TemperaturePanel.Headline')"
        :collapsible="true"
        card-class="temperature-panel">
        <template #buttons>
            <temperature-panel-settings />
        </template>
        <v-card-text class="pa-0">
            <temperature-panel-list />
            <template v-if="boolTempchart">
                <v-divider class="my-0" />
                <temp-chart />
            </template>
        </v-card-text>
    </panel>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h } from 'vue'
import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import { useControl } from '@/composables/useControl'
import { VSkeletonLoader } from 'vuetify/components'
import Panel from '@/components/ui/Panel.vue'
import { mdiThermometerLines } from '@mdi/js'

const { klipperReadyForGui } = useBase()
useControl()

const store = useStore()

const boolTempchart = computed(() => store.state.gui.view.tempchart.boolTempchart ?? false)

// TempChart (and the echarts vendor chunk) loads only when the chart is
// enabled. The skeleton reserves the chart height to avoid layout shift.
const TempChart = defineAsyncComponent({
    loader: () => import('@/components/charts/TempChart.vue'),
    loadingComponent: defineComponent({
        setup() {
            const skeletonHeight = computed(() => store.state.gui.uiSettings.tempchartHeight ?? 250)
            return () =>
                h('div', { style: { height: `${skeletonHeight.value}px` } }, [
                    h(VSkeletonLoader, { type: 'image', class: 'h-100' }),
                ])
        },
    }),
})
</script>
