import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { McpConfig, McpTool } from '../types/mcp'

export const useMcpConfigStore = defineStore('mcpConfig', () => {
  const config = ref<McpConfig | null>(null)
  const tools = ref<McpTool[]>([])

  async function fetchConfig() {
    try {
      config.value = await window.electronAPI.mcp.getConfig()
    } catch (e: unknown) {
      console.error('Failed to fetch MCP config:', e)
    }
  }

  async function fetchTools() {
    try {
      tools.value = await window.electronAPI.mcp.listTools()
    } catch (e: unknown) {
      console.error('Failed to fetch MCP tools:', e)
    }
  }

  async function testConnection(cfg: Partial<McpConfig>) {
    try {
      return await window.electronAPI.mcp.testConnection(cfg)
    } catch (e: unknown) {
      console.error('Failed to test MCP connection:', e)
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  async function saveConfig(cfg: { name: string; transportType: string; url?: string; command?: string; args?: string }) {
    try {
      await window.electronAPI.mcp.saveConfig(cfg)
      await fetchConfig()
    } catch (e: unknown) {
      console.error('Failed to save MCP config:', e)
    }
  }

  return { config, tools, fetchConfig, fetchTools, testConnection, saveConfig }
})
