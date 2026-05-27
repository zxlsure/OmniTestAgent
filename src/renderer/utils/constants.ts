export const ACTIVITY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  idle: { label: '未启动', color: '#86909c' },
  running: { label: '执行中', color: '#165dff' },
  completed: { label: '已完成', color: '#00b42a' },
  failed: { label: '失败', color: '#f53f3f' }
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024
export const SUPPORTED_FILE_TYPES = ['.pdf', '.doc', '.docx', '.md', '.txt']
export const FORBIDDEN_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.dll', '.so', '.app']
