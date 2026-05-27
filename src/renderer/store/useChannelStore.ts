import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChannelConfig } from '../types/channel'

export const useChannelStore = defineStore('channel', () => {
  const qqConfig = ref<ChannelConfig | null>(null)
  const welinkConfig = ref<ChannelConfig | null>(null)

  async function fetchConfig(type: string) {
    try {
      const config = await window.electronAPI.channel.getConfig(type)
      if (type === 'qq') qqConfig.value = config
      else welinkConfig.value = config
    } catch (e: unknown) {
      console.error('Failed to fetch channel config:', e)
    }
  }

  async function configure(type: string, config: ChannelConfig, isEnabled: boolean) {
    try {
      await window.electronAPI.channel.configure({ type, config, isEnabled })
    } catch (e: unknown) {
      console.error('Failed to configure channel:', e)
    }
  }

  async function test(type: string) {
    try {
      return await window.electronAPI.channel.test(type)
    } catch (e: unknown) {
      console.error('Failed to test channel:', e)
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  async function send(type: string, message: string) {
    try {
      return await window.electronAPI.channel.send({ type, message })
    } catch (e: unknown) {
      console.error('Failed to send channel message:', e)
      throw e
    }
  }

  return { qqConfig, welinkConfig, fetchConfig, configure, test, send }
})
