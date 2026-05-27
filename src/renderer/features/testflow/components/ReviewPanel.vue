<template>
  <a-drawer
    :visible="visible"
    :title="`${meta.label} - 审核`"
    :width="640"
    @cancel="$emit('update:visible', false)"
  >
    <div class="review-panel">
      <div class="review-panel__history" v-if="store.reviewRecords.length > 0">
        <h4>审核历史</h4>
        <a-timeline>
          <a-timeline-item
            v-for="record in store.reviewRecords"
            :key="record.id"
          >
            <a-tag :color="record.result === 'approved' ? 'green' : 'red'" size="small">
              v{{ record.round }}
            </a-tag>
            {{ record.result === 'approved' ? '通过' : '退回' }}
            <span v-if="record.comment" class="review-panel__comment">：{{ record.comment }}</span>
            <div class="review-panel__time">{{ record.reviewedAt }}</div>
          </a-timeline-item>
        </a-timeline>
      </div>

      <div class="review-panel__content">
        <h4>当前产出文件</h4>
        <div class="review-panel__files">
          <a-list :data="store.currentFiles" size="small">
            <template #item="{ item }">
              <a-list-item @click="onFileClick(item as FileInfo)">
                <a-list-item-meta :title="(item as FileInfo).name">
                  <template #icon><icon-file /></template>
                </a-list-item-meta>
              </a-list-item>
            </template>
          </a-list>
        </div>

        <div v-if="previewHtml" class="review-panel__preview" v-html="previewHtml"></div>
        <a-textarea
          v-model="editedContent"
          class="review-panel__editor"
          placeholder="审核修改内容（可编辑产出文件）"
          :auto-size="{ minRows: 6, maxRows: 20 }"
        />
      </div>

      <div class="review-panel__comment-input">
        <a-input v-model="reviewComment" placeholder="审核意见（退回时填写）" />
      </div>

      <div class="review-panel__ai-result" v-if="aiSuggestion">
        <h4>AI审核建议</h4>
        <div class="review-panel__ai-content">{{ aiSuggestion }}</div>
      </div>

      <div class="review-panel__actions">
        <a-button type="primary" status="success" @click="onApprove">审核通过</a-button>
        <a-button status="danger" @click="onReject">退回</a-button>
        <a-button type="outline" :loading="aiLoading" @click="onAiAssist">
          <template #icon><icon-robot /></template>
          AI辅助审核
        </a-button>
      </div>
    </div>

    <FilePreview
      :visible="previewVisible"
      :file-name="previewFileName"
      :content="previewFileContent"
      @update:visible="previewVisible = $event"
      @save="onPreviewSave"
    />
  </a-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { marked } from 'marked'
import { STEP_META_MAP, type PipelineStepType, type FileInfo } from '@types/testflow-pipeline'
import { useTestFlowPipelineStore } from '@store/useTestFlowPipelineStore'
import FilePreview from './FilePreview.vue'

const props = defineProps<{
  stepType: PipelineStepType
  projectId: string
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  approved: []
  rejected: []
}>()

const store = useTestFlowPipelineStore()
const meta = computed(() => STEP_META_MAP[props.stepType])
const editedContent = ref('')
const reviewComment = ref('')
const previewVisible = ref(false)
const previewFileName = ref('')
const previewFileContent = ref('')
const aiSuggestion = ref('')
const aiLoading = ref(false)

const previewHtml = computed(() => {
  if (!editedContent.value) return ''
  try {
    return marked.parse(editedContent.value) as string
  } catch (e: unknown) {
    console.error('Markdown parse failed:', e)
    return `<pre>${editedContent.value}</pre>`
  }
})

async function onFileClick(file: FileInfo) {
  previewFileName.value = file.name
  await store.fetchFileContent(props.projectId, meta.value.outputDir, file.name)
  if (store.previewContent) {
    previewFileContent.value = store.previewContent.content
    editedContent.value = store.previewContent.content
  }
  previewVisible.value = true
}

function onPreviewSave(fileName: string, content: string) {
  editedContent.value = content
  previewVisible.value = false
  if (props.projectId && meta.value.outputDir) {
    window.electronAPI.fileOp.writeFile({
      projectId: props.projectId,
      dirName: meta.value.outputDir,
      fileName,
      content
    }).catch((e: unknown) => console.error('File save failed:', e))
  }
}

function onApprove() {
  emit('approved')
  emit('update:visible', false)
}

function onReject() {
  emit('rejected')
  emit('update:visible', false)
}

async function onAiAssist() {
  if (aiLoading.value) return
  aiLoading.value = true
  aiSuggestion.value = ''
  try {
    const contentToReview = editedContent.value || store.previewContent?.content || ''
    if (!contentToReview) {
      aiSuggestion.value = '无可审核的内容，请先选择产出文件。'
      return
    }
    const reviewPrompt = `请对以下测试产出进行审核，检查其完整性、正确性和规范性，并给出修改建议：\n\n环节：${meta.value.label}\n\n产出内容：\n${contentToReview}`
    await window.electronAPI.chat.sendMessage({
      sessionId: `review-${props.projectId}-${props.stepType}`,
      message: reviewPrompt,
      projectId: props.projectId
    })
    aiSuggestion.value = 'AI审核请求已发送，请在对话面板中查看结果。'
  } catch (e: unknown) {
    aiSuggestion.value = `AI审核失败: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    aiLoading.value = false
  }
}
</script>

<style scoped>
.review-panel { display: flex; flex-direction: column; gap: 16px; }
.review-panel__history h4 { margin-bottom: 8px; font-size: 14px; }
.review-panel__comment { color: #86909c; font-size: 12px; }
.review-panel__time { font-size: 11px; color: #c9cdd4; }
.review-panel__content h4 { margin-bottom: 8px; font-size: 14px; }
.review-panel__preview { padding: 12px; background: #f7f8fa; border-radius: 6px; max-height: 300px; overflow: auto; margin-bottom: 8px; }
.review-panel__preview :deep(pre) { background: #fff; padding: 8px; border-radius: 4px; }
.review-panel__editor { font-size: 13px; }
.review-panel__actions { display: flex; gap: 8px; }
.review-panel__ai-result h4 { margin-bottom: 8px; font-size: 14px; }
.review-panel__ai-content { padding: 12px; background: #e8f3ff; border-radius: 6px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
</style>
