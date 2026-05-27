import fs from 'fs'
import { logger } from './logger'

export interface ParsedDocument {
  text: string
  metadata: {
    fileName: string
    fileType: string
    pageCount?: number
    charCount: number
  }
}

export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  const sep = filePath.includes('/') ? '/' : '\\'
  const fileName = filePath.slice(filePath.lastIndexOf(sep) + 1)

  switch (ext) {
    case '.txt':
    case '.md':
      return parseText(filePath, fileName, ext.slice(1))
    case '.pdf':
      return parsePdf(filePath, fileName)
    case '.doc':
    case '.docx':
      return parseWord(filePath, fileName)
    default:
      throw new Error('Unsupported file type: ' + ext)
  }
}

function parseText(filePath: string, fileName: string, fileType: string): ParsedDocument {
  const text = fs.readFileSync(filePath, 'utf-8')
  return { text, metadata: { fileName, fileType, charCount: text.length } }
}

async function parsePdf(filePath: string, fileName: string): Promise<ParsedDocument> {
  try {
    const pdfParse = require('pdf-parse')
    const dataBuffer = fs.readFileSync(filePath)
    const data = await pdfParse(dataBuffer)
    return {
      text: data.text,
      metadata: { fileName, fileType: 'pdf', pageCount: data.numpages, charCount: data.text.length }
    }
  } catch (error: any) {
    throw new Error('PDF解析失败，请安装pdf-parse: npm install pdf-parse. ' + (error.message || ''))
  }
}

async function parseWord(filePath: string, fileName: string): Promise<ParsedDocument> {
  try {
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ path: filePath })
    return {
      text: result.value,
      metadata: { fileName, fileType: 'docx', charCount: result.value.length }
    }
  } catch (error: any) {
    throw new Error('Word解析失败，请安装mammoth: npm install mammoth. ' + (error.message || ''))
  }
}

export function splitTextIntoChunks(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize))
    start = start + chunkSize - overlap
  }
  return chunks.filter(c => c.trim().length > 0)
}
