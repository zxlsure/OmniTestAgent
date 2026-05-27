<template>
  <div class="knowledge-view">
    <div class="page-header">
      <h2>知识库管理</h2>
      <a-button type="primary" @click="showCreateModal = true">
        <template #icon><icon-plus /></template>
        新建知识库
      </a-button>
    </div>
    <a-row :gutter="16">
      <a-col :span="8">
        <a-card title="知识库列表">
          <a-list :data="bases" :bordered="false">
            <a-list-item v-for="base in bases" :key="base.id" @click="onSelectBase(base.id)">
              <a-list-item-meta :title="base.name" :description="`${base.doc_count} 个文档`" />
              <template #actions>
                <a-button type="text" status="danger" size="mini" @click.stop="onDeleteBase(base.id, base.name)">
                  <template #icon><icon-delete /></template>
                </a-button>
              </template>
            </a-list-item>
          </a-list>
          <a-empty v-if="!bases.length" description="暂无知识库" />
        </a-card>
      </a-col>
      <a-col :span="16">
        <a-card title="文档管理" v-if="currentBaseId">
          <a-upload draggable :limit="10" @change="onUpload">
            <template #upload-button>
              <div class="upload-area">
                <icon-upload class="upload-icon" />
                <p>拖拽文件到此处或点击上传</p>
                <p class="upload-hint">支持 PDF/Word/Markdown/TXT，最大50MB</p>
              </div>
            </template>
          </a-upload>
          <a-divider />
          <a-table :data="documents" :columns="docColumns" :pagination="false" />
          <a-divider />
          <div class="search-section">
            <h4>语义检索</h4>
            <a-input-search
              v-model="searchQuery"
              placeholder="输入查询内容进行语义检索"
              search-button
              @search="onSearch"
            />
            <div class="search-results" v-if="knowledgeStore.searchResults.length">
              <div v-for="(result, idx) in knowledgeStore.searchResults" :key="idx" class="search-result-item">
                <div class="search-result-source">{{ result.source }} (相关度: {{ result.score.toFixed(3) }})</div>
                <div class="search-result-content">{{ result.content }}</div>
              </div>
            </div>
          </div>
        </a-card>
        <a-empty v-else description="请选择知识库" />
      </a-col>
    </a-row>
    <a-modal v-model:visible="showCreateModal" title="新建知识库" @ok="onCreateBase">
      <a-form :model="form" layout="vertical">
        <a-form-item field="name" label="名称" required>
          <a-input v-model="form.name" placeholder="请输入知识库名称" />
        </a-form-item>
        <a-form-item field="description" label="描述">
          <a-textarea v-model="form.description" placeholder="请输入描述" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Modal, Message } from '@arco-design/web-vue'
import { useKnowledgeStore } from '@store/useKnowledgeStore'
import { useProjectStore } from '@store/useProjectStore'

const knowledgeStore = useKnowledgeStore()
const projectStore = useProjectStore()
const bases = computed(() => knowledgeStore.bases)
const currentBaseId = computed(() => knowledgeStore.currentBaseId)
const documents = computed(() => knowledgeStore.documents)
const showCreateModal = ref(false)
const form = ref({ name: '', description: '' })
const searchQuery = ref('')

const docColumns = [
  { title: '文件名', dataIndex: 'file_name' },
  { title: '类型', dataIndex: 'file_type' },
  { title: '状态', dataIndex: 'status' },
  { title: '创建时间', dataIndex: 'created_at' }
]

onMounted(async () => {
  if (projectStore.currentProject) {
    await knowledgeStore.fetchBases(projectStore.currentProject.id)
  }
})

async function onSelectBase(id: string) {
  knowledgeStore.currentBaseId = id
  await knowledgeStore.fetchDocuments(id)
}

async function onCreateBase() {
  if (!projectStore.currentProject || !form.value.name) return
  await knowledgeStore.createBase(projectStore.currentProject.id, form.value.name, form.value.description)
  showCreateModal.value = false
  form.value = { name: '', description: '' }
}

function onDeleteBase(id: string, name: string) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除知识库「${name}」吗？此操作不可撤销。`,
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      try {
        await window.electronAPI.knowledge.deleteBase(id)
        Message.success('删除成功')
        if (currentBaseId.value === id) {
          knowledgeStore.currentBaseId = null
        }
        if (projectStore.currentProject) {
          await knowledgeStore.fetchBases(projectStore.currentProject.id)
        }
      } catch (e: unknown) {
        Message.error(`删除失败: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  })
}

async function onSearch(query: string) {
  if (!currentBaseId.value || !query.trim()) return
  await knowledgeStore.search(currentBaseId.value, query.trim())
}

const ALLOWED_EXTENSIONS = ['.md', '.txt', '.pdf', '.doc', '.docx']
const MAX_FILE_SIZE = 50 * 1024 * 1024

async function onUpload(fileItemList: unknown[]) {
  if (!currentBaseId.value || !projectStore.currentProject) return
  for (const item of fileItemList) {
    const file = (item as { file?: { name: string; size: number; path: string } }).file
    if (!file) continue
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      continue
    }
    try {
      await knowledgeStore.uploadDocument(
        projectStore.currentProject.id,
        currentBaseId.value,
        file.path,
        file.name
      )
    } catch (e: unknown) {
      console.error('Upload failed:', e)
    }
  }
  if (currentBaseId.value) {
    await knowledgeStore.fetchDocuments(currentBaseId.value)
  }
}
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.upload-area { border: 1px dashed var(--color-border); border-radius: 6px; padding: 24px; text-align: center; cursor: pointer; }
.upload-icon { font-size: 32px; color: var(--color-primary); }
.upload-hint { font-size: 12px; color: var(--color-text-secondary); }
.search-section h4 { margin-bottom: 8px; font-size: 14px; }
.search-results { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.search-result-item { padding: 8px 12px; background: var(--color-fill-1, #f7f8fa); border-radius: 6px; font-size: 13px; }
.search-result-source { font-weight: 500; color: var(--color-text-2, #4e5969); margin-bottom: 4px; }
.search-result-content { color: var(--color-text-3, #86909c); line-height: 1.5; white-space: pre-wrap; }
</style>
