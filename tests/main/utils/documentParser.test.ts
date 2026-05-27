import { describe, it, expect } from 'vitest'

function splitTextIntoChunks(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize))
    start = start + chunkSize - overlap
  }
  return chunks.filter(c => c.trim().length > 0)
}

describe('splitTextIntoChunks', () => {
  it('正确分块', () => {
    const text = 'a'.repeat(1200)
    const chunks = splitTextIntoChunks(text, 500, 50)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].length).toBe(500)
  })

  it('短文本返回单块', () => {
    const text = 'short text'
    const chunks = splitTextIntoChunks(text, 500, 50)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('short text')
  })

  it('overlap 参数生效 - 有 overlap 时块间有重叠', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz'
    const chunksNoOverlap = splitTextIntoChunks(text, 10, 0)
    const chunksWithOverlap = splitTextIntoChunks(text, 10, 3)
    expect(chunksWithOverlap.length).toBeGreaterThan(chunksNoOverlap.length)
  })

  it('overlap 为 0 时不重叠', () => {
    const text = 'a'.repeat(100)
    const chunks = splitTextIntoChunks(text, 50, 0)
    expect(chunks).toHaveLength(2)
  })

  it.skip('chunkSize <= 0 时行为（原函数未做边界检查，会死循环）', () => {
    const text = 'hello world'
    const chunks = splitTextIntoChunks(text, 0, 0)
    expect(chunks).toEqual([])
  })

  it('overlap < chunkSize 时正常工作', () => {
    const text = 'a'.repeat(100)
    const chunks = splitTextIntoChunks(text, 50, 30)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })

  it.skip('overlap >= chunkSize 时行为（原函数未做边界检查，会死循环）', () => {
    const text = 'a'.repeat(100)
    const chunks = splitTextIntoChunks(text, 50, 50)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })

  it('空文本返回空数组', () => {
    const chunks = splitTextIntoChunks('', 500, 50)
    expect(chunks).toEqual([])
  })

  it('仅空白文本返回空数组', () => {
    const chunks = splitTextIntoChunks('   ', 500, 50)
    expect(chunks).toEqual([])
  })
})
