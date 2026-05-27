import { registerIpcHandler } from './helpers'
import { mcpService } from '../services/McpService'

interface McpConfigInput {
  name: string
  transportType: string
  url?: string
  command?: string
  args?: string
}

export function registerMcpHandler(): void {
  registerIpcHandler('mcp:callTool', (params: { toolName: string; params: unknown }) => mcpService.callTool(params.toolName, params.params))
  registerIpcHandler('mcp:testConnection', (config: Record<string, unknown>) => mcpService.testConnection(config))
  registerIpcHandler('mcp:listTools', () => mcpService.listTools())
  registerIpcHandler('mcp:getConfig', () => mcpService.getConfig())
  registerIpcHandler('mcp:saveConfig', (config: McpConfigInput) =>
    mcpService.saveConfig(config.name, config.transportType, config.url, config.command, config.args))
}
