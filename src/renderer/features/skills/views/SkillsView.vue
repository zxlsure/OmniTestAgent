<template>
  <div class="skills-view">
    <div class="page-header">
      <h2>Skills管理</h2>
      <a-button type="primary" @click="showImportModal = true">
        <template #icon><icon-import /></template>
        导入技能
      </a-button>
    </div>
    <a-row :gutter="16">
      <a-col :span="8" v-for="skill in skills" :key="skill.id">
        <a-card class="skill-card" hoverable>
          <a-card-meta :title="skill.display_name" :description="skill.description || '暂无描述'">
            <template #avatar>
              <a-avatar :style="{ backgroundColor: skill.is_builtin ? '#165dff' : '#00b42a' }">
                {{ skill.is_builtin ? '内' : '外' }}
              </a-avatar>
            </template>
          </a-card-meta>
          <div style="margin-top: 12px">
            <a-switch
              :model-value="skill.is_enabled === 1"
              @change="(val: boolean) => onToggle(skill.id, val)"
            />
            <span style="margin-left: 8px; font-size: 12px; color: var(--color-text-secondary)">
              {{ skill.is_enabled ? '已启用' : '已禁用' }}
            </span>
          </div>
        </a-card>
      </a-col>
    </a-row>
    <a-modal v-model:visible="showImportModal" title="导入技能" @ok="onImportConfirm" :ok-loading="importLoading">
      <a-form layout="vertical">
        <a-form-item label="选择技能文件" required>
          <a-input v-model="importFilePath" placeholder="请输入 .js/.ts 文件路径" readonly @click="onSelectFile" />
        </a-form-item>
        <a-form-item label="技能名称" required>
          <a-input v-model="importName" placeholder="请输入技能名称" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSkillStore } from '@store/useSkillStore'

const skillStore = useSkillStore()
const skills = computed(() => skillStore.skills)
const showImportModal = ref(false)
const importFilePath = ref('')
const importName = ref('')
const importLoading = ref(false)

onMounted(() => skillStore.fetchSkills())

async function onToggle(id: string, enabled: boolean) {
  try {
    await skillStore.toggleSkill(id, enabled)
  } catch (e: unknown) {
    console.error('Toggle skill failed:', e)
  }
}

async function onSelectFile() {
  const result = await window.electronAPI.fileOp.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Skill Files', extensions: ['js', 'ts'] }]
  })
  if (result && result.length > 0) {
    importFilePath.value = result[0]
    if (!importName.value) {
      const fileName = importFilePath.value.split(/[/\\]/).pop() || ''
      importName.value = fileName.replace(/\.(js|ts)$/, '')
    }
  }
}

async function onImportConfirm() {
  if (!importFilePath.value || !importName.value) return
  const ext = importFilePath.value.split('.').pop()?.toLowerCase()
  if (ext !== 'js' && ext !== 'ts') {
    return
  }
  importLoading.value = true
  try {
    const content = await window.electronAPI.fileOp.readFileContent({
      projectId: '',
      dirName: '',
      fileName: importFilePath.value
    })
    await skillStore.importSkill({
      name: importName.value,
      filePath: importFilePath.value,
      content: content.content
    })
    showImportModal.value = false
    importFilePath.value = ''
    importName.value = ''
  } catch (e: unknown) {
    console.error('Import failed:', e)
  } finally {
    importLoading.value = false
  }
}
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.skill-card { margin-bottom: 16px; }
</style>
