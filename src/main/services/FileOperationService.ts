import { dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import { fileOperationRepo } from '../data/repositories/FileOperationRepo'
import { pipelineStatusRepo } from '../data/repositories/PipelineStatusRepo'
import {
  PROJECT_DIRS, STEP_META_MAP, PipelineStepType,
  type FileInfo
} from '../data/types/pipeline'
import { validateFileUpload } from '../utils/fileHelper'

export class FileOperationService {
  initProjectDirs(projectId: string): void {
    const baseDir = fileOperationRepo.getTestDesignDir(projectId)
    for (const dirName of PROJECT_DIRS) {
      fileOperationRepo.ensureDir(join(baseDir, dirName))
    }
    if (!pipelineStatusRepo.exists(projectId)) {
      pipelineStatusRepo.init(projectId)
    }
  }

  ensureProjectDirs(projectId: string): void {
    const baseDir = fileOperationRepo.getTestDesignDir(projectId)
    for (const dirName of PROJECT_DIRS) {
      const dirPath = join(baseDir, dirName)
      if (!fileOperationRepo.exists(dirPath)) {
        fileOperationRepo.ensureDir(dirPath)
      }
    }
    if (!pipelineStatusRepo.exists(projectId)) {
      pipelineStatusRepo.init(projectId)
    }
  }

  getProjectDir(projectId: string): string {
    return fileOperationRepo.getTestDesignDir(projectId)
  }

  async uploadFiles(projectId: string, targetDir: string, filePaths: string[]): Promise<FileInfo[]> {
    const destDir = join(fileOperationRepo.getTestDesignDir(projectId), targetDir)
    fileOperationRepo.ensureDir(destDir)
    const results: FileInfo[] = []
    for (const srcPath of filePaths) {
      const fileName = srcPath.split(/[\\/]/).pop()!
      const fileSize = fileOperationRepo.exists(srcPath)
        ? (await import('fs')).statSync(srcPath).size
        : 0
      const validation = validateFileUpload(fileName, fileSize)
      if (!validation.valid) {
        throw new Error(validation.error || `文件 ${fileName} 校验失败`)
      }
      const fileInfo = fileOperationRepo.copyFile(srcPath, destDir)
      results.push(fileInfo)
    }
    return results
  }

  listFiles(projectId: string, dirName: string): FileInfo[] {
    const dirPath = join(fileOperationRepo.getTestDesignDir(projectId), dirName)
    return fileOperationRepo.listFiles(dirPath)
  }

  readFileContent(
    projectId: string,
    dirName: string,
    fileName: string
  ): { content: string; fileType: 'markdown' | 'code' | 'binary' | 'text' } {
    const filePath = join(fileOperationRepo.getTestDesignDir(projectId), dirName, fileName)
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
    const markdownExts = ['.md', '.markdown']
    const codeExts = ['.ts', '.js', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.sh', '.bat', '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.vue']

    if (markdownExts.includes(ext)) {
      return { content: fileOperationRepo.readTextFile(filePath), fileType: 'markdown' }
    }
    if (codeExts.includes(ext)) {
      return { content: fileOperationRepo.readTextFile(filePath), fileType: 'code' }
    }
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.docx', '.xlsx']
    if (binaryExts.includes(ext)) {
      return { content: `[二进制文件: ${fileName}]`, fileType: 'binary' }
    }
    try {
      return { content: fileOperationRepo.readTextFile(filePath), fileType: 'text' }
    } catch {
      return { content: `[无法读取文件: ${fileName}]`, fileType: 'binary' }
    }
  }

  writeFile(projectId: string, dirName: string, fileName: string, content: string): void {
    const filePath = join(fileOperationRepo.getTestDesignDir(projectId), dirName, fileName)
    fileOperationRepo.writeTextFile(filePath, content)
  }

  hasFiles(projectId: string, dirName: string): boolean {
    const dirPath = join(fileOperationRepo.getTestDesignDir(projectId), dirName)
    return fileOperationRepo.hasFiles(dirPath)
  }

  async showOpenDialog(options: Electron.OpenDialogOptions): Promise<string[] | undefined> {
    const win = BrowserWindow.getFocusedWindow()
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? undefined : result.filePaths
  }
}

export const fileOperationService = new FileOperationService()
