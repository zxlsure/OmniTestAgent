export interface FlowActivity {
  id: string; project_id: string; activity_type: string; status: string
  input_data: string | null; output_data: string | null
  started_at: string | null; completed_at: string | null
  created_at: string; updated_at: string
}

export const ACTIVITY_TYPES = [
  { key: 'requirement_import', label: '需求导入', isReview: false },
  { key: 'requirement_analysis', label: '测试需求分析', isReview: false },
  { key: 'requirement_review', label: '审核', isReview: true },
  { key: 'test_design', label: '测试设计', isReview: false },
  { key: 'design_review', label: '审核', isReview: true },
  { key: 'case_generation', label: '测试用例设计', isReview: false },
  { key: 'case_review', label: '审核', isReview: true },
  { key: 'script_generation', label: '测试脚本生成', isReview: false },
  { key: 'script_debug', label: '测试脚本调试', isReview: false }
] as const
