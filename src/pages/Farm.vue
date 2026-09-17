<style></style>

<template>
    <v-row>
        <v-col v-for="(printer, key) in printers" :key="key" class="v-col-12 v-col-sm-6 v-col-md-4 pb-0">
            <farm-printer-panel :printer="printer"></farm-printer-panel>
        </v-col>
        <v-col v-if="printerCount === 0" class="v-col-12">
            <div class="d-flex align-center justify-center text-center" style="min-height: 60vh">
                <v-empty-state
                    :icon="mdiServerOff"
                    :title="$t('Panels.FarmPrinterPanel.EmptyTitle')"
                    :text="$t('Panels.FarmPrinterPanel.EmptyDescription')" />
            </div>
        </v-col>
    </v-row>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import { mdiServerOff } from '@mdi/js'
import FarmPrinterPanel from '@/components/panels/FarmPrinterPanel.vue'

const store = useStore()
useBase()

const printers = computed(() => store.getters['farm/getPrinters'])
const printerCount = computed(() => Object.keys(printers.value ?? {}).length)
</script>
