import { createScrapServer, DEFAULT_PORT } from './server.js'
import { listMacAddresses, machineLabel, primaryMac } from './mac.js'

const app = createScrapServer()

const server = app.listen(DEFAULT_PORT, '127.0.0.1', () => {
  console.log('')
  console.log('  Shrija Scrap Tool')
  console.log('  -----------------')
  console.log(`  Listening: http://127.0.0.1:${DEFAULT_PORT}`)
  console.log(`  Machine:   ${machineLabel()}`)
  console.log(`  MAC:       ${primaryMac() || '(none)'}`)
  const all = listMacAddresses()
  if (all.length > 1) console.log(`  All MACs:  ${all.join(', ')}`)
  console.log('')
  console.log('  Keep this window open.')
  console.log('  Open Shrija → Auto Request → Fetch Request')
  console.log('  After login: open Receiving, click yellow Scrape this page')
  console.log('')
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error('')
    console.error(`  ERROR: Port ${DEFAULT_PORT} already in use.`)
    console.error('  Close the other Shrija Scrap Tool window, then start again.')
    console.error('')
  } else {
    console.error('')
    console.error('  ERROR starting scrap tool:', err.message)
    console.error('')
  }
  process.exitCode = 1
})

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err)
  process.exitCode = 1
})
