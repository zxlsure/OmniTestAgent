// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../src/main/services/SkillEngine', () => ({
  skillEngine: {
    execute: vi.fn()
  }
}))

vi.mock('../../../../src/main/services/SkillRegistry', () => ({
  skillRegistry: {
    isSkillEnabled: vi.fn().mockReturnValue(true)
  }
}))

vi.mock('../../../../src/main/services/KnowledgeService', () => ({
  knowledgeService: {
    search: vi.fn()
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

vi.mock('../../../../src/main/data/repositories/FileOperationRepo', () => ({
  fileOperationRepo: {
    readTextFile: vi.fn(),
    listFiles: vi.fn()
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

import { getToolSchemas, executeTool } from '../../../../src/main/services/chat/toolRegistry'
import { skillEngine } from '../../../../src/main/services/SkillEngine'
import { knowledgeService } from '../../../../src/main/services/KnowledgeService'
import { testFlowPipelineService } from '../../../../src/main/services/TestFlowPipelineService'
import { fileOperationService } from '../../../../src/main/services/FileOperationService'
import { fileOperationRepo } from '../../../../src/main/data/repositories/FileOperationRepo'
import { flowActivityRepo } from '../../../../src/main/data/repositories/FlowActivityRepo'
import { skillRegistry } from '../../../../src/main/services/SkillRegistry'

const TOOL_CONTEXT = { projectId: 'proj-1', sessionId: 'sess-1', knowledgeBaseId: 'kb-1' }

describe('getToolSchemas', () => {
  it('返回9个工具', () => {
    const schemas = getToolSchemas()
    expect(schemas).toHaveLength(9)
  })

  it('每个工具具有有效的JSON Schema（name, description, parameters）', () => {
    const schemas = getToolSchemas()
    for (const schema of schemas) {
      expect(schema.type).toBe('function')
      expect(schema.function.name).toBeTruthy()
      expect(typeof schema.function.name).toBe('string')
      expect(schema.function.description).toBeTruthy()
      expect(typeof schema.function.description).toBe('string')
      expect(schema.function.parameters).toBeDefined()
      expect(schema.function.parameters.type).toBe('object')
      expect(schema.function.parameters).toHaveProperty('properties')
    }
  })

  it('包含所有9个工具名称', () => {
    const schemas = getToolSchemas()
    const names = schemas.map(s => s.function.name)
    expect(names).toContain('analyze_requirement')
    expect(names).toContain('design_test')
    expect(names).toContain('generate_cases')
    expect(names).toContain('generate_script')
    expect(names).toContain('search_knowledge')
    expect(names).toContain('read_file')
    expect(names).toContain('list_files')
    expect(names).toContain('get_pipeline_status')
    expect(names).toContain('review_artifact')
  })
})

describe('executeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('search_knowledge 正确路由到 KnowledgeService', async () => {
    knowledgeService.search = vi.fn().mockReturnValue([
      { source: 'doc.md', content: '知识内容', score: 0.9 }
    ])
    const result = await executeTool('search_knowledge', { query: '测试', top_k: 3 }, TOOL_CONTEXT)
    expect(knowledgeService.search).toHaveBeenCalledWith('kb-1', '测试', 3)
    const parsed = JSON.parse(result)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].content).toBe('知识内容')
  })

  it('search_knowledge 无知识库时返回错误', async () => {
    const ctx = { projectId: 'proj-1', sessionId: 'sess-1' }
    const result = await executeTool('search_knowledge', { query: '测试' }, ctx)
    expect(result).toContain('No knowledge base configured')
  })

  it('get_pipeline_status 正确路由到 PipelineService', async () => {
    const fakeState = { projectId: 'proj-1', steps: [], overallProgress: 50 }
    testFlowPipelineService.getPipelineState = vi.fn().mockReturnValue(fakeState)
    const result = await executeTool('get_pipeline_status', {}, TOOL_CONTEXT)
    expect(testFlowPipelineService.getPipelineState).toHaveBeenCalledWith('proj-1')
    const parsed = JSON.parse(result)
    expect(parsed.overallProgress).toBe(50)
  })

  it('read_file 正确路由到 FileService', async () => {
    fileOperationService.getProjectDir = vi.fn().mockReturnValue('/data/projects/proj-1')
    fileOperationRepo.readTextFile = vi.fn().mockReturnValue('文件内容')
    const result = await executeTool('read_file', { file_path: '01_requirement/doc.md' }, TOOL_CONTEXT)
    expect(fileOperationService.getProjectDir).toHaveBeenCalledWith('proj-1')
    expect(fileOperationRepo.readTextFile).toHaveBeenCalled()
    expect(result).toBe('文件内容')
  })

  it('list_files 正确路由到 FileService', async () => {
    fileOperationService.getProjectDir = vi.fn().mockReturnValue('/data/projects/proj-1')
    fileOperationRepo.listFiles = vi.fn().mockReturnValue([{ name: 'doc.md', isDirectory: false }])
    const result = await executeTool('list_files', { directory: '01_requirement' }, TOOL_CONTEXT)
    expect(fileOperationRepo.listFiles).toHaveBeenCalled()
    const parsed = JSON.parse(result)
    expect(parsed).toHaveLength(1)
  })

  it('analyze_requirement 正确路由到 SkillEngine', async () => {
    skillEngine.execute = vi.fn().mockResolvedValue({ success: true, output: { result: '分析结果' } })
    const result = await executeTool('analyze_requirement', { focus_area: '登录模块' }, TOOL_CONTEXT)
    expect(skillEngine.execute).toHaveBeenCalledWith('requirementParser', {
      projectId: 'proj-1',
      inputData: { focus_area: '登录模块' }
    })
    const parsed = JSON.parse(result)
    expect(parsed.result).toBe('分析结果')
  })

  it('review_artifact 正确处理审核', async () => {
    testFlowPipelineService.getPipelineState = vi.fn().mockReturnValue({
      steps: [{ type: 'requirement_analysis' }]
    })
    flowActivityRepo.getByType = vi.fn().mockReturnValue({ id: 'act-1', activity_type: 'requirement_analysis' })
    const result = await executeTool('review_artifact', {
      step_type: 'requirement_analysis',
      result: 'approved',
      comment: '通过'
    }, TOOL_CONTEXT)
    const parsed = JSON.parse(result)
    expect(parsed.reviewResult).toBe('approved')
    expect(parsed.status).toBe('review_submitted')
  })

  it('未知工具名返回错误信息', async () => {
    const result = await executeTool('unknown_tool', {}, TOOL_CONTEXT)
    expect(result).toContain('Unknown tool')
  })
})
