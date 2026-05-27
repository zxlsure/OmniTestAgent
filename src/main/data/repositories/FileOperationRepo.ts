import fs from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { ensureDir } from '../../utils/fileHelper'
import type { FileInfo } from '../types/pipeline'

export class FileOperationRepo {
  getTestDesignDir(projectId: string): string {
    return join(app.getPath('userData'), 'projects', projectId, 'test_design')
  }

  ensureDir(dirPath: string): void {
    ensureDir(dirPath)
  }

  listFiles(dirPath: string): FileInfo[] {
    if (!fs.existsSync(dirPath)) return []
    return fs.readdirSync(dirPath).map(name => {
      const fullPath = join(dirPath, name)
      const stat = fs.statSync(fullPath)
      return {
        name,
        path: fullPath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        isDirectory: stat.isDirectory()
      }
    })
  }

  readTextFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8')
  }

  writeTextFile(filePath: string, content: string): void {
    ensureDir(join(filePath, '..'))
    fs.writeFileSync(filePath, content, 'utf-8')
  }

  copyFile(srcPath: string, destDir: string): FileInfo {
    ensureDir(destDir)
    const fileName = srcPath.split(/[\\/]/).pop()!
    const destPath = join(destDir, fileName)
    fs.copyFileSync(srcPath, destPath)
    const stat = fs.statSync(destPath)
    return {
      name: fileName,
      path: destPath,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      isDirectory: false
    }
  }

  hasFiles(dirPath: string): boolean {
    if (!fs.existsSync(dirPath)) return false
    return fs.readdirSync(dirPath).some(name => {
      try { return !fs.statSync(join(dirPath, name)).isDirectory() } catch { return false }
    })
  }

  deleteFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }

  exists(filePath: string): boolean {
    return fs.existsSync(filePath)
  }
}

export const fileOperationRepo = new FileOperationRepo()
