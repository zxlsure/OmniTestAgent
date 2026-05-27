<template>
  <div class="markdown-renderer" v-html="renderedHtml"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'

const props = defineProps<{
  content: string
}>()

const renderer = new marked.Renderer()
const originalCodeRenderer = renderer.code

renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  const language = lang && hljs.getLanguage(lang) ? lang : undefined
  const highlighted = language
    ? hljs.highlight(text, { language }).value
    : hljs.highlightAuto(text).value
  return `<pre><code class="hljs${language ? ` language-${language}` : ''}">${highlighted}</code></pre>`
}

marked.setOptions({
  renderer,
  breaks: true,
  gfm: true
})

const renderedHtml = computed(() => {
  if (!props.content) return ''
  return marked(props.content) as string
})
</script>

<style scoped>
.markdown-renderer {
  line-height: 1.6;
  word-wrap: break-word;
}
.markdown-renderer :deep(pre) {
  background: var(--color-fill-2, #f6f8fa);
  border-radius: 6px;
  padding: 12px 16px;
  overflow-x: auto;
  margin: 8px 0;
}
.markdown-renderer :deep(code) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}
.markdown-renderer :deep(:not(pre) > code) {
  background: var(--color-fill-2, #f0f0f0);
  padding: 2px 6px;
  border-radius: 3px;
}
.markdown-renderer :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
}
.markdown-renderer :deep(th),
.markdown-renderer :deep(td) {
  border: 1px solid var(--color-border, #e5e6eb);
  padding: 8px 12px;
  text-align: left;
}
.markdown-renderer :deep(th) {
  background: var(--color-fill-2, #f6f8fa);
  font-weight: 600;
}
.markdown-renderer :deep(blockquote) {
  border-left: 4px solid var(--color-primary, #165dff);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--color-text-3, #86909c);
}
.markdown-renderer :deep(ul),
.markdown-renderer :deep(ol) {
  padding-left: 20px;
  margin: 4px 0;
}
.markdown-renderer :deep(a) {
  color: var(--color-primary, #165dff);
  text-decoration: none;
}
.markdown-renderer :deep(a:hover) {
  text-decoration: underline;
}
</style>
