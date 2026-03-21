import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required environment variable: ${name}`)
  return val
}

// Lazy-load R2 config to allow startup without R2 in dev mode
function getR2Config() {
  return {
    endpoint: requireEnv('CLOUDFLARE_R2_ENDPOINT'),
    accessKey: requireEnv('CLOUDFLARE_R2_ACCESS_KEY'),
    secretKey: requireEnv('CLOUDFLARE_R2_SECRET_KEY'),
    bucket: process.env.CLOUDFLARE_R2_BUCKET || 'souk-media',
    publicUrl: requireEnv('CLOUDFLARE_R2_PUBLIC_URL'),
  }
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest()
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

export function generateKey(userId: string, contentType: string): string {
  const ext = contentType === 'image/png' ? 'png' : 'jpg'
  return `listings/${userId}/${uuidv4()}.${ext}`
}

export async function generatePresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 900
): Promise<string> {
  const config = getR2Config()
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const datetimeStr = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'

  const region = 'auto'
  const service = 's3'
  const host = new URL(config.endpoint).host
  const credentialScope = `${dateStr}/${region}/${service}/aws4_request`
  const credential = `${config.accessKey}/${credentialScope}`

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': datetimeStr,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'content-type;host',
    'Content-Type': contentType,
  })

  const canonicalRequest = [
    'PUT',
    `/${key}`,
    queryParams.toString(),
    `content-type:${contentType}\nhost:${host}\n`,
    'content-type;host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetimeStr,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n')

  const signingKey = hmacSha256(
    hmacSha256(
      hmacSha256(
        hmacSha256(`AWS4${config.secretKey}`, dateStr),
        region
      ),
      service
    ),
    'aws4_request'
  )

  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex')

  queryParams.set('X-Amz-Signature', signature)

  return `${config.endpoint}/${config.bucket}/${key}?${queryParams.toString()}`
}

export function getPublicUrl(key: string): string {
  const config = getR2Config()
  return `${config.publicUrl}/${key}`
}
