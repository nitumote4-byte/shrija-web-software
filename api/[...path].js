/**
 * Vercel serverless proxy → Railway API
 * Route: /api/* → this file (via vercel.json rewrite)
 */
const RAILWAY = (
  process.env.RAILWAY_API_URL ||
  'https://shrija-web-software-production.up.railway.app'
).replace(/\/$/, '')

module.exports = async function handler(req, res) {
  try {
    const raw = req.query.path
    const suffix = Array.isArray(raw) ? raw.filter(Boolean).join('/') : raw || ''
    const qIndex = typeof req.url === 'string' ? req.url.indexOf('?') : -1
    const search = qIndex >= 0 ? req.url.slice(qIndex) : ''
    const target = `${RAILWAY}/api/${suffix}${search}`

    const headers = { Accept: 'application/json' }
    if (req.headers.authorization) headers.Authorization = req.headers.authorization
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type']

    /** @type {RequestInit} */
    const init = { method: req.method || 'GET', headers }

    if (req.method && !['GET', 'HEAD'].includes(req.method) && req.body !== undefined) {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    const upstream = await fetch(target, init)
    const text = await upstream.text()
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8'

    res.statusCode = upstream.status
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'no-store')
    res.end(text)
  } catch (err) {
    console.error('API proxy error', err)
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: err instanceof Error ? `API proxy failed: ${err.message}` : 'API proxy failed',
        hint: 'Check Railway is online and RAILWAY_API_URL is correct on Vercel',
      }),
    )
  }
}
