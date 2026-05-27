// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../src/main/utils/machineId', () => ({
  getMachineId: () => 'test-machine-id'
}))

import { encrypt, decrypt, maskApiKey } from '../../../src/main/utils/crypto'

describe('crypto', () => {
  describe('encrypt', () => {
    it('返回加密字符串', () => {
      const result = encrypt('hello world')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
      expect(result.split(':').length).toBe(3)
    })
  })

  describe('decrypt', () => {
    it('正确解密', () => {
      const original = 'hello world'
      const encrypted = encrypt(original)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(original)
    })

    it('使用自定义 secret 加解密', () => {
      const secret = 'my-custom-secret'
      const original = 'test data'
      const encrypted = encrypt(original, secret)
      const decrypted = decrypt(encrypted, secret)
      expect(decrypted).toBe(original)
    })

    it('格式无效时抛出异常', () => {
      expect(() => decrypt('invalid')).toThrow('Invalid encrypted text format')
    })
  })

  describe('maskApiKey', () => {
    it('正确遮盖 API Key', () => {
      expect(maskApiKey('sk-1234567890abcdef')).toBe('****cdef')
    })

    it('短 key 返回 ****', () => {
      expect(maskApiKey('abc')).toBe('****')
    })

    it('空字符串返回 ****', () => {
      expect(maskApiKey('')).toBe('****')
    })

    it('长度恰好 4 返回 ****', () => {
      expect(maskApiKey('abcd')).toBe('****')
    })

    it('长度 5 显示最后 4 位', () => {
      expect(maskApiKey('abcde')).toBe('****bcde')
    })
  })
})
