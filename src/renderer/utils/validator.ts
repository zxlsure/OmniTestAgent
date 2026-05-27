export function validateRequired(value: any, label: string): string | null {
  if (!value || (typeof value === 'string' && !value.trim())) return `${label}不能为空`
  return null
}

export function validateNameUnique(name: string, existingNames: string[]): string | null {
  if (existingNames.includes(name)) return '名称已存在'
  return null
}

export function validateUrl(url: string): string | null {
  try { new URL(url); return null } catch { return 'URL格式不正确' }
}

export function validateApiKey(key: string): string | null {
  if (!key || key.length < 4) return 'API Key格式不正确'
  return null
}
