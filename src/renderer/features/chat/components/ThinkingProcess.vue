<template>
  <div class="thinking-process" v-if="thinking || (steps && steps.length)">
    <div class="thinking-header" @click="expanded = !expanded">
      <icon-mind-mapping class="thinking-icon" />
      <span class="thinking-label">思考过程</span>
      <span class="step-count" v-if="steps?.length">{{ steps.length }} 步</span>
      <icon-down class="arrow-icon" :class="{ rotated: expanded }" />
    </div>
    <div class="thinking-body" v-show="expanded">
      <div class="thinking-text" v-if="thinking">
        <MarkdownRenderer :content="thinking" />
      </div>
      <div class="thinking-steps" v-if="steps?.length">
        <div v-for="(step, index) in steps" :key="index" class="thinking-step">
          <div class="step-text" v-if="step.text">
            <span class="step-index">{{ index + 1 }}</span>
            <span class="step-content">{{ step.text }}</span>
          </div>
          <div class="tool-call-info" v-if="step.toolCall">
            <div class="tool-header">
              <icon-tool class="tool-icon" />
              <span class="tool-name">{{ step.toolCall.toolName }}</span>
              <span
                class="tool-status"
                :class="step.toolCall.status"
              >{{ statusLabel(step.toolCall.status) }}</span>
              <span class="tool-duration" v-if="step.toolCall.durationMs">
                ({{ (step.toolCall.durationMs / 1000).toFixed(1) }}s)
              </span>
            </div>
            <div class="tool-params" v-if="step.toolCall.parameters">
              <code>{{ step.toolCall.parameters }}</code>
            </div>
            <div class="tool-result" v-if="step.toolCall.result">
              <div class="tool-result-header" @click="toggleStepResult(index)">
                <span>执行结果</span>
                <icon-down class="arrow-icon" :class="{ rotated: expandedSteps.has(index) }" />
              </div>
              <div class="tool-result-content" v-show="expandedSteps.has(index)">
                <MarkdownRenderer :content="step.toolCall.result" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { ThinkingStep } from '@types/chatAgent'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{
  thinking?: string
  steps?: ThinkingStep[]
}>()

const expanded = ref(false)
const expandedSteps = reactive(new Set<number>())

function toggleStepResult(index: number) {
  if (expandedSteps.has(index)) {
    expandedSteps.delete(index)
  } else {
    expandedSteps.add(index)
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '等待中',
    executing: '执行中',
    completed: '已完成',
    failed: '失败',
    rejected: '已拒绝'
  }
  return map[status] || status
}
</script>

<style scoped>
.thinking-process {
  margin-bottom: 8px;
}
.thinking-header {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--color-fill-1, #f2f3f5);
  user-select: none;
  font-size: 13px;
  color: var(--color-text-2, #4e5969);
}
.thinking-header:hover {
  background: var(--color-fill-2, #e5e6eb);
}
.thinking-icon { font-size: 14px; color: var(--color-primary, #165dff); }
.thinking-label { font-weight: 500; }
.step-count { color: var(--color-text-3, #86909c); font-size: 12px; }
.arrow-icon {
  margin-left: auto;
  font-size: 12px;
  transition: transform 0.2s;
}
.arrow-icon.rotated { transform: rotate(180deg); }
.thinking-body { padding: 8px 12px; }
.thinking-text { margin-bottom: 8px; font-size: 13px; color: var(--color-text-2, #4e5969); }
.thinking-steps { display: flex; flex-direction: column; gap: 8px; }
.thinking-step {
  padding: 6px 8px;
  border-left: 2px solid var(--color-primary-light, #e8f3ff);
  background: var(--color-fill-1, #f7f8fa);
  border-radius: 0 6px 6px 0;
}
.step-text { display: flex; align-items: flex-start; gap: 6px; font-size: 13px; }
.step-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary, #165dff);
  color: #fff;
  font-size: 11px;
  flex-shrink: 0;
}
.step-content { color: var(--color-text-2, #4e5969); }
.tool-call-info { margin-top: 6px; padding-left: 24px; }
.tool-header { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.tool-icon { color: var(--color-warning, #ff9a2e); }
.tool-name { font-weight: 500; color: var(--color-text-1, #1d2129); }
.tool-status { font-size: 12px; padding: 1px 6px; border-radius: 10px; }
.tool-status.completed { background: #e8ffea; color: #00b42a; }
.tool-status.executing { background: #e8f7ff; color: #165dff; }
.tool-status.failed { background: #ffece8; color: #f53f3f; }
.tool-status.rejected { background: #fff7e8; color: #ff9a2e; }
.tool-status.pending { background: #f2f3f5; color: #86909c; }
.tool-duration { font-size: 12px; color: var(--color-text-3, #86909c); }
.tool-params { margin: 4px 0; }
.tool-params code {
  display: block;
  background: var(--color-fill-2, #f0f0f0);
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
.tool-result { margin-top: 4px; }
.tool-result-header {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text-3, #86909c);
}
.tool-result-header:hover { color: var(--color-text-2, #4e5969); }
.tool-result-content {
  margin-top: 4px;
  padding: 8px;
  background: var(--color-fill-1, #f7f8fa);
  border-radius: 4px;
  font-size: 13px;
}
</style>
