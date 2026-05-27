<template>
  <div class="llm-config-view">
    <div class="page-header"><h2>LLM配置</h2></div>
    <a-card style="max-width: 640px">
      <a-form :model="form" layout="vertical" auto-label-width>
        <a-form-item label="服务商类型" required>
          <a-select v-model="form.provider" @change="onProviderChange">
            <a-option value="OpenAI">OpenAI</a-option>
            <a-option value="Anthropic">Anthropic (Claude)</a-option>
            <a-option value="DeepSeek">DeepSeek</a-option>
            <a-option value="Zhipu">智谱 (GLM)</a-option>
            <a-option value="Moonshot">Moonshot (Kimi)</a-option>
            <a-option value="Qwen">通义千问</a-option>
            <a-option value="Local">本地模型 (Ollama)</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="模型名称" required>
          <a-input v-model="form.modelName" :placeholder="modelPlaceholder" />
        </a-form-item>
        <a-form-item label="API URL" required>
          <a-input v-model="form.apiUrl" :placeholder="defaultBaseUrl" />
        </a-form-item>
        <a-form-item label="API Key" :required="form.provider !== 'Local'">
          <a-input-password v-model="form.apiKey" placeholder="请输入API Key" />
        </a-form-item>
        <a-form-item label="Temperature">
          <a-slider v-model="form.temperature" :min="0" :max="1" :step="0.1" show-input />
        </a-form-item>
        <a-form-item label="Max Tokens">
          <a-input-number v-model="form.maxTokens" :min="256" :max="128000" :step="256" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="onSave" :disabled="!canSave">保存配置</a-button>
            <a-button @click="onTestConnection" :loading="llmConfigStore.testing" :disabled="!canSave">
              测试连接
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
      <a-alert
        v-if="llmConfigStore.testResult"
        :type="llmConfigStore.testResult.success ? 'success' : 'error'"
        style="margin-top: 12px"
        closable
      >
        {{ llmConfigStore.testResult.success ? '连接成功！' : `连接失败: ${llmConfigStore.testResult.error}` }}
      </a-alert>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLlmConfigStore } from '@store/useLlmConfigStore'
import { Message } from '@arco-design/web-vue'

const llmConfigStore = useLlmConfigStore()
const form = ref({
  provider: 'OpenAI',
  modelName: '',
  apiUrl: '',
  apiKey: '',
  temperature: 0.7,
  maxTokens: 4096
})

const PROVIDER_DEFAULTS: Record<string, { url: string; models: string }> = {
  OpenAI: { url: 'https://api.openai.com/v1', models: 'gpt-4o, gpt-4o-mini, gpt-3.5-turbo' },
  Anthropic: { url: 'https://api.anthropic.com/v1', models: 'claude-sonnet-4-20250514, claude-3-5-haiku-20241022' },
  DeepSeek: { url: 'https://api.deepseek.com/v1', models: 'deepseek-chat, deepseek-coder' },
  Zhipu: { url: 'https://open.bigmodel.cn/api/paas/v4', models: 'glm-4, glm-4-flash' },
  Moonshot: { url: 'https://api.moonshot.cn/v1', models: 'moonshot-v1-8k, moonshot-v1-32k' },
  Qwen: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: 'qwen-turbo, qwen-plus, qwen-max' },
  Local: { url: 'http://localhost:11434/v1', models: 'llama3, mistral, codellama' }
}

const defaultBaseUrl = computed(() => PROVIDER_DEFAULTS[form.value.provider]?.url ?? '')
const modelPlaceholder = computed(() => PROVIDER_DEFAULTS[form.value.provider]?.models ?? 'model-name')
const canSave = computed(() => {
  const f = form.value
  if (!f.modelName || !f.apiUrl) return false
  if (f.provider !== 'Local' && !f.apiKey) return false
  return true
})

function onProviderChange() {
  if (!form.value.apiUrl) {
    form.value.apiUrl = defaultBaseUrl.value
  }
}

onMounted(async () => {
  await llmConfigStore.fetchConfig()
  if (llmConfigStore.config) {
    const c = llmConfigStore.config as any
    form.value.modelName = c.model_name || c.modelName || ''
    form.value.apiUrl = c.api_url || c.apiUrl || ''
    form.value.temperature = c.temperature ?? 0.7
    form.value.maxTokens = c.max_tokens ?? c.maxTokens ?? 4096
    if (c.apiKey && !c.hasApiKey) {
      form.value.apiKey = c.apiKey
    }
  }
})

async function onTestConnection() {
  const cfg = {
    modelName: form.value.modelName,
    apiUrl: form.value.apiUrl,
    apiKey: form.value.apiKey
  }
  await llmConfigStore.testConnection(cfg)
}

async function onSave() {
  const cfg = {
    modelName: form.value.modelName,
    apiUrl: form.value.apiUrl,
    apiKey: form.value.apiKey,
    temperature: form.value.temperature,
    maxTokens: form.value.maxTokens
  }
  await llmConfigStore.saveConfig(cfg)
  Message.success('LLM配置已保存')
}
</script>

<style scoped>
.page-header { margin-bottom: 16px; }
</style>
