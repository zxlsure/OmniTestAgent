<template>
  <div class="project-management">
    <div class="page-header">
      <h2>项目管理</h2>
      <a-button type="primary" @click="showCreateModal = true">
        <template #icon><icon-plus /></template>
        新建项目
      </a-button>
    </div>
    <a-row :gutter="16">
      <a-col :span="8" v-for="project in projects" :key="project.id">
        <a-card class="project-card" hoverable @click="onSelect(project)">
          <a-card-meta :title="project.name" :description="project.description || '暂无描述'" />
          <template #actions>
            <a-button type="text" status="danger" @click.stop="onDelete(project)">
              <template #icon><icon-delete /></template>
            </a-button>
          </template>
        </a-card>
      </a-col>
    </a-row>
    <a-modal v-model:visible="showCreateModal" title="新建项目" @ok="onCreate">
      <a-form :model="form" layout="vertical">
        <a-form-item field="name" label="项目名称" required>
          <a-input v-model="form.name" placeholder="请输入项目名称" />
        </a-form-item>
        <a-form-item field="description" label="项目描述">
          <a-textarea v-model="form.description" placeholder="请输入项目描述" />
        </a-form-item>
        <a-form-item field="directory" label="项目目录">
          <div style="display: flex; gap: 8px;">
            <a-input v-model="form.directory" placeholder="默认使用用户文档目录" readonly />
            <a-button @click="onSelectDirectory">选择目录</a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Modal } from '@arco-design/web-vue'
import { useProjectStore } from '@store/useProjectStore'
import { useNotification } from '@composables/useNotification'

const projectStore = useProjectStore()
const { success, error } = useNotification()
const projects = computed(() => projectStore.projects)
const showCreateModal = ref(false)
const form = ref({ name: '', description: '', directory: '' })

onMounted(() => projectStore.fetchProjects())

async function onSelectDirectory() {
  try {
    const paths = await window.electronAPI.fileOp.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择项目目录'
    })
    if (paths && paths.length > 0) {
      form.value.directory = paths[0]
    }
  } catch (e: unknown) {
    console.error('目录选择失败:', e)
    error('目录选择失败')
  }
}

async function onCreate() {
  if (!form.value.name.trim()) { error('请输入项目名称'); return }
  try {
    const project = await projectStore.createProject(
      form.value.name,
      form.value.description,
      form.value.directory
    )
    if (project) {
      await projectStore.switchProject(project.id)
      success('项目创建成功')
      showCreateModal.value = false
      form.value = { name: '', description: '', directory: '' }
    }
  } catch (e: any) {
    error(e.message || '项目创建失败')
  }
}

function onSelect(project: any) {
  projectStore.switchProject(project.id)
}

async function onDelete(project: any) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除项目「${project.name}」吗？此操作不可撤销。`,
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      await projectStore.deleteProject(project.id)
      success('项目已删除')
    }
  })
}
</script>

<style scoped>
.project-card { margin-bottom: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
</style>
