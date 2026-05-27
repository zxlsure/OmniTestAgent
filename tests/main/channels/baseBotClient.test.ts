import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../src/main/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}))

import { BaseBotClient } from '../../../src/main/channels/baseBotClient'
import type { BotClientConfig } from '../../../src/main/channels/baseBotClient'

class TestBotClient extends BaseBotClient {
  protected getHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json' }
  }
  protected getRequestBody(message: string): unknown {
    return { text: message }
  }
}

describe('BaseBotClient', () => {
  it('send 在未配置时返回 success: false', async () => {
    const client = new TestBotClient()
    const result = await client.send('hello')
    expect(result.success).toBe(false)
    expect(result.error).toBe('未配置')
  })

  it('send 在 webhookUrl 为空时返回 success: false', async () => {
    const client = new TestBotClient()
    client.configure({ webhookUrl: '' })
    const result = await client.send('hello')
    expect(result.success).toBe(false)
  })

  it('testConnection 在未配置时返回 success: false', async () => {
    const client = new TestBotClient()
    const result = await client.testConnection()
    expect(result.success).toBe(false)
    expect(result.error).toBe('未配置webhook URL')
  })

  it('testConnection 在 webhookUrl 为空时返回 success: false', async () => {
    const client = new TestBotClient()
    client.configure({ webhookUrl: '' })
    const result = await client.testConnection()
    expect(result.success).toBe(false)
  })

  it('configure 正确设置配置', () => {
    const client = new TestBotClient()
    const config: BotClientConfig = { webhookUrl: 'https://example.com/hook', token: 'abc' }
    client.configure(config)
    expect((client as any).config).toEqual(config)
  })
})
