export const FILE_RENDER_STRATEGY: Record<string, 'markdown' | 'code' | 'text'> = {
  md: 'markdown',
  txt: 'text',
  ts: 'code',
  tsx: 'code',
  js: 'code',
  jsx: 'code',
  py: 'code',
  json: 'code',
  yaml: 'code',
  yml: 'code',
  xml: 'code',
  html: 'code',
  css: 'code'
} as const

export const UNSUPPORTED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'gif', 'exe', 'bat'])

export type FileRenderType = 'markdown' | 'code' | 'text' | 'unsupported'

export function getFileRenderType(fileName: string): FileRenderType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (UNSUPPORTED_EXTENSIONS.has(ext)) return 'unsupported'
  return FILE_RENDER_STRATEGY[ext] ?? 'text'
}

export function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const iconMap: Record<string, string> = {
    md: 'icon-file-text',
    txt: 'icon-file-text',
    ts: 'icon-code',
    tsx: 'icon-code',
    js: 'icon-code',
    jsx: 'icon-code',
    py: 'icon-code',
    json: 'icon-code',
    yaml: 'icon-code',
    yml: 'icon-code',
    xml: 'icon-code',
    html: 'icon-code',
    css: 'icon-code',
    pdf: 'icon-file-pdf',
    doc: 'icon-file',
    docx: 'icon-file'
  }
  return iconMap[ext] ?? 'icon-file'
}
