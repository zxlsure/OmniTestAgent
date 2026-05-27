// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockList = vi.fn()
const mockDelete = vi.fn()

beforeEach(() => {
  vi.stubGlobal('window', {
    electronAPI: {
      project: {
        list: mockList,
        delete: mockDelete,
      }
    }
  })
})

import { useProjectStore } from '../../../src/renderer/store/useProjectStore'

describe('useProjectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockList.mockReset()
    mockDelete.mockReset()
  })

  it('fetchProjects 正确更新 projects', async () => {
    const fakeProjects = [
      { id: '1', name: 'Project A', description: null, created_at: '', updated_at: '' },
      { id: '2', name: 'Project B', description: null, created_at: '', updated_at: '' },
    ]
    mockList.mockResolvedValue(fakeProjects)

    const store = useProjectStore()
    await store.fetchProjects()
    expect(store.projects).toEqual(fakeProjects)
  })

  it('fetchProjects 在 IPC 失败时保持列表为空', async () => {
    mockList.mockRejectedValue(new Error('IPC error'))

    const store = useProjectStore()
    await store.fetchProjects()
    expect(store.projects).toEqual([])
  })

  it('deleteProject 在 IPC 失败时保持列表不变', async () => {
    mockList.mockResolvedValue([
      { id: '1', name: 'Project A', description: null, created_at: '', updated_at: '' },
    ])
    mockDelete.mockRejectedValue(new Error('IPC error'))

    const store = useProjectStore()
    await store.fetchProjects()
    expect(store.projects).toHaveLength(1)

    await store.deleteProject('1')
    expect(store.projects).toHaveLength(1)
  })

  it('deleteProject 成功时从列表移除', async () => {
    mockList.mockResolvedValue([
      { id: '1', name: 'Project A', description: null, created_at: '', updated_at: '' },
      { id: '2', name: 'Project B', description: null, created_at: '', updated_at: '' },
    ])
    mockDelete.mockResolvedValue(undefined)

    const store = useProjectStore()
    await store.fetchProjects()
    await store.deleteProject('1')
    expect(store.projects).toHaveLength(1)
    expect(store.projects[0].id).toBe('2')
  })
})
