<template>
    <div>
        <v-row>
            <v-col>
                <history-statistics-panel />
            </v-col>
        </v-row>
        <v-row class="mt-0">
            <v-col>
                <history-list-panel />
            </v-col>
        </v-row>
    </div>
</template>
<script setup lang="ts">
import { defineAsyncComponent, defineComponent, h } from 'vue'
import { useBase } from '@/composables/useBase'
import { VSkeletonLoader } from 'vuetify/components'
import HistoryListPanel from '@/components/panels/HistoryListPanel.vue'

useBase()

// The statistics panel (and the echarts vendor chunk) loads only when the
// History route is entered. The skeleton reserves roughly the panel height
// to avoid layout shift.
const HistoryStatisticsPanel = defineAsyncComponent({
    loader: () => import('@/components/panels/HistoryStatisticsPanel.vue'),
    loadingComponent: defineComponent({
        setup() {
            return () =>
                h('div', { style: { height: '280px' } }, [h(VSkeletonLoader, { type: 'image', class: 'h-100' })])
        },
    }),
})
</script>
