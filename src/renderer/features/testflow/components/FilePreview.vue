<template>
  <a-modal
    :visible="visible"
    :title="fileName"
    :footer="false"
    fullscreen
    @cancel="$emit('update:visible', false)"
  >
    <div class="file-preview">
      <div class="file-preview__toolbar">
        <a-radio-group v-model="mode" type="button" size="small">
          <a-radio value="preview">预览</a-radio>
          <a-radio value="edit">编辑</a-radio>
        </a-radio-group>
        <a-button v-if="mode === 'edit'" type="primary" size="small" @click="onSave">
          保存
        </a-button>
      </div>
      <div class="file-preview__body">
        <div v-if="mode === 'preview'" class="file-preview__render" v-html="renderedContent"></div>
        <a-textarea
          v-else
          v-model="editContent"
          class="file-preview__editor"
          auto-size
        />
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'

const props = defineProps<{
  fileName: string
  content: string
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [fileName: string, content: string]
}>()

const mode = ref<'preview' | 'edit'>('preview')
const editContent = ref('')

watch(() => props.content, (val) => { editContent.value = val }, { immediate: true })
watch(() => props.visible, (val) => { if (val) mode.value = 'preview' })

const renderedContent = computed(() => {
  if (!props.content) return ''
  try {
    marked.setOptions({
      highlight(code: string, lang: string) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value
        }
        return hljs.highlightAuto(code).value
      }
    })
    return marked.parse(props.content) as string
  } catch (e: unknown) {
    console.error('Markdown render failed:', e)
    return `<pre>${props.content}</pre>`
  }
})

function onSave() {
  emit('save', props.fileName, editContent.value)
}
</script>

<style scoped>
.file-preview { display: flex; flex-direction: column; height: 100%; }
.file-preview__toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.file-preview__body { flex: 1; overflow: auto; }
.file-preview__render { padding: 16px; background: #fff; border-radius: 6px; }
.file-preview__render :deep(pre) { background: #f7f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
.file-preview__render :deep(code) { font-family: 'Fira Code', Consolas, monospace; font-size: 13px; }
.file-preview__editor { font-family: 'Fira Code', Consolas, monospace; font-size: 13px; min-height: 400px; }
</style>
