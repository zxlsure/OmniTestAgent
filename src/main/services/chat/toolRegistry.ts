import { join } from 'path'
import { skillEngine } from '../SkillEngine'
import { skillRegistry } from '../SkillRegistry'
import { knowledgeService } from '../KnowledgeService'
import { testFlowPipelineService } from '../TestFlowPipelineService'
import { fileOperationService } from '../FileOperationService'
import { fileOperationRepo } from '../../data/repositories/FileOperationRepo'
import { flowActivityRepo } from '../../data/repositories/FlowActivityRepo'
import { logger } from '../../utils/logger'
import type { LLMToolDefinition } from '../../data/types/chatAgent'
import { PipelineStepType, StepStatus, STEP_META_MAP } from '../../data/types/pipeline'

export interface ToolContext {
  projectId: string
  sessionId: string
  knowledgeBaseId?: string
}

const TOOL_SCHEMAS: LLMToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'analyze_requirement',
      description: '分析需求文档，提取测试点、功能模块和测试优先级。调用需求解析Skill执行分析。',
      parameters: {
        type: 'object',
        properties: {
          focus_area: {
            type: 'string',
            description: '分析关注区域，如"用户登录模块"、"支付流程"等'
          },
          analysis_depth: {
            type: 'string',
            enum: ['overview', 'detailed', 'comprehensive'],
            description: '分析深度：概览/详细/全面，默认detailed'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'design_test',
      description: '基于需求分析结果设计测试方案，包括测试策略、测试类型分配和测试环境要求。调用测试设计Skill执行。',
      parameters: {
        type: 'object',
        properties: {
          test_types: {
            type: 'array',
            items: { type: 'string' },
            description: '指定测试类型，如["functional", "performance", "security"]'
          },
          priority_modules: {
            type: 'array',
            items: { type: 'string' },
            description: '优先测试的模块列表'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_cases',
      description: '基于测试设计方案生成测试用例，包含测试步骤、预期结果和优先级。调用用例生成Skill执行。',
      parameters: {
        type: 'object',
        properties: {
          module_name: {
            type: 'string',
            description: '指定生成用例的模块名称'
          },
          case_format: {
            type: 'string',
            enum: ['table', 'gherkin', 'markdown'],
            description: '用例输出格式：表格/Gherkin/Markdown，默认markdown'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_script',
      description: '基于测试用例生成自动化测试脚本。调用脚本生成Skill执行，结果写入项目目录。',
      parameters: {
        type: 'object',
        properties: {
          framework: {
            type: 'string',
            enum: ['pytest', 'selenium', 'playwright', 'jest', 'unittest'],
            description: '目标测试框架，默认pytest'
          },
          target_cases: {
            type: 'array',
            items: { type: 'string' },
            description: '指定要生成脚本的用例ID列表'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: '在项目知识库中检索与查询相关的知识片段，用于补充测试领域知识和参考信息。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '检索查询文本'
          },
          top_k: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
            description: '返回结果数量，默认5'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取项目中指定文件的内容，如需求文档、Spec文件、测试用例等。',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: '相对于项目根目录的文件路径'
          },
          encoding: {
            type: 'string',
            enum: ['utf-8', 'gbk'],
            description: '文件编码，默认utf-8'
          }
        },
        required: ['file_path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: '列出项目指定目录下的文件列表，用于了解项目结构和查找文件。',
      parameters: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: '相对于项目根目录的目录路径，默认为根目录'
          },
          pattern: {
            type: 'string',
            description: '文件名匹配模式(glob)，如"*.md"、"**/*.py"'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pipeline_status',
      description: '获取当前项目测试流水线各环节的执行状态，包含各步骤完成情况和整体进度。',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'review_artifact',
      description: '对流水线指定环节的产出进行审核，可批准或驳回并附修改意见。',
      parameters: {
        type: 'object',
        properties: {
          step_type: {
            type: 'string',
            enum: ['requirement_analysis', 'test_design', 'test_cases', 'test_script'],
            description: '要审核的流水线环节类型'
          },
          result: {
            type: 'string',
            enum: ['approved', 'rejected'],
            description: '审核结果：批准/驳回'
          },
          comment: {
            type: 'string',
            description: '审核意见或修改建议'
          }
        },
        required: ['step_type', 'result']
      }
    }
  }
]

const SKILL_TOOL_MAP: Record<string, string> = {
  analyze_requirement: 'requirementParser',
  design_test: 'testDesigner',
  generate_cases: 'caseGenerator',
  generate_script: 'scriptGenerator'
}

const SKILL_OUTPUT_DIR_MAP: Record<string, string> = {
  analyze_requirement: '03_requirement_analyze',
  design_test: '04_test_design',
  generate_cases: '05_test_cases',
  generate_script: '06_test_scripts'
}

const SKILL_STEP_TYPE_MAP: Record<string, PipelineStepType> = {
  analyze_requirement: PipelineStepType.REQUIREMENT_ANALYSIS,
  design_test: PipelineStepType.TEST_DESIGN,
  generate_cases: PipelineStepType.CASE_GENERATION,
  generate_script: PipelineStepType.SCRIPT_GENERATION
}

const MANUAL_APPROVAL_TOOLS = new Set([
  'analyze_requirement', 'design_test', 'generate_cases',
  'generate_script', 'review_artifact'
])

const SKILL_BASED_TOOLS = new Set([
  'analyze_requirement', 'design_test', 'generate_cases', 'generate_script'
])

export function getToolSchemas(): LLMToolDefinition[] {
  return TOOL_SCHEMAS.filter(schema => {
    if (!SKILL_BASED_TOOLS.has(schema.function.name)) return true
    const skillName = SKILL_TOOL_MAP[schema.function.name]
    return skillName ? skillRegistry.isSkillEnabled(skillName) : true
  })
}

export function isAutoApproval(toolName: string): boolean {
  return !MANUAL_APPROVAL_TOOLS.has(toolName)
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<string> {
  const startTime = Date.now()
  try {
    let result: string

    switch (name) {
      case 'analyze_requirement':
      case 'design_test':
      case 'generate_cases':
      case 'generate_script': {
        const skillName = SKILL_TOOL_MAP[name]
        const stepType = SKILL_STEP_TYPE_MAP[name]
        const skillResult = await skillEngine.execute(skillName, {
          projectId: context.projectId,
          inputData: args
        })
        if (skillResult.success) {
          testFlowPipelineService.updateStepStatus(context.projectId, stepType, StepStatus.COMPLETED)
          result = skillResult.output ? JSON.stringify(skillResult.output, null, 2) : ''
        } else {
          testFlowPipelineService.updateStepStatus(context.projectId, stepType, StepStatus.FAILED, skillResult.error)
          result = `Skill execution failed: ${skillResult.error}`
        }
        break
      }

      case 'search_knowledge': {
        if (!context.knowledgeBaseId) {
          result = 'Error: No knowledge base configured for this session'
          break
        }
        const query = args.query as string
        const topK = (args.top_k as number) || 5
        const searchResults = knowledgeService.search(context.knowledgeBaseId, query, topK)
        result = JSON.stringify(searchResults)
        break
      }

      case 'read_file': {
        const filePath = args.file_path as string
        const projectDir = fileOperationService.getProjectDir(context.projectId)
        const fullPath = join(projectDir, filePath)
        const content = fileOperationRepo.readTextFile(fullPath)
        result = content
        break
      }

      case 'list_files': {
        const directory = (args.directory as string) || ''
        const projectDir = fileOperationService.getProjectDir(context.projectId)
        const targetDir = directory ? join(projectDir, directory) : projectDir
        const files = fileOperationRepo.listFiles(targetDir)
        result = JSON.stringify(files)
        break
      }

      case 'get_pipeline_status': {
        const state = testFlowPipelineService.getPipelineState(context.projectId)
        result = JSON.stringify(state)
        break
      }

      case 'review_artifact': {
        const stepType = args.step_type as string
        const reviewResult = args.result as 'approved' | 'rejected'
        const comment = args.comment as string | undefined
        const state = testFlowPipelineService.getPipelineState(context.projectId)
        const targetStep = state.steps.find(s => s.type === stepType)
        if (!targetStep) {
          result = `Error: Step ${stepType} not found in pipeline`
          break
        }
        const activity = flowActivityRepo.getByType(context.projectId, stepType as PipelineStepType)
        if (activity) {
          testFlowPipelineService.reviewStep(
            activity.id,
            reviewResult,
            '',
            comment,
            'chat_agent'
          )
          result = JSON.stringify({ stepType, reviewResult, comment, status: 'review_submitted' })
        } else {
          result = JSON.stringify({ stepType, reviewResult, comment, status: 'review_submitted_no_activity' })
        }
        break
      }

      default:
        result = `Unknown tool: ${name}`
    }

    const durationMs = Date.now() - startTime
    logger.info(`Tool executed: ${name}, duration: ${durationMs}ms`)

    return trimToolResult(result)
  } catch (error: any) {
    logger.error(`Tool execution failed: ${name}`, error)
    throw error
  }
}

function trimToolResult(result: string): string {
  const MAX_LENGTH = 2000
  if (result.length > MAX_LENGTH) {
    return result.substring(0, MAX_LENGTH) + `[结果已裁剪，完整结果共 ${result.length} 字符]`
  }
  return result
}
