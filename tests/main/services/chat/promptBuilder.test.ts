// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../src/main/services/KnowledgeService', () => ({
  knowledgeService: {
    search: vi.fn()
  }
}))

vi.mock('../../../../src/main/services/SkillRegistry', () => ({
  skillRegistry: {
    getEnabledSkills: vi.fn(),
    isSkillEnabled: vi.fn().mockReturnValue(true)
  }
}))

vi.mock('../../../../src/main/services/SkillEngine', () => ({
  skillEngine: {
    execute: vi.fn()
  }
}))

vi.mock('../../../../src/main/services/TestFlowPipelineService', () => ({
  testFlowPipelineService: {
    getPipelineState: vi.fn(),
    updateStepStatus: vi.fn(),
    reviewStep: vi.fn()
  }
}))

vi.mock('../../../../src/main/services/FileOperationService', () => ({
  fileOperationService: {
    getProjectDir: vi.fn(),
    writeFile: vi.fn()
  }
}))

vi.mock('../../../../src/main/data/repositories/ProjectRepo', () => ({
  projectRepo: {
    getById: vi.fn()
  }
}))

vi.mock('../../../../src/main/data/repositories/FileOperationRepo', () => ({
  fileOperationRepo: {
    getTestDesignDir: vi.fn(),
    listFiles: vi.fn(),
    readTextFile: vi.fn()
  }
}))

vi.mock('../../../../src/main/data/repositories/LlmConfigRepo', () => ({
  llmConfigRepo: {
    getActive: vi.fn()
  }
}))

vi.mock('../../../../src/main/data/repositories/FlowActivityRepo', () => ({
  flowActivityRepo: {
    getByType: vi.fn(),
    updateStatus: vi.fn(),
    getById: vi.fn(),
    addReview: vi.fn()
  }
}))

