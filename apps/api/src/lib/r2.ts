import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

const R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT || ''
const R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY || ''
const R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_KEY || ''
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || 'souk-media'
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || ''

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
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const datetimeStr = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'

  const region = 'auto'
  const service = 's3'
  const host = new URL(R2_ENDPOINT).host
  const credentialScope = `${dateStr}/${region}/${service}/aws4_request`
  const credential = `${R2_ACCESS_KEY}/${credentialScope}`

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
        hmacSha256(`AWS4${R2_SECRET_KEY}`, dateStr),
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

  return `${R2_ENDPOINT}/${R2_BUCKET}/${key}?${queryParams.toString()}`
}

export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`
}
