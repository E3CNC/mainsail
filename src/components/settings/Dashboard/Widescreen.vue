<template>
    <v-card flat>
        <v-card-text>
            <div class="dashboard-widescreen-layout">
                <div class="dashboard-widescreen-layout__primary d-flex">
                    <settings-dashboard-sortable viewport-name="widescreen" :column="1" />
                </div>
                <div class="dashboard-widescreen-layout__secondary d-flex flex-column">
                    <settings-dashboard-sortable viewport-name="widescreen" :column="2" />
                    <settings-dashboard-sortable viewport-name="widescreen" :column="3" />
                </div>
            </div>
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
import SettingsDashboardSortable from '@/components/settings/Dashboard/Sortable.vue'
</script>

<style scoped>
.dashboard-widescreen-layout {
    display: grid;
    gap: 16px;
}

.dashboard-widescreen-layout__secondary {
    gap: 8px;
}

@media (min-width: 960px) {
    .dashboard-widescreen-layout {
        grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    }
}
</style>
