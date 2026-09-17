<template>
    <v-card flat>
        <v-card-text>
            <v-row>
                <v-col class="v-col-12 v-col-md-6 d-flex">
                    <settings-dashboard-sortable viewport-name="tablet" :column="1" />
                </v-col>
                <v-col class="v-col-12 v-col-md-6 d-flex">
                    <settings-dashboard-sortable viewport-name="tablet" :column="2" />
                </v-col>
            </v-row>
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
import SettingsDashboardSortable from '@/components/settings/Dashboard/Sortable.vue'
</script>

<style scoped></style>
