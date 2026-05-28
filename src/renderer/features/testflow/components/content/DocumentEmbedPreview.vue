<template>
  <div class="document-embed-preview">
    <div v-if="!fileName" class="document-embed-preview__guide">
      请从左侧选择文件进行预览
    </div>
    <template v-else>
      <div class="document-embed-preview__toolbar">
        <span class="document-embed-preview__filename" :title="fileName">{{ fileName }}</span>
        <div class="document-embed-preview__controls">
          <a-radio-group v-model="mode" type="button" size="small">
            <a-radio value="preview">预览</a-radio>
            <a-radio value="edit">编辑</a-radio>
          </a-radio-group>
          <a-button
            v-if="mode === 'edit'"
            type="primary"
            size="small"
            :loading="saving"
            @click="onSave"
          >保存</a-button>
        </div>
      </div>
      <div class="document-embed-preview__body">
        <div v-if="contentLoading" class="document-embed-preview__loading">
          <a-spin />
        </div>
        <div v-else-if="loadError" class="document-embed-preview__error">
          文件加载失败
        </div>
        <template v-else>
          <div v-if="mode === 'preview'" class="document-embed-preview__render">
            <MarkdownRenderer
              v-if="renderType === 'markdown'"
              :content="content"
            />
            <div
              v-else-if="renderType === 'code'"
              class="document-embed-preview__code"
              v-html="highlightedCode"
            ></div>
            <pre v-else-if="renderType === 'text'" class="document-embed-preview__plaintext">{{ content }}</pre>
            <div v-else class="document-embed-preview__unsupported">
              该文件类型暂不支持预览
            </div>
          </div>
          <a-textarea
            v-else
            v-model="editContent"
            class="document-embed-preview__editor"
            auto-size
          />
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import { getFileRenderType, type FileRenderType } from '../../constants/file-render'
import MarkdownRenderer from '../../../chat/components/MarkdownRenderer.vue'

const props = defineProps<{
  fileName: string | null
  content: string
  fileType: FileRenderType
  projectId: string
  dirName: string
  contentLoading?: boolean
  loadError?: boolean
}>()

const emit = defineEmits<{
  save: [fileName: string, content: string]
}>()

const mode = ref<'preview' | 'edit'>('preview')
const editContent = ref('')
const saving = ref(false)

const renderType = computed(() => {
  if (!props.fileName) return 'text' as FileRenderType
  if (props.fileType === 'unsupported') return 'unsupported' as FileRenderType
  return props.fileType
})

const highlightedCode = computed(() => {
  if (!props.content || renderType.value !== 'code') return ''
  try {
    const result = hljs.highlightAuto(props.content)
    return `<pre><code class="hljs">${result.value}</code></pre>`
  } catch (e: unknown) {
    console.error('Code highlight failed:', e)
    return `<pre>${props.content}</pre>`
  }
})

watch(() => props.content, (val) => { editContent.value = val }, { immediate: true })
watch(() => props.fileName, () => {
  mode.value = 'preview'
  editContent.value = props.content
})

async function onSave() {
  if (!props.fileName) return
  saving.value = true
  try {
    emit('save', props.fileName, editContent.value)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.document-embed-preview {
  display: flex; flex-direction: column; flex: 1; min-width: 0;
  background: #fff; overflow: hidden;
}
.document-embed-preview__guide {
  display: flex; align-items: center; justify-content: center;
  flex: 1; font-size: 14px; color: #c9cdd4;
}
.document-embed-preview__toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-bottom: 1px solid var(--color-border, #e5e6eb);
  gap: 8px;
}
.document-embed-preview__filename {
  font-size: 13px; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
}
.document-embed-preview__controls { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.document-embed-preview__body { flex: 1; overflow-y: auto; padding: 12px; }
.document-embed-preview__loading {
  display: flex; align-items: center; justify-content: center; height: 100%;
}
.document-embed-preview__error {
  padding: 20px; text-align: center; font-size: 13px; color: #f53f3f;
}
.document-embed-preview__render { line-height: 1.6; }
.document-embed-preview__code :deep(pre) {
  background: #f7f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 0;
}
.document-embed-preview__code :deep(code) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px;
}
.document-embed-preview__plaintext {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px; line-height: 1.5; white-space: pre-wrap;
  background: #f7f8fa; padding: 12px; border-radius: 6px; margin: 0;
}
.document-embed-preview__unsupported {
  padding: 20px; text-align: center; font-size: 13px; color: #86909c;
}
.document-embed-preview__editor {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px; min-height: 300px;
}
</style>
