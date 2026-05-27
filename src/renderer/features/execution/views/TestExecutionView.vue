<template>
  <div class="test-execution-view">
    <div class="page-header"><h2>测试执行</h2></div>
    <a-row :gutter="16">
      <a-col :span="8">
        <a-card title="用例列表">
          <a-spin :loading="loading">
            <a-empty v-if="!store.testCases.length" description="暂无用例" />
            <a-checkbox-group v-model="store.selectedCaseIds" v-else>
              <div v-for="tc in store.testCases" :key="tc.id" class="case-item">
                <a-checkbox :value="tc.id">{{ tc.title }}</a-checkbox>
              </div>
            </a-checkbox-group>
          </a-spin>
        </a-card>
      </a-col>
      <a-col :span="16">
        <a-card title="执行面板">
          <a-button
            type="primary"
            :disabled="!store.selectedCaseIds.length || store.executing"
            :loading="store.executing"
            @click="onExecute"
          >
            <template #icon><icon-play-arrow /></template>
            执行选中用例 ({{ store.selectedCaseIds.length }})
          </a-button>
          <a-divider />
          <div v-if="resultList.length" class="result-list">
            <div v-for="r in resultList" :key="r.caseId" class="result-item">
              <a-tag :color="statusColor(r.status)">{{ statusText(r.status) }}</a-tag>
              <span class="result-title">{{ getCaseTitle(r.caseId) }}</span>
              <div v-if="r.output" class="result-output">{{ r.output }}</div>
              <div v-if="r.error" class="result-error">{{ r.error }}</div>
            </div>
          </div>
          <a-empty v-else description="暂无执行结果" />
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useTestExecutionStore } from '@store/useTestExecutionStore'
import { useProjectStore } from '@store/useProjectStore'

const store = useTestExecutionStore()
const projectStore = useProjectStore()
const loading = ref(false)

const resultList = computed(() => Array.from(store.executionResults.values()))

function getCaseTitle(caseId: string): string {
  return store.testCases.find(tc => tc.id === caseId)?.title || caseId
}

function statusColor(status: string): string {
  const map: Record<string, string> = { passed: 'green', failed: 'red', running: 'blue', pending: 'gray' }
  return map[status] || 'gray'
}

function statusText(status: string): string {
  const map: Record<string, string> = { passed: '通过', failed: '失败', running: '运行中', pending: '等待' }
  return map[status] || status
}

async function onExecute() {
  await store.executeCases(store.selectedCaseIds)
}

onMounted(async () => {
  if (projectStore.currentProject) {
    loading.value = true
    try {
      await store.fetchTestCases(projectStore.currentProject.id)
    } finally {
      loading.value = false
    }
  }
})
</script>

<style scoped>
.page-header { margin-bottom: 16px; }
.case-item { padding: 4px 0; }
.result-list { max-height: 400px; overflow-y: auto; }
.result-item { padding: 8px 0; border-bottom: 1px solid var(--color-border, #e5e6eb); }
.result-title { font-weight: 500; margin-left: 8px; }
.result-output { margin-top: 4px; padding: 8px; background: var(--color-fill-1, #f7f8fa); border-radius: 4px; font-size: 12px; white-space: pre-wrap; }
.result-error { margin-top: 4px; padding: 8px; background: #ffece8; border-radius: 4px; font-size: 12px; color: #f53f3f; }
</style>
