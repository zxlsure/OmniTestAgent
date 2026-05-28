<template>
  <div class="resource-explorer">
    <div class="resource-explorer__header">
      <span class="resource-explorer__title">产出文件</span>
    </div>
    <div class="resource-explorer__list" v-if="!loading">
      <div
        v-for="file in files"
        :key="file.name"
        class="resource-explorer__item"
        :class="{ 'resource-explorer__item--selected': file.name === selectedFileName }"
        @click="$emit('select', file)"
      >
        <component :is="getFileIconComponent(file.name)" class="resource-explorer__icon" />
        <span class="resource-explorer__name" :title="file.name">{{ file.name }}</span>
      </div>
      <div v-if="files.length === 0" class="resource-explorer__empty">
        暂无产出文件
      </div>
    </div>
    <div v-else class="resource-explorer__loading">
      <a-skeleton animation :line="{ width: '80%' }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { type FileInfo } from '@types/testflow-pipeline'
import { getFileIcon } from '../../constants/file-render'

defineProps<{
  files: FileInfo[]
  selectedFileName: string | null
  loading?: boolean
}>()

defineEmits<{
  select: [file: FileInfo]
}>()

function getFileIconComponent(fileName: string): string {
  return getFileIcon(fileName)
}
</script>

<style scoped>
.resource-explorer {
  width: 280px; min-width: 280px;
  display: flex; flex-direction: column;
  border-right: 1px solid var(--color-border, #e5e6eb);
  background: #fff;
}
.resource-explorer__header {
  padding: 8px 12px; border-bottom: 1px solid var(--color-border, #e5e6eb);
}
.resource-explorer__title { font-size: 13px; font-weight: 600; }
.resource-explorer__list {
  flex: 1; overflow-y: auto; padding: 4px 0;
}
.resource-explorer__item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; cursor: pointer; transition: background 0.15s;
  border-left: 2px solid transparent;
}
.resource-explorer__item:hover {
  background: var(--color-fill-1, #f7f8fa);
}
.resource-explorer__item--selected {
  background: var(--color-fill-2, #f2f3f5);
  border-left-color: var(--color-primary-6, #165dff);
}
.resource-explorer__icon { font-size: 16px; color: #86909c; flex-shrink: 0; }
.resource-explorer__name {
  font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.resource-explorer__empty {
  padding: 20px 12px; text-align: center; font-size: 13px; color: #c9cdd4;
}
.resource-explorer__loading { padding: 12px; }
</style>
