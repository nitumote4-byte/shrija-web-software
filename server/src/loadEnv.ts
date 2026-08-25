import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env')

if (!fs.existsSync(envPath) && process.env.NODE_ENV !== 'production') {
  console.warn(`WARNING: ${envPath} not found. Copy server/.env.example to server/.env`)
}

dotenv.config({ path: envPath })
