<template>
  <a-modal v-model:visible="visible" :title="title" @ok="onOk" @cancel="onCancel">
    <p>{{ content }}</p>
  </a-modal>
</template>

<script setup lang="ts">
const props = defineProps<{ title?: string; content?: string }>()
const emit = defineEmits<{ ok: []; cancel: [] }>()
const visible = defineModel<boolean>('visible', { default: false })
function onOk() { emit('ok') }
function onCancel() { emit('cancel') }
</script>
