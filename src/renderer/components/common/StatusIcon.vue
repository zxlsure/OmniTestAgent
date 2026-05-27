<template>
  <span class="status-icon" :style="{ color: statusConfig.color }">
    <icon-play-circle-fill v-if="status === 'running'" class="spinning" />
    <icon-check-circle-fill v-else-if="status === 'completed'" />
    <icon-close-circle-fill v-else-if="status === 'failed'" />
    <icon-minus-circle-fill v-else />
  </span>
</template>

<script setup lang="ts">
import { ACTIVITY_STATUS_MAP } from '@utils/constants'

const props = defineProps<{ status: string }>()
const statusConfig = ACTIVITY_STATUS_MAP[props.status] || ACTIVITY_STATUS_MAP.idle
</script>

<style scoped>
.status-icon { display: inline-flex; align-items: center; font-size: 18px; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
