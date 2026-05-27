import { join } from 'path'
import { knowledgeService } from '../KnowledgeService'
import { skillRegistry, ISkill } from '../SkillRegistry'
import { projectRepo } from '../../data/repositories/ProjectRepo'
import { fileOperationRepo } from '../../data/repositories/FileOperationRepo'
import { llmConfigRepo } from '../../data/repositories/LlmConfigRepo'
import { logger } from '../../utils/logger'
import { STEP_META_MAP, type FlowPipelineState } from '../../data/types/pipeline'
import type { LLMToolDefinition } from '../../data/types/chatAgent'
import { getToolSchemas } from './toolRegistry'

export interface PromptContext {
  projectId?: string
  knowledgeBaseId?: string
  userMessage: string
  pipelineState?: FlowPipelineState
  enabledSkills: ISkill[]
}

export async function buildSystemPrompt(context: PromptContext): Promise<string> {
  const layers: string[] = []

  layers.push(buildRoleLayer())
  layers.push(await buildKnowledgeLayer(context))
  layers.push(await buildProjectLayer(context))
  layers.push(buildToolLayer())
  layers.push(buildBehaviorLayer())
  layers.push(buildThinkingProtocolLayer())
  layers.push(buildPipelineLayer(context))
  layers.push(buildSkillLayer(context))

  const prompt = layers.filter(l => l.length > 0).join('\n\n')

  const maxTokens = getMaxContextTokens()
  const estimatedTokens = Math.ceil(prompt.length / 4)
  if (estimatedTokens > maxTokens * 0.3) {
    return trimPrompt(layers, maxTokens)
  }

  return prompt
}

function getMaxContextTokens(): number {
  const config = llmConfigRepo.getActive()
  return config?.max_tokens ?? 4096
}

function buildRoleLayer(): string {
  return `<role>
You are OmniTestAgent, an intelligent testing expert with deep expertise in software testing methodology and practice.

## Core Competencies
- Test strategy design and optimization
- Test case design using: Equivalence Partitioning, Boundary Value Analysis, Orthogonal Experimental Design, Decision Table/Cause-Effect Graph, Scenario Method, Error Guessing
- Requirements analysis and testability assessment
- Defect root cause analysis and prevention
- Test automation and script generation
- Test pipeline orchestration and management

## Behavioral Guidelines
- Always reason step-by-step before providing answers
- Provide concrete, actionable recommendations
- Reference relevant testing theories when making decisions
- Proactively identify potential risks and edge cases
- Validate assumptions against available evidence
</role>`
}

async function buildKnowledgeLayer(context: PromptContext): Promise<string> {
  if (!context.knowledgeBaseId) return ''
  try {
    const results = await knowledgeService.search(context.knowledgeBaseId, context.userMessage, 5)
    if (!results.length) return ''
    const fragments = results.map((r: any) =>
      `### Source: ${r.source} (Relevance: ${r.score})\n${r.content}\n---`
    ).join('\n')
    return `<knowledge>\n## Retrieved Knowledge Fragments\n${fragments}\n</knowledge>`
  } catch (error: unknown) {
    logger.warn('Knowledge retrieval failed in prompt building:', error instanceof Error ? error.message : String(error))
    return ''
  }
}

async function buildProjectLayer(context: PromptContext): Promise<string> {
  if (!context.projectId) return ''
  const project = projectRepo.getById(context.projectId)
  if (!project) return ''

  let reqDocs = ''
  let specDocs = ''
  try {
    const projectDir = fileOperationRepo.getTestDesignDir(context.projectId)
    const reqFiles = fileOperationRepo.listFiles(join(projectDir, '01_requirement'))
    const specFiles = fileOperationRepo.listFiles(join(projectDir, '02_spec'))
    reqDocs = reqFiles.filter((f: any) => !f.isDirectory).map((f: any) => `- ${f.name} (${f.size} bytes)`).join('\n')
    specDocs = specFiles.filter((f: any) => !f.isDirectory).map((f: any) => `- ${f.name}`).join('\n')
  } catch (e: unknown) {
    logger.warn('Failed to list project files:', e instanceof Error ? e.message : String(e))
    reqDocs = ''
    specDocs = ''
  }

  return `<project>
## Project Information
- Name: ${project.name}
- Description: ${project.description || 'N/A'}

## Requirement Documents
${reqDocs || '(none)'}

## Spec Files
${specDocs || '(none)'}
</project>`
}

function buildToolLayer(): string {
  const schemas = getToolSchemas()
  const toolDescriptions = schemas.map(s => {
    const fn = s.function
    return `### ${fn.name}\n${fn.description}\nParameters: ${JSON.stringify(fn.parameters)}`
  }).join('\n\n')

  return `<tools>
## Available Tools
You have access to the following tools. Use them when the user's request matches a tool's capability.

${toolDescriptions}

## Tool Usage Guidelines
- Call only one tool at a time
- Wait for tool results before proceeding
- Summarize tool results for the user in plain language
- If a tool fails, explain the error and suggest alternatives
</tools>`
}

function buildBehaviorLayer(): string {
  return `<behavior>
## Output Format
- Use Markdown formatting for all responses
- Use code blocks with language tags for code snippets
- Use tables for structured comparisons
- Use numbered lists for step-by-step procedures

## Interaction Norms
- Confirm understanding before taking action on ambiguous requests
- Report progress for long-running operations
- Ask for clarification rather than making assumptions
- Provide confidence levels when uncertain (high/medium/low)
</behavior>`
}

function buildThinkingProtocolLayer(): string {
  return `<thinking_protocol>
## Thinking Process Display
When solving complex problems, show your reasoning process:
1. **Understand**: Restate the problem and identify key constraints
2. **Analyze**: Break down the problem and consider approaches
3. **Decide**: Select the best approach with justification
4. **Execute**: Implement the chosen approach step by step
5. **Validate**: Check results against requirements

Use <thinking> tags for internal reasoning that users can optionally view.
</thinking_protocol>`
}

function buildPipelineLayer(context: PromptContext): string {
  if (!context.projectId || !context.pipelineState) return ''
  const state = context.pipelineState
  const steps = state.steps.map(s => {
    const meta = STEP_META_MAP[s.type as keyof typeof STEP_META_MAP]
    const label = meta?.label || s.type
    return `- ${label}: ${s.status}${s.errorMessage ? ` (Error: ${s.errorMessage})` : ''}`
  }).join('\n')

  return `<pipeline>
## Test Pipeline Status
${steps}

Overall Progress: ${state.overallProgress}%
</pipeline>`
}

function buildSkillLayer(context: PromptContext): string {
  if (!context.enabledSkills.length) return ''
  const skillList = context.enabledSkills.map(s => `- **${s.displayName}**: ${s.description}`).join('\n')
  return `<skills>\n## Enabled Skills\n${skillList}\n</skills>`
}

function trimPrompt(layers: string[], maxTokens: number): string {
  const requiredIndices = [0, 3]
  const result: string[] = []
  const budget = maxTokens * 0.3

  for (let i = 0; i < layers.length; i++) {
    if (!layers[i]) continue
    if (requiredIndices.includes(i)) {
      result.push(layers[i])
      continue
    }
    const currentLength = result.join('\n\n').length
    const estimated = Math.ceil((currentLength + layers[i].length) / 4)
    if (estimated < budget * 0.9) {
      result.push(layers[i])
    }
  }

  return result.join('\n\n')
}
