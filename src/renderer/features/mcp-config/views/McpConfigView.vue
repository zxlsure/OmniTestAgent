<template>
  <div class="mcp-config-view">
    <div class="page-header"><h2>MCP配置</h2></div>
    <a-card style="max-width: 640px">
      <a-form :model="form" layout="vertical">
        <a-form-item label="名称" required>
          <a-input v-model="form.name" placeholder="MCP服务名称" />
        </a-form-item>
        <a-form-item label="传输协议" required>
          <a-radio-group v-model="form.transportType">
            <a-radio value="http">HTTP/SSE</a-radio>
            <a-radio value="stdio">Stdio</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="form.transportType === 'http'" label="URL">
          <a-input v-model="form.url" placeholder="http://localhost:3000/mcp" />
        </a-form-item>
        <a-form-item v-if="form.transportType === 'stdio'" label="命令">
          <a-input v-model="form.command" placeholder="可执行文件路径" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button @click="onTestConnection">测试连接</a-button>
            <a-button type="primary" @click="onSave">保存配置</a-button>
          </a-space>
        </a-form-item>
        <a-alert v-if="testResult" :type="testResult.success ? 'success' : 'error'" :closable="true" style="margin-top: 8px">
          {{ testResult.success ? '连接成功' : `连接失败：${testResult.error || '未知错误'}` }}
        </a-alert>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMcpConfigStore } from '@store/useMcpConfigStore'

const mcpConfigStore = useMcpConfigStore()
const form = ref({ name: '', transportType: 'http', url: '', command: '', args: '' })
const testResult = ref<{ success: boolean; error?: string } | null>(null)

onMounted(async () => {
  await mcpConfigStore.fetchConfig()
  if (mcpConfigStore.config) {
    form.value.name = mcpConfigStore.config.name
    form.value.transportType = mcpConfigStore.config.transport_type
    form.value.url = mcpConfigStore.config.url || ''
    form.value.command = mcpConfigStore.config.command || ''
  }
})

async function onTestConnection() {
  testResult.value = await mcpConfigStore.testConnection(form.value)
}

async function onSave() {
  await mcpConfigStore.saveConfig(form.value)
}
</script>

<style scoped>
.page-header { margin-bottom: 16px; }
</style>
