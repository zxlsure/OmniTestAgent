export enum PipelineStepType {
  REQUIREMENT_IMPORT = 'requirement_import',
  SPEC_IMPORT = 'spec_import',
  REQUIREMENT_ANALYSIS = 'requirement_analysis',
  REQUIREMENT_REVIEW = 'requirement_review',
  TEST_DESIGN = 'test_design',
  DESIGN_REVIEW = 'design_review',
  CASE_GENERATION = 'case_generation',
  CASE_REVIEW = 'case_review',
  SCRIPT_GENERATION = 'script_generation'
}

export enum StepStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum ReviewResult {
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export const STEP_DEPENDENCIES: Record<PipelineStepType, PipelineStepType[]> = {
  [PipelineStepType.REQUIREMENT_IMPORT]: [],
  [PipelineStepType.SPEC_IMPORT]: [],
  [PipelineStepType.REQUIREMENT_ANALYSIS]: [PipelineStepType.REQUIREMENT_IMPORT],
  [PipelineStepType.REQUIREMENT_REVIEW]: [PipelineStepType.REQUIREMENT_ANALYSIS],
  [PipelineStepType.TEST_DESIGN]: [PipelineStepType.SPEC_IMPORT],
  [PipelineStepType.DESIGN_REVIEW]: [PipelineStepType.TEST_DESIGN],
  [PipelineStepType.CASE_GENERATION]: [PipelineStepType.TEST_DESIGN],
  [PipelineStepType.CASE_REVIEW]: [PipelineStepType.CASE_GENERATION],
  [PipelineStepType.SCRIPT_GENERATION]: [PipelineStepType.CASE_GENERATION]
}

export const REVIEW_TO_STEP_MAP: Record<PipelineStepType, PipelineStepType> = {
  [PipelineStepType.REQUIREMENT_REVIEW]: PipelineStepType.REQUIREMENT_ANALYSIS,
  [PipelineStepType.DESIGN_REVIEW]: PipelineStepType.TEST_DESIGN,
  [PipelineStepType.CASE_REVIEW]: PipelineStepType.CASE_GENERATION
} as Record<PipelineStepType, PipelineStepType>

export const CASCADE_DOWNSTREAM: Record<PipelineStepType, PipelineStepType[]> = {
  [PipelineStepType.REQUIREMENT_IMPORT]: [],
  [PipelineStepType.SPEC_IMPORT]: [],
  [PipelineStepType.REQUIREMENT_ANALYSIS]: [
    PipelineStepType.REQUIREMENT_ANALYSIS,
    PipelineStepType.REQUIREMENT_REVIEW,
    PipelineStepType.TEST_DESIGN,
    PipelineStepType.DESIGN_REVIEW,
    PipelineStepType.CASE_GENERATION,
    PipelineStepType.CASE_REVIEW,
    PipelineStepType.SCRIPT_GENERATION
  ],
  [PipelineStepType.REQUIREMENT_REVIEW]: [],
  [PipelineStepType.TEST_DESIGN]: [
    PipelineStepType.TEST_DESIGN,
    PipelineStepType.DESIGN_REVIEW,
    PipelineStepType.CASE_GENERATION,
    PipelineStepType.CASE_REVIEW,
    PipelineStepType.SCRIPT_GENERATION
  ],
  [PipelineStepType.DESIGN_REVIEW]: [],
  [PipelineStepType.CASE_GENERATION]: [
    PipelineStepType.CASE_GENERATION,
    PipelineStepType.CASE_REVIEW,
    PipelineStepType.SCRIPT_GENERATION
  ],
  [PipelineStepType.CASE_REVIEW]: [],
  [PipelineStepType.SCRIPT_GENERATION]: []
}

export interface StepMeta {
  type: PipelineStepType
  label: string
  description: string
  isReview: boolean
  isImport: boolean
  outputDir: string
  skillName: string | null
  icon: string
}

export const STEP_META_MAP: Record<PipelineStepType, StepMeta> = {
  [PipelineStepType.REQUIREMENT_IMPORT]: {
    type: PipelineStepType.REQUIREMENT_IMPORT,
    label: '需求导入', description: '上传需求文档到项目目录',
    isReview: false, isImport: true, outputDir: '01_requirement',
    skillName: null, icon: 'icon-upload'
  },
  [PipelineStepType.SPEC_IMPORT]: {
    type: PipelineStepType.SPEC_IMPORT,
    label: 'Spec导入', description: '上传特性规格文档到项目目录',
    isReview: false, isImport: true, outputDir: '02_spec',
    skillName: null, icon: 'icon-upload'
  },
  [PipelineStepType.REQUIREMENT_ANALYSIS]: {
    type: PipelineStepType.REQUIREMENT_ANALYSIS,
    label: '测试需求分析', description: '基于需求文档进行测试需求分析',
    isReview: false, isImport: false, outputDir: '03_requirement_analyze',
    skillName: 'requirementParser', icon: 'icon-thunder'
  },
  [PipelineStepType.REQUIREMENT_REVIEW]: {
    type: PipelineStepType.REQUIREMENT_REVIEW,
    label: '需求分析审核', description: '审核测试需求分析结果',
    isReview: true, isImport: false, outputDir: '07_test_review',
    skillName: null, icon: 'icon-check-circle'
  },
  [PipelineStepType.TEST_DESIGN]: {
    type: PipelineStepType.TEST_DESIGN,
    label: '测试设计', description: '基于Spec与需求分析进行测试设计',
    isReview: false, isImport: false, outputDir: '04_test_design',
    skillName: 'testDesigner', icon: 'icon-thunder'
  },
  [PipelineStepType.DESIGN_REVIEW]: {
    type: PipelineStepType.DESIGN_REVIEW,
    label: '设计审核', description: '审核测试设计方案',
    isReview: true, isImport: false, outputDir: '07_test_review',
    skillName: null, icon: 'icon-check-circle'
  },
  [PipelineStepType.CASE_GENERATION]: {
    type: PipelineStepType.CASE_GENERATION,
    label: '测试用例设计', description: '基于测试设计生成测试用例',
    isReview: false, isImport: false, outputDir: '05_test_cases',
    skillName: 'caseGenerator', icon: 'icon-thunder'
  },
  [PipelineStepType.CASE_REVIEW]: {
    type: PipelineStepType.CASE_REVIEW,
    label: '用例审核', description: '审核测试用例设计结果',
    isReview: true, isImport: false, outputDir: '07_test_review',
    skillName: null, icon: 'icon-check-circle'
  },
  [PipelineStepType.SCRIPT_GENERATION]: {
    type: PipelineStepType.SCRIPT_GENERATION,
    label: '测试脚本生成', description: '基于测试用例生成自动化脚本',
    isReview: false, isImport: false, outputDir: '06_test_scripts',
    skillName: 'scriptGenerator', icon: 'icon-thunder'
  }
}

export const PROJECT_DIRS = [
  '01_requirement',
  '02_spec',
  '03_requirement_analyze',
  '04_test_design',
  '05_test_cases',
  '06_test_scripts',
  '07_test_review'
] as const

export const STATUS_FILE_NAME = '.test_design_status.md'

export const DIR_TO_STEP_MAP: Record<string, PipelineStepType> = {
  '01_requirement': PipelineStepType.REQUIREMENT_IMPORT,
  '02_spec': PipelineStepType.SPEC_IMPORT,
  '03_requirement_analyze': PipelineStepType.REQUIREMENT_ANALYSIS,
  '04_test_design': PipelineStepType.TEST_DESIGN,
  '05_test_cases': PipelineStepType.CASE_GENERATION,
  '06_test_scripts': PipelineStepType.SCRIPT_GENERATION
}

export const VALID_TRANSITIONS: Record<StepStatus, StepStatus[]> = {
  [StepStatus.IDLE]: [StepStatus.RUNNING],
  [StepStatus.RUNNING]: [StepStatus.COMPLETED, StepStatus.FAILED, StepStatus.IDLE],
  [StepStatus.COMPLETED]: [],
  [StepStatus.FAILED]: [StepStatus.RUNNING, StepStatus.IDLE]
}

export const STATUS_MARK_MAP: Record<StepStatus, string> = {
  [StepStatus.IDLE]: 'U',
  [StepStatus.RUNNING]: 'running',
  [StepStatus.COMPLETED]: '✓',
  [StepStatus.FAILED]: '✗'
}

export const STATUS_FROM_MARK: Record<string, StepStatus> = {
  'U': StepStatus.IDLE,
  'running': StepStatus.RUNNING,
  '✓': StepStatus.COMPLETED,
  '✗': StepStatus.FAILED
}

export interface PipelineStepState {
  type: PipelineStepType
  status: StepStatus
  updatedAt: string
  retryCount: number
  errorMessage: string | null
  progress: number
  streamingContent: string
}

export interface FlowPipelineState {
  projectId: string
  steps: PipelineStepState[]
  overallProgress: number
  lastUpdatedAt: string
}

export interface FileInfo {
  name: string
  path: string
  size: number
  modifiedAt: string
  isDirectory: boolean
}

export interface ReviewRecord {
  id: string
  activityType: PipelineStepType
  round: number
  result: ReviewResult
  content: string
  comment: string | null
  reviewer: string | null
  reviewedAt: string
}

export interface PipelineProgressEvent {
  activityType: PipelineStepType
  status: StepStatus
  progress: number
  streamingContent?: string
  output?: unknown
  error?: string
}
