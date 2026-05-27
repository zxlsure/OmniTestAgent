import { randomBytes, createCipheriv, createDecipheriv, scryptSync, createHash } from 'crypto'
import { getMachineId } from './machineId'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getDerivedSecret(prefix: string): string {
  const machineId = getMachineId()
  return createHash('sha256').update(`${prefix}:${machineId}`).digest('hex')
}

function deriveKey(password: string): Buffer {
  const salt = getDerivedSecret('omni-test-agent-salt')
  return scryptSync(password, salt, KEY_LENGTH)
}

const _defaultSecretCache: { value?: string } = {}
function getDefaultSecret(): string {
  if (!_defaultSecretCache.value) {
    _defaultSecretCache.value = getDerivedSecret('omni-test-agent-key')
  }
  return _defaultSecretCache.value
}

export function encrypt(text: string, secret?: string): string {
  const key = deriveKey(secret ?? getDefaultSecret())
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(encryptedText: string, secret?: string): string {
  const key = deriveKey(secret ?? getDefaultSecret())
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format')
  }
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 4) {
    return '****'
  }
  return `****${apiKey.slice(-4)}`
}
