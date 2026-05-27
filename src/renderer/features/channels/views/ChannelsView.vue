<template>
  <div class="channels-view">
    <div class="page-header"><h2>Channels配置</h2></div>
    <a-row :gutter="16">
      <a-col :span="12">
        <a-card title="QQ Bot">
          <a-form :model="qqForm" layout="vertical">
            <a-form-item label="Webhook URL">
              <a-input v-model="qqForm.webhookUrl" placeholder="请输入QQ Bot Webhook URL" />
            </a-form-item>
            <a-form-item label="Token">
              <a-input-password v-model="qqForm.token" placeholder="请输入Token" />
            </a-form-item>
            <a-form-item label="启用">
              <a-switch v-model="qqForm.isEnabled" />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button @click="onTest('qq')">测试连接</a-button>
                <a-button type="primary" @click="onSave('qq')">保存</a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card title="Welink Bot">
          <a-form :model="welinkForm" layout="vertical">
            <a-form-item label="Webhook URL">
              <a-input v-model="welinkForm.webhookUrl" placeholder="请输入Welink Bot Webhook URL" />
            </a-form-item>
            <a-form-item label="App ID">
              <a-input v-model="welinkForm.appId" placeholder="请输入App ID" />
            </a-form-item>
            <a-form-item label="App Secret">
              <a-input-password v-model="welinkForm.appSecret" placeholder="请输入App Secret" />
            </a-form-item>
            <a-form-item label="启用">
              <a-switch v-model="welinkForm.isEnabled" />
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button @click="onTest('welink')">测试连接</a-button>
                <a-button type="primary" @click="onSave('welink')">保存</a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-card>
      </a-col>
    </a-row>
    <a-row :gutter="16" style="margin-top: 16px">
      <a-col :span="12">
        <a-card title="QQ Bot 消息发送">
          <a-input v-model="qqMessage" placeholder="输入消息内容" style="margin-bottom: 8px" />
          <a-button type="primary" :disabled="!qqForm.isEnabled || !qqMessage" @click="onSend('qq')">发送</a-button>
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card title="Welink Bot 消息发送">
          <a-input v-model="welinkMessage" placeholder="输入消息内容" style="margin-bottom: 8px" />
          <a-button type="primary" :disabled="!welinkForm.isEnabled || !welinkMessage" @click="onSend('welink')">发送</a-button>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useChannelStore } from '@store/useChannelStore'

const channelStore = useChannelStore()
const qqForm = ref({ webhookUrl: '', token: '', isEnabled: false })
const welinkForm = ref({ webhookUrl: '', appId: '', appSecret: '', isEnabled: false })
const qqMessage = ref('')
const welinkMessage = ref('')

onMounted(async () => {
  try {
    await channelStore.fetchConfig('qq')
    if (channelStore.qqConfig) {
      qqForm.value = {
        webhookUrl: channelStore.qqConfig.webhookUrl || '',
        token: channelStore.qqConfig.token || '',
        isEnabled: channelStore.qqConfig.isEnabled || false
      }
    }
  } catch (e: unknown) { console.error('Fetch QQ config failed:', e) }
  try {
    await channelStore.fetchConfig('welink')
    if (channelStore.welinkConfig) {
      welinkForm.value = {
        webhookUrl: channelStore.welinkConfig.webhookUrl || '',
        appId: channelStore.welinkConfig.appId || '',
        appSecret: channelStore.welinkConfig.appSecret || '',
        isEnabled: channelStore.welinkConfig.isEnabled || false
      }
    }
  } catch (e: unknown) { console.error('Fetch Welink config failed:', e) }
})

async function onTest(type: string) {
  await channelStore.test(type)
}

async function onSave(type: string) {
  const form = type === 'qq' ? qqForm.value : welinkForm.value
  await channelStore.configure(type, form, form.isEnabled)
}

async function onSend(type: string) {
  const message = type === 'qq' ? qqMessage.value : welinkMessage.value
  if (!message) return
  try {
    await channelStore.send(type, message)
    if (type === 'qq') qqMessage.value = ''
    else welinkMessage.value = ''
  } catch (e: unknown) {
    console.error('Send failed:', e)
  }
}
</script>

<style scoped>
.page-header { margin-bottom: 16px; }
</style>
