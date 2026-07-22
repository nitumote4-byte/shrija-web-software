/**
 * Vercel serverless proxy → Railway API.
 * Browser calls same-origin /api/* (avoids Railway DNS/CORS issues).
 */
const RAILWAY =
  process.env.RAILWAY_API_URL?.replace(/\/$/, '') ||
  'https://shrija-web-software-production.up.railway.app'

export default async function handler(req, res) {
  try {
    const parts = req.query.path
    const suffix = Array.isArray(parts) ? parts.join('/') : parts || ''
    const search = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
    const target = `${RAILWAY}/api/${suffix}${search}`

    const headers = {}
    if (req.headers.authorization) headers.authorization = req.headers.authorization
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']
    if (req.headers.accept) headers.accept = req.headers.accept

    const init = {
      method: req.method,
      headers,
    }

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body != null) {
      init.body =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    const upstream = await fetch(target, init)
    const text = await upstream.text()
    const contentType = upstream.headers.get('content-type') || 'application/json'

    res.status(upstream.status)
    res.setHeader('content-type', contentType)
    res.setHeader('cache-control', 'no-store')
    res.send(text)
  } catch (err) {
    console.error('API proxy error', err)
    res.status(502).json({
      error:
        err instanceof Error
          ? `API proxy failed: ${err.message}`
          : 'API proxy failed',
    })
  }
}
