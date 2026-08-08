/// <reference types="node" />

import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { createServer, type ServerResponse } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import fundHandler from './api/fund.ts'

const PORT = Number(process.env.PORT ?? 8080)
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function setSecurityHeaders(res: ServerResponse) {
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin')
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()')
}

async function isFile(path: string): Promise<boolean> {
  try {
    await access(path)
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

function sendFile(path: string, res: ServerResponse, headOnly: boolean) {
  const extension = extname(path).toLowerCase()
  res.statusCode = 200
  res.setHeader('content-type', MIME_TYPES[extension] ?? 'application/octet-stream')
  res.setHeader(
    'cache-control',
    extension === '.html'
      ? 'no-cache'
      : path.includes('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=300',
  )
  if (headOnly) return res.end()
  createReadStream(path).on('error', () => {
    if (!res.headersSent) res.statusCode = 500
    res.end()
  }).pipe(res)
}

const server = createServer(async (req, res) => {
  setSecurityHeaders(res)
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (url.pathname === '/healthz' || url.pathname === '/api/health') {
    res.statusCode = 200
    res.setHeader('content-type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ ok: true }))
  }

  if (url.pathname === '/api/fund') return fundHandler(req, res)

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.setHeader('allow', 'GET, HEAD')
    return res.end('Method not allowed')
  }

  const decodedPath = decodeURIComponent(url.pathname)
  const relativePath = normalize(decodedPath).replace(/^[/\\]+/, '')
  const requestedPath = join(DIST_DIR, relativePath)
  const filePath = requestedPath.startsWith(DIST_DIR) && (await isFile(requestedPath))
    ? requestedPath
    : join(DIST_DIR, 'index.html')

  return sendFile(filePath, res, req.method === 'HEAD')
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Clutch listening on port ${PORT}`)
})
