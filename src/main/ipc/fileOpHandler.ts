import { registerIpcHandler } from './helpers'
import { fileOperationService } from '../services/FileOperationService'

export function registerFileOpHandler(): void {
  registerIpcHandler('fileOp:initProjectDirs', (projectId: string) =>
    fileOperationService.initProjectDirs(projectId))

  registerIpcHandler('fileOp:uploadFiles',
    (params: { projectId: string; targetDir: string; filePaths: string[] }) =>
      fileOperationService.uploadFiles(params.projectId, params.targetDir, params.filePaths))

  registerIpcHandler('fileOp:listFiles',
    (params: { projectId: string; dirName: string }) =>
      fileOperationService.listFiles(params.projectId, params.dirName))

  registerIpcHandler('fileOp:readFileContent',
    (params: { projectId: string; dirName: string; fileName: string }) =>
      fileOperationService.readFileContent(params.projectId, params.dirName, params.fileName))

  registerIpcHandler('fileOp:writeFile',
    (params: { projectId: string; dirName: string; fileName: string; content: string }) =>
      fileOperationService.writeFile(params.projectId, params.dirName, params.fileName, params.content))

  registerIpcHandler('fileOp:hasFiles',
    (params: { projectId: string; dirName: string }) =>
      fileOperationService.hasFiles(params.projectId, params.dirName))

  registerIpcHandler('fileOp:showOpenDialog',
    (options: Electron.OpenDialogOptions) =>
      fileOperationService.showOpenDialog(options))
}
