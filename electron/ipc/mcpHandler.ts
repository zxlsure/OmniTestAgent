import { registerIpcHandler } from './helpers'
import { mcpService } from '../services/McpService'

export function registerMcpHandler(): void {
  registerIpcHandler('mcp:callTool', (params: any) => mcpService.callTool(params.toolName, params.params))
  registerIpcHandler('mcp:testConnection', (config: any) => mcpService.testConnection(config))
  registerIpcHandler('mcp:listTools', () => mcpService.listTools())
  registerIpcHandler('mcp:getConfig', () => mcpService.getConfig())
  registerIpcHandler('mcp:saveConfig', (config: any) =>
    mcpService.saveConfig(config.name, config.transportType, config.url, config.command, config.args))
}
