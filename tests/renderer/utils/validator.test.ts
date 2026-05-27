// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { validateRequired, validateNameUnique, validateUrl, validateApiKey } from '../../../src/renderer/utils/validator'

describe('validateRequired', () => {
  it('空值返回错误', () => {
    expect(validateRequired('', '名称')).toBe('名称不能为空')
  })

  it('纯空格返回错误', () => {
    expect(validateRequired('   ', '名称')).toBe('名称不能为空')
  })

  it('null/undefined 返回错误', () => {
    expect(validateRequired(null, '字段')).toBe('字段不能为空')
    expect(validateRequired(undefined, '字段')).toBe('字段不能为空')
  })

  it('有效值返回 null', () => {
    expect(validateRequired('hello', '名称')).toBeNull()
  })
})

describe('validateNameUnique', () => {
  it('名称已存在返回错误', () => {
    expect(validateNameUnique('A', ['A', 'B'])).toBe('名称已存在')
  })

  it('名称不存在返回 null', () => {
    expect(validateNameUnique('C', ['A', 'B'])).toBeNull()
  })
})

describe('validateUrl', () => {
  it('有效 URL 返回 null', () => {
    expect(validateUrl('https://example.com')).toBeNull()
  })

  it('无效 URL 返回错误', () => {
    expect(validateUrl('not-a-url')).toBe('URL格式不正确')
  })
})

describe('validateApiKey', () => {
  it('有效 key 返回 null', () => {
    expect(validateApiKey('sk-1234')).toBeNull()
  })

  it('太短返回错误', () => {
    expect(validateApiKey('ab')).toBe('API Key格式不正确')
  })

  it('空 key 返回错误', () => {
    expect(validateApiKey('')).toBe('API Key格式不正确')
  })
})
