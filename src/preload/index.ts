const { contextBridge, ipcRenderer } = require('electron')

const electronAPI = {
  project: {
    list: () => ipcRenderer.invoke('project:list'),
    create: (data: { name: string; description?: string }) => ipcRenderer.invoke('project:create', data),
    update: (data: { id: string; name?: string; description?: string; directory?: string }) => ipcRenderer.invoke('project:update', data),
    delete: (id: string) => ipcRenderer.invoke('project:delete', id),
    switch: (id: string) => ipcRenderer.invoke('project:switch', id),
    getStats: (id: string) => ipcRenderer.invoke('project:getStats', id)
  },
  llm: {
    chat: (params: any) => ipcRenderer.invoke('llm:chat', params),
    streamChat: (params: any) => ipcRenderer.invoke('llm:streamChat', params),
    onStreamChunk: (callback: (event: any, chunk: any) => void) =>
      ipcRenderer.on('llm:streamChunk', callback),
    onStreamEnd: (callback: (event: any) => void) =>
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
    onProgress: (callback: (event: any, progress: any) => void) =>
      ipcRenderer.on('testflow:progress', callback),
    removeProgressListeners: () => ipcRenderer.removeAllListeners('testflow:progress')
  },
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key)
  },
  pipeline: {
    getState: (projectId: string) =>
      ipcRenderer.invoke('pipeline:getState', projectId),
    executeStep: (params: { projectId: string; stepType: string }) =>
      ipcRenderer.invoke('pipeline:executeStep', params),
    interruptStep: (activityId: string) =>
      ipcRenderer.invoke('pipeline:interruptStep', activityId),
    reviewStep: (params: {
      activityId: string; result: string;
      modifiedContent: string; comment?: string; reviewer?: string
    }) => ipcRenderer.invoke('pipeline:reviewStep', params),
    retryStep: (params: { projectId: string; stepType: string }) =>
      ipcRenderer.invoke('pipeline:retryStep', params),
    onProgress: (callback: (event: any, progress: any) => void) =>
      ipcRenderer.on('pipeline:progress', callback),
    removeProgressListeners: () =>
      ipcRenderer.removeAllListeners('pipeline:progress')
  },
  fileOp: {
    initProjectDirs: (projectId: string) =>
      ipcRenderer.invoke('fileOp:initProjectDirs', projectId),
    uploadFiles: (params: { projectId: string; targetDir: string; filePaths: string[] }) =>
      ipcRenderer.invoke('fileOp:uploadFiles', params),
    listFiles: (params: { projectId: string; dirName: string }) =>
      ipcRenderer.invoke('fileOp:listFiles', params),
    readFileContent: (params: { projectId: string; dirName: string; fileName: string }) =>
      ipcRenderer.invoke('fileOp:readFileContent', params),
    writeFile: (params: { projectId: string; dirName: string; fileName: string; content: string }) =>
      ipcRenderer.invoke('fileOp:writeFile', params),
    hasFiles: (params: { projectId: string; dirName: string }) =>
      ipcRenderer.invoke('fileOp:hasFiles', params),
    showOpenDialog: (options: any) =>
      ipcRenderer.invoke('fileOp:showOpenDialog', options)
  },
  chat: {
    sendMessage: (params: any) => ipcRenderer.invoke('chat:sendMessage', params),
    abort: (params: any) => ipcRenderer.invoke('chat:abort', params),
    approveToolCall: (params: any) => ipcRenderer.invoke('chat:approveToolCall', params),
    getSessions: (params?: any) => ipcRenderer.invoke('chat:getSessions', params),
    createSession: (params: any) => ipcRenderer.invoke('chat:createSession', params),
    deleteSession: (params: any) => ipcRenderer.invoke('chat:deleteSession', params),
    getMessages: (params: any) => ipcRenderer.invoke('chat:getMessages', params),
    onAgentEvent: (callback: (event: any, data: any) => void) =>
      ipcRenderer.on('chat:agentEvent', callback),
    removeAgentListeners: () =>
      ipcRenderer.removeAllListeners('chat:agentEvent'),
    onApprovalRequest: (callback: (event: any, data: any) => void) =>
      ipcRenderer.on('chatAgent:approvalRequest', callback),
    removeApprovalListeners: () =>
      ipcRenderer.removeAllListeners('chatAgent:approvalRequest'),
    approvalResponse: (params: any) =>
      ipcRenderer.invoke('chatAgent:approvalResponse', params)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
