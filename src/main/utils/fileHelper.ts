import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { logger } from './logger'

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export function getKnowledgeBaseDir(projectId: string): string {
  const baseDir = join(app.getPath('userData'), 'knowledge-bases', projectId)
  ensureDir(baseDir)
  return baseDir
}

export function getDocumentDir(projectId: string, kbId: string): string {
  const docDir = join(getKnowledgeBaseDir(projectId), kbId, 'documents')
  ensureDir(docDir)
  return docDir
}

export function writeFile(filePath: string, data: Buffer | string): void {
  ensureDir(join(filePath, '..'))
  fs.writeFileSync(filePath, data)
}

export function readFile(filePath: string): Buffer {
  return fs.readFileSync(filePath)
}

export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export function deleteDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
}

export function listFiles(dirPath: string, extension?: string): string[] {
  if (!fs.existsSync(dirPath)) return []
  const files = fs.readdirSync(dirPath)
  if (extension) {
    return files.filter(f => f.endsWith(extension)).map(f => join(dirPath, f))
  }
  return files.map(f => join(dirPath, f))
}

export function getFileSize(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0
  return fs.statSync(filePath).size
}

export function validateFileUpload(fileName: string, fileSize: number): { valid: boolean; error?: string } {
  const forbiddenExtensions = ['.exe', '.bat', '.cmd', '.sh', '.dll', '.so', '.app']
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  if (forbiddenExtensions.includes(ext)) {
    return { valid: false, error: '禁止上传可执行文件' }
  }
  const maxSize = 50 * 1024 * 1024
  if (fileSize > maxSize) {
    return { valid: false, error: '文件大小不能超过50MB' }
  }
  return { valid: true }
}