vi.mock('../../../../src/main/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { buildSystemPrompt, type PromptContext } from '../../../../src/main/services/chat/promptBuilder'
import { knowledgeService } from '../../../../src/main/services/KnowledgeService'
import { projectRepo } from '../../../../src/main/data/repositories/ProjectRepo'
import { fileOperationRepo } from '../../../../src/main/data/repositories/FileOperationRepo'
import { llmConfigRepo } from '../../../../src/main/data/repositories/LlmConfigRepo'

describe('buildSystemPrompt', () => {
  const baseContext: PromptContext = {
    userMessage: '帮我分析需求',
    enabledSkills: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    llmConfigRepo.getActive = vi.fn().mockReturnValue({ max_tokens: 4096 })
  })

  it('返回非空字符串', async () => {
    const prompt = await buildSystemPrompt(baseContext)
    expect(prompt).toBeTruthy()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('包含角色层："You are OmniTestAgent"', async () => {
    const prompt = await buildSystemPrompt(baseContext)
    expect(prompt).toContain('You are OmniTestAgent')
  })

  it('包含角色层："testing expert"', async () => {
    const prompt = await buildSystemPrompt(baseContext)
    expect(prompt).toContain('testing expert')
  })

  it('包含工具层："Available Tools"', async () => {
    const prompt = await buildSystemPrompt(baseContext)
    expect(prompt).toContain('Available Tools')
  })

  it('包含行为层（Markdown格式）', async () => {
    const prompt = await buildSystemPrompt(baseContext)
    expect(prompt).toContain('Markdown')
  })

  it('包含思考协议层', async () => {
    const prompt = await buildSystemPrompt(baseContext)
    expect(prompt).toContain('thinking_protocol')
  })

  it('无项目时仍生成有效prompt', async () => {
    const context: PromptContext = {
      ...baseContext,
      projectId: undefined,
      knowledgeBaseId: undefined,
      pipelineState: undefined
    }
    const prompt = await buildSystemPrompt(context)
    expect(prompt).toBeTruthy()
    expect(prompt).toContain('You are OmniTestAgent')
    expect(prompt).toContain('Available Tools')
  })

  it('知识库上下文注入', async () => {
    knowledgeService.search = vi.fn().mockReturnValue([
      { source: 'test-doc.md', score: 0.95, content: '测试知识片段内容' }
    ])
    const context: PromptContext = {
      ...baseContext,
      knowledgeBaseId: 'kb-001'
    }
    const prompt = await buildSystemPrompt(context)
    expect(knowledgeService.search).toHaveBeenCalledWith('kb-001', '帮我分析需求', 5)
    expect(prompt).toContain('<knowledge>')
    expect(prompt).toContain('test-doc.md')
    expect(prompt).toContain('测试知识片段内容')
  })

  it('知识库搜索无结果时不注入knowledge标签', async () => {
    knowledgeService.search = vi.fn().mockReturnValue([])
    const context: PromptContext = {
      ...baseContext,
      knowledgeBaseId: 'kb-001'
    }
    const prompt = await buildSystemPrompt(context)
    expect(prompt).not.toContain('<knowledge>')
  })

  it('流水线状态注入', async () => {
    projectRepo.getById = vi.fn().mockReturnValue({
      id: 'proj-1', name: '测试项目', description: '描述'
    })
    fileOperationRepo.getTestDesignDir = vi.fn().mockReturnValue('/data/projects/proj-1')
    fileOperationRepo.listFiles = vi.fn().mockReturnValue([])
    llmConfigRepo.getActive = vi.fn().mockReturnValue({ max_tokens: 32768 })

    const pipelineState = {
      projectId: 'proj-1',
      steps: [
        { type: 'requirement_import', status: 'completed', errorMessage: null },
        { type: 'requirement_analysis', status: 'running', errorMessage: null }
      ],
      overallProgress: 30,
      lastUpdatedAt: new Date().toISOString()
    }

    const context: PromptContext = {
      ...baseContext,
      projectId: 'proj-1',
      pipelineState: pipelineState as any
    }
    const prompt = await buildSystemPrompt(context)
    expect(prompt).toContain('<pipeline>')
    expect(prompt).toContain('30')
  })

  it('项目信息注入', async () => {
    projectRepo.getById = vi.fn().mockReturnValue({
      id: 'proj-1', name: '我的项目', description: '项目描述'
    })
    fileOperationRepo.getTestDesignDir = vi.fn().mockReturnValue('/data/projects/proj-1')
    fileOperationRepo.listFiles = vi.fn().mockReturnValue([])

    const context: PromptContext = {
      ...baseContext,
      projectId: 'proj-1'
    }
    const prompt = await buildSystemPrompt(context)
    expect(prompt).toContain('<project>')
    expect(prompt).toContain('我的项目')
  })

  it('知识库检索异常时优雅降级', async () => {
    knowledgeService.search = vi.fn().mockRejectedValue(new Error('Service unavailable'))
    const context: PromptContext = {
      ...baseContext,
      knowledgeBaseId: 'kb-001'
    }
    const prompt = await buildSystemPrompt(context)
    expect(prompt).not.toContain('<knowledge>')
    expect(prompt).toBeTruthy()
  })

  it('上下文压缩-超Token预算时裁剪', async () => {
    llmConfigRepo.getActive = vi.fn().mockReturnValue({ max_tokens: 100 })
    const prompt = await buildSystemPrompt(baseContext)
    expect(prompt).toBeTruthy()
    expect(prompt).toContain('You are OmniTestAgent')
    expect(prompt).toContain('Available Tools')
  })

  it('enabledSkills注入skill层', async () => {
    const context: PromptContext = {
      ...baseContext,
      enabledSkills: [
        { name: 'requirementParser', displayName: '需求解析', description: '解析需求文档', isCore: true, isEnabled: true } as any
      ]
    }
    const prompt = await buildSystemPrompt(context)
    expect(prompt).toContain('<skills>')
    expect(prompt).toContain('需求解析')
  })

  it('无enabledSkills不注入skill层', async () => {
    const context: PromptContext = {
      ...baseContext,
      enabledSkills: []
    }
    const prompt = await buildSystemPrompt(context)
    expect(prompt).not.toContain('<skills>')
  })
})
