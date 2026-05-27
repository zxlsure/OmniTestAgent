// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { useIpcCall } from '../../../src/renderer/composables/useIpcCall'

describe('useIpcCall', () => {
  it('execute 成功时返回结果', async () => {
    const { execute } = useIpcCall<string>()
    const result = await execute(() => Promise.resolve('ok'))
    expect(result).toBe('ok')
  })

  it('execute 失败时设置 error 并返回 undefined', async () => {
    const { execute, error } = useIpcCall<string>()
    const result = await execute(() => Promise.reject(new Error('fail')))
    expect(result).toBeUndefined()
    expect(error.value).toBe('fail')
  })

  it('loading 状态正确管理 - 成功时', async () => {
    const { execute, loading } = useIpcCall<string>()
    expect(loading.value).toBe(false)
    const promise = execute(() => new Promise(resolve => setTimeout(() => resolve('ok'), 50)))
    expect(loading.value).toBe(true)
    await promise
    expect(loading.value).toBe(false)
  })

  it('loading 状态正确管理 - 失败时', async () => {
    const { execute, loading } = useIpcCall<string>()
    const promise = execute(() => new Promise((_, reject) => setTimeout(() => reject(new Error('err')), 50)))
    expect(loading.value).toBe(true)
    await promise
    expect(loading.value).toBe(false)
  })

  it('error 在成功时重置为 null', async () => {
    const { execute, error } = useIpcCall<string>()
    await execute(() => Promise.reject(new Error('fail')))
    expect(error.value).toBe('fail')
    await execute(() => Promise.resolve('ok'))
    expect(error.value).toBeNull()
  })
})
