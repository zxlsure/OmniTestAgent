import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const electronAPI = {
  project: {
    list: () => ipcRenderer.invoke('project:list'),
    create: (data: any) => ipcRenderer.invoke('project:create', data),
    update: (data: any) => ipcRenderer.invoke('project:update', data),
    delete: (id: string) => ipcRenderer.invoke('project:delete', id),
    switch: (id: string) => ipcRenderer.invoke('project:switch', id),
    getStats: (id: string) => ipcRenderer.invoke('project:getStats', id)
  },
  llm: {
    chat: (params: any) => ipcRenderer.invoke('llm:chat', params),
    streamChat: (params: any) => ipcRenderer.invoke('llm:streamChat', params),
    onStreamChunk: (callback: (event: IpcRendererEvent, chunk: any) => void) =>
      ipcRenderer.on('llm:streamChunk', callback),
    onStreamEnd: (callback: (event: IpcRendererEvent) => void) =>
      ipcRenderer.on('llm:streamEnd', callback),
    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('llm:streamChunk')
      ipcRenderer.removeAllListeners('llm:streamEnd')
    },
    testConnection: (config: any) => ipcRenderer.invoke('llm:testConnection', config),
    getConfig: () => ipcRenderer.invoke('llm:getConfig'),
    saveConfig: (config: any) => ipcRenderer.invoke('llm:saveConfig', config)
  },
  knowledge: {
    listBases: (projectId: string) => ipcRenderer.invoke('knowledge:listBases', projectId),
    createBase: (data: any) => ipcRenderer.invoke('knowledge:createBase', data),
    deleteBase: (id: string) => ipcRenderer.invoke('knowledge:deleteBase', id),
    uploadDoc: (params: any) => ipcRenderer.invoke('knowledge:uploadDoc', params),
    vectorize: (docId: string) => ipcRenderer.invoke('knowledge:vectorize', docId),
    search: (params: any) => ipcRenderer.invoke('knowledge:search', params),
    listDocuments: (kbId: string) => ipcRenderer.invoke('knowledge:listDocuments', kbId)
  },
  mcp: {
    callTool: (params: any) => ipcRenderer.invoke('mcp:callTool', params),
    testConnection: (config: any) => ipcRenderer.invoke('mcp:testConnection', config),
    listTools: () => ipcRenderer.invoke('mcp:listTools'),
    getConfig: () => ipcRenderer.invoke('mcp:getConfig'),
    saveConfig: (config: any) => ipcRenderer.invoke('mcp:saveConfig', config)
  },
  skill: {
    list: () => ipcRenderer.invoke('skill:list'),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('skill:toggle', id, enabled),
    import: (data: any) => ipcRenderer.invoke('skill:import', data),
    execute: (params: any) => ipcRenderer.invoke('skill:execute', params)
  },
  channel: {
    configure: (data: any) => ipcRenderer.invoke('channel:configure', data),
    test: (type: string) => ipcRenderer.invoke('channel:test', type),
    send: (params: any) => ipcRenderer.invoke('channel:send', params),
    getConfig: (type: string) => ipcRenderer.invoke('channel:getConfig', type)
  },
  testflow: {
    execute: (params: any) => ipcRenderer.invoke('testflow:execute', params),
    interrupt: (activityId: string) => ipcRenderer.invoke('testflow:interrupt', activityId),
    review: (params: any) => ipcRenderer.invoke('testflow:review', params),
    getStatus: (projectId: string) => ipcRenderer.invoke('testflow:getStatus', projectId),
    onProgress: (callback: (event: IpcRendererEvent, progress: any) => void) =>
      ipcRenderer.on('testflow:progress', callback),
    removeProgressListeners: () => ipcRenderer.removeAllListeners('testflow:progress')
  },
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
