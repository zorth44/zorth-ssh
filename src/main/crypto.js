import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16
const SALT = 'zorth-ssh-v1'

function deriveKey(secret) {
  return crypto.scryptSync(secret, SALT, 32)
}

export function encrypt(text, secret) {
  if (!text) return ''
  const key = deriveKey(secret)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decrypt(text, secret) {
  if (!text) return ''
  try {
    const [ivHex, encHex] = text.split(':')
    const key = deriveKey(secret)
    const iv = Buffer.from(ivHex, 'hex')
    const enc = Buffer.from(encHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch {
    return ''
  }
}
