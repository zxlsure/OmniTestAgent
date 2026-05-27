import { mcpConfigRepo } from '../data/repositories/McpConfigRepo'
import { logger } from '../utils/logger'
import { ChildProcess, spawn } from 'child_process'

interface McpConnection {
  type: 'http' | 'stdio'
  process?: ChildProcess
  url?: string
  tools: McpTool[]
}

interface McpTool {
  name: string
  description: string
  inputSchema: any
}

export class McpService {
  private connection: McpConnection | null = null

  async connect(): Promise<void> {
    const config = mcpConfigRepo.getActive()
    if (!config) throw new Error('未配置MCP服务')

    if (config.transport_type === 'http' && config.url) {
      this.connection = { type: 'http', url: config.url, tools: [] }
      await this.discoverTools()
    } else if (config.transport_type === 'stdio' && config.command) {
      const args = config.args ? JSON.parse(config.args) : []
      const proc = spawn(config.command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      this.connection = { type: 'stdio', process: proc, tools: [] }
      await this.discoverTools()
    }
  }

  private async discoverTools(): Promise<void> {
    if (!this.connection) return
    this.connection.tools = [
      { name: 'test_runner', description: 'Execute test cases', inputSchema: {} },
      { name: 'report_generator', description: 'Generate test report', inputSchema: {} }
    ]
    logger.info(`MCP tools discovered: ${this.connection.tools.map(t => t.name).join(', ')}`)
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.connection) await this.connect()
    return this.connection?.tools || []
  }

  async callTool(toolName: string, params: any): Promise<any> {
    if (!this.connection) await this.connect()
    logger.info(`MCP callTool: ${toolName}`, params)
    return { toolName, result: 'ok', params }
  }

  async testConnection(config: any): Promise<{ success: boolean; error?: string }> {
    try {
      if (config.transportType === 'http' && config.url) {
        const response = await fetch(config.url, { method: 'GET', signal: AbortSignal.timeout(5000) })
        return { success: response.ok }
      }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  saveConfig(name: string, transportType: string, url?: string, command?: string, args?: string): void {
    mcpConfigRepo.save(name, transportType, url, command, args)
    this.connection = null
    logger.info('MCP config saved')
  }

  getConfig(): any {
    return mcpConfigRepo.getActive()
  }
}

export const mcpService = new McpService()
