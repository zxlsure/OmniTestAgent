// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { formatDate, formatFileSize, formatNumber, formatDuration } from '../../../src/renderer/utils/formatter'

describe('formatDate', () => {
  it('格式化 Date 对象', () => {
    const result = formatDate(new Date('2025-01-15T10:30:00'))
    expect(result).toContain('2025')
    expect(result).toContain('01')
    expect(result).toContain('15')
  })

  it('格式化字符串', () => {
    const result = formatDate('2025-06-01T08:00:00')
    expect(result).toContain('2025')
  })
})

describe('formatFileSize', () => {
  it('字节', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })

  it('MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
  })

  it('0 字节', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })
})

describe('formatNumber', () => {
  it('千分位分隔', () => {
    expect(formatNumber(12345)).toBe('12,345')
  })

  it('小数字不加分隔', () => {
    expect(formatNumber(100)).toBe('100')
  })
})

describe('formatDuration', () => {
  it('毫秒', () => {
    expect(formatDuration(500)).toBe('500ms')
  })

  it('秒', () => {
    expect(formatDuration(2500)).toBe('2.5s')
  })

  it('分钟 + 秒', () => {
    expect(formatDuration(90000)).toBe('1m 30s')
  })

  it('0 毫秒', () => {
    expect(formatDuration(0)).toBe('0ms')
  })
})
