import type { Project } from './project'
import type { KnowledgeBase, KnowledgeDocument, SearchResult } from './knowledge'
import type { McpConfig, McpTool } from './mcp'
import type { SkillRecord } from './skill'
import type { ChannelConfig } from './channel'
import type { LlmConfig } from './llm'
import type { FlowActivity } from './testflow'
import type {
  FlowPipelineState, PipelineStepType, StepStatus, FileInfo, ReviewRecord, PipelineProgressEvent
} from './testflow-pipeline'
import type {
  ChatSession, ChatMessage, AgentEvent
} from './chatAgent'

interface ProjectStats {
  projectCount: number
  kbCount: number
  caseCount: number
  executionCount: number
}

interface LlmChatMessage {
  role: string
  content: string
}

interface LlmChatParams {
  messages: LlmChatMessage[]
  model?: string
}

interface LlmConnectionResult {
  success: boolean
  error?: string
}

interface LlmConfigInput {
  apiKey: string
  baseUrl: string
  model: string
}

declare global {
  interface Window {
    electronAPI: {
      project: {
        list: () => Promise<Project[]>
        create: (data: { name: string; description?: string; directory?: string }) => Promise<Project>
        update: (data: { id: string; name?: string; description?: string; directory?: string }) => Promise<Project>
        delete: (id: string) => Promise<boolean>
        switch: (id: string) => Promise<Project | null>
        getStats: (id: string) => Promise<ProjectStats>
      }
      llm: {
        chat: (params: LlmChatParams) => Promise<string>
        streamChat: (params: LlmChatParams) => Promise<void>
        onStreamChunk: (callback: (event: unknown, chunk: string) => void) => void
        onStreamEnd: (callback: (event: unknown) => void) => void
        removeStreamListeners: () => void
        testConnection: (config: LlmConfigInput) => Promise<LlmConnectionResult>
        getConfig: () => Promise<LlmConfig | null>
        saveConfig: (config: LlmConfigInput) => Promise<void>
      }
      knowledge: {
        listBases: (projectId: string) => Promise<KnowledgeBase[]>
        createBase: (data: { projectId: string; name: string; description?: string }) => Promise<KnowledgeBase>
        deleteBase: (id: string) => Promise<boolean>
        uploadDoc: (params: { kbId: string; projectId: string; filePath: string; fileName: string }) => Promise<KnowledgeDocument>
        vectorize: (docId: string) => Promise<void>
        search: (params: { kbId: string; query: string; topK?: number }) => Promise<SearchResult[]>
        listDocuments: (kbId: string) => Promise<KnowledgeDocument[]>
      }
      mcp: {
        callTool: (params: { toolName: string; params: unknown }) => Promise<unknown>
        testConnection: (config: Partial<McpConfig>) => Promise<LlmConnectionResult>
        listTools: () => Promise<McpTool[]>
        getConfig: () => Promise<McpConfig | null>
        saveConfig: (config: { name: string; transportType: string; url?: string; command?: string; args?: string }) => Promise<void>
      }
      skill: {
        list: () => Promise<SkillRecord[]>
        toggle: (id: string, enabled: boolean) => Promise<boolean>
        import: (data: unknown) => Promise<unknown>
        execute: (params: { skillName: string; context: unknown }) => Promise<unknown>
      }
      channel: {
        configure: (data: { type: string; config: ChannelConfig; isEnabled: boolean }) => Promise<void>
        test: (type: string) => Promise<LlmConnectionResult>
        send: (params: { type: string; message: string }) => Promise<unknown>
        getConfig: (type: string) => Promise<ChannelConfig | null>
      }
      testflow: {
        execute: (params: { projectId: string; activityType: string }) => Promise<void>
        interrupt: (activityId: string) => Promise<void>
        review: (params: { activityId: string; result: string; comment?: string; reviewer?: string }) => Promise<void>
        getStatus: (projectId: string) => Promise<FlowActivity[]>
        onProgress: (callback: (event: unknown, progress: unknown) => void) => void
        removeProgressListeners: () => void
      }
      store: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<void>
        delete: (key: string) => Promise<void>
      }
      pipeline: {
        getState: (projectId: string) => Promise<FlowPipelineState>
        executeStep: (params: { projectId: string; stepType: PipelineStepType }) => Promise<void>
        interruptStep: (activityId: string) => Promise<void>
        reviewStep: (params: {
          activityId: string; result: 'approved' | 'rejected';
          modifiedContent: string; comment?: string; reviewer?: string
        }) => Promise<void>
        retryStep: (params: { projectId: string; stepType: PipelineStepType }) => Promise<void>
        onProgress: (callback: (event: unknown, progress: PipelineProgressEvent) => void) => void
        removeProgressListeners: () => void
      }
      fileOp: {
        initProjectDirs: (projectId: string) => Promise<void>
        uploadFiles: (params: { projectId: string; targetDir: string; filePaths: string[] }) => Promise<FileInfo[]>
        listFiles: (params: { projectId: string; dirName: string }) => Promise<FileInfo[]>
        readFileContent: (params: { projectId: string; dirName: string; fileName: string }) => Promise<{ content: string; fileType: 'markdown' | 'code' | 'binary' | 'text' }>
        writeFile: (params: { projectId: string; dirName: string; fileName: string; content: string }) => Promise<void>
        hasFiles: (params: { projectId: string; dirName: string }) => Promise<boolean>
        showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<string[] | undefined>
      }
      chat: {
        sendMessage: (params: { sessionId: string; message: string; projectId: string; knowledgeBaseId?: string }) => Promise<void>
        abort: (params: { sessionId: string }) => Promise<void>
        approveToolCall: (params: { sessionId: string; toolCallId: string; approved: boolean }) => Promise<void>
        getSessions: (params?: { projectId?: string }) => Promise<any[]>
        createSession: (params: { projectId: string; title?: string }) => Promise<any>
        deleteSession: (params: { sessionId: string }) => Promise<boolean>
        getMessages: (params: { sessionId: string }) => Promise<any[]>
        onAgentEvent: (callback: (event: unknown, data: { sessionId: string; event: AgentEvent }) => void) => void
        removeAgentListeners: () => void
        onApprovalRequest: (callback: (event: unknown, data: { requestId: string; toolName: string; toolArgs: Record<string, unknown>; sessionId: string }) => void) => void
        removeApprovalListeners: () => void
        approvalResponse: (params: { requestId: string; approved: boolean; reason?: string }) => Promise<void>
      }
    }
  }
}

export {}
