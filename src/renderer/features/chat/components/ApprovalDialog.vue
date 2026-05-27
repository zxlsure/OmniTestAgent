<template>
  <a-modal
    :visible="visible"
    :mask-closable="false"
    :closable="true"
    title="工具调用审批"
    @cancel="onReject"
    :footer="false"
    unmount-on-close
  >
    <div class="approval-content">
      <div class="approval-warning">
        <icon-exclamation-circle-fill class="warning-icon" />
        <span>AI 请求执行以下工具，请确认是否允许：</span>
      </div>
      <div class="approval-tool-info">
        <div class="info-row">
          <span class="info-label">工具名称</span>
          <span class="info-value tool-name">{{ toolName }}</span>
        </div>
        <div class="info-row" v-if="parameters && Object.keys(parameters).length">
          <span class="info-label">调用参数</span>
          <pre class="info-value params-json">{{ formatParams }}</pre>
        </div>
      </div>
      <div class="approval-actions">
        <a-button @click="onReject" size="large">拒绝执行</a-button>
        <a-button type="primary" @click="onApprove" size="large">允许执行</a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  toolName: string
  parameters: Record<string, unknown>
  visible: boolean
}>()

const emit = defineEmits<{
  approved: []
  rejected: []
}>()

const formatParams = computed(() => {
  try {
    return JSON.stringify(props.parameters, null, 2)
  } catch (e: unknown) {
    console.error('JSON stringify failed:', e)
    return String(props.parameters)
  }
})

function onApprove() {
  emit('approved')
}

function onReject() {
  emit('rejected')
}
</script>

<style scoped>
.approval-content { display: flex; flex-direction: column; gap: 16px; }
.approval-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-warning-light-1, #fff7e8);
  border-radius: 6px;
  font-size: 14px;
}
.warning-icon { font-size: 18px; color: var(--color-warning, #ff9a2e); }
.approval-tool-info { display: flex; flex-direction: column; gap: 10px; }
.info-row { display: flex; flex-direction: column; gap: 4px; }
.info-label { font-size: 12px; color: var(--color-text-3, #86909c); }
.info-value { font-size: 14px; }
.tool-name { font-weight: 600; color: var(--color-primary, #165dff); }
.params-json {
  background: var(--color-fill-2, #f2f3f5);
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}
.approval-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}
</style>
