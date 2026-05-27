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

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: any
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: any
  error?: { code: number; message: string; data?: any }
}

export class McpService {
  private connection: McpConnection | null = null
  private process: ChildProcess | null = null
  private nextRequestId = 1
  private pendingRequests = new Map<number, { resolve: (value: any) => void; reject: (reason: any) => void }>()

  async connect(): Promise<void> {
    if (this.process) {
      this.disconnect()
    }

    const config = mcpConfigRepo.getActive()
    if (!config) throw new Error('未配置MCP服务')

    if (config.transport_type === 'http' && config.url) {
      this.connection = { type: 'http', url: config.url, tools: [] }
      await this.discoverTools()
    } else if (config.transport_type === 'stdio' && config.command) {
      let args: string[] = []
      if (config.args) {
        try {
          args = JSON.parse(config.args)
        } catch {
          throw new Error(`MCP config args is not valid JSON: ${config.args}`)
        }
      }
      this.process = spawn(config.command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      this.process.on('error', (err) => {
        logger.error('MCP process error:', err)
        this.connection = null
      })
      this.process.on('exit', (code) => {
        logger.info(`MCP process exited with code ${code}`)
        this.connection = null
        this.process = null
      })

      let buffer = ''
      this.process.stdout!.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const response = JSON.parse(line) as JsonRpcResponse
            const pending = this.pendingRequests.get(response.id)
            if (pending) {
              this.pendingRequests.delete(response.id)
              if (response.error) {
                pending.reject(new Error(response.error.message))
              } else {
                pending.resolve(response.result)
              }
            }
          } catch {
            logger.warn('Failed to parse MCP response:', line)
          }
        }
      })

      this.process.stderr!.on('data', (chunk: Buffer) => {
        logger.warn('MCP stderr:', chunk.toString())
      })

      this.connection = { type: 'stdio', process: this.process, tools: [] }

      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'OmniTestAgent', version: '1.0.0' }
      })
      this.sendNotification('notifications/initialized', {})

      await this.discoverTools()
    }
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error('MCP process not available'))
        return
      }
      const id = this.nextRequestId++
      const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }
      this.pendingRequests.set(id, { resolve, reject })
      this.process.stdin.write(JSON.stringify(request) + '\n')
    })
  }

  private sendNotification(method: string, params: any): void {
    if (!this.process?.stdin?.writable) return
    const notification = { jsonrpc: '2.0', method, params }
    this.process.stdin.write(JSON.stringify(notification) + '\n')
  }

  disconnect(): void {
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    if (this.connection) {
      this.connection.tools = []
    }
    this.connection = null
  }

  private async discoverTools(): Promise<void> {
    if (!this.connection) return
    if (this.connection.type === 'stdio') {
      try {
        const result = await this.sendRequest('tools/list', {})
        this.connection.tools = (result?.tools || []).map((t: any) => ({
          name: t.name,
          description: t.description || '',
          inputSchema: t.inputSchema || {}
        }))
      } catch (e: any) {
        logger.error('Failed to discover MCP tools via JSON-RPC:', e)
        this.connection.tools = []
      }
    } else {
      this.connection.tools = [
        { name: 'test_runner', description: 'Execute test cases', inputSchema: {} },
        { name: 'report_generator', description: 'Generate test report', inputSchema: {} }
      ]
    }
    logger.info(`MCP tools discovered: ${this.connection.tools.map(t => t.name).join(', ')}`)
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.connection) await this.connect()
    return this.connection?.tools || []
  }

  async callTool(toolName: string, params: unknown): Promise<unknown> {
    if (!this.connection) await this.connect()
    if (this.connection?.type === 'stdio') {
      try {
        const result = await this.sendRequest('tools/call', { name: toolName, arguments: params })
        return result
      } catch (e: any) {
        logger.error(`MCP callTool failed: ${toolName}`, e)
        throw e
      }
    }
    logger.info(`MCP callTool: ${toolName}`, params)
    return { toolName, result: 'ok', params }
  }

  async testConnection(config: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    try {
      if (config.transportType === 'http' && typeof config.url === 'string') {
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

  getConfig(): unknown {
    return mcpConfigRepo.getActive()
  }
}

export const mcpService = new McpService()
