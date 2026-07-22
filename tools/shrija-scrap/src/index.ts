import { createScrapServer, DEFAULT_PORT } from './server.js'
import { listMacAddresses, machineLabel, primaryMac } from './mac.js'

const app = createScrapServer()

app.listen(DEFAULT_PORT, '127.0.0.1', () => {
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
  console.log('  (tool opens Manak browser; enter captcha if asked)')
  console.log('')
})
