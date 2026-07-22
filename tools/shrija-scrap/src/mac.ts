import os from 'node:os'
import { networkInterfaces } from 'node:os'

/** Windows-style MAC list (uppercase, dash separated), unique */
export function listMacAddresses(): string[] {
  const nets = networkInterfaces()
  const macs = new Set<string>()
  for (const entries of Object.values(nets)) {
    if (!entries) continue
    for (const e of entries) {
      if (!e.mac || e.mac === '00:00:00:00:00:00') continue
      if (e.internal) continue
      macs.add(e.mac.toUpperCase().replace(/:/g, '-'))
    }
  }
  return [...macs]
}

export function primaryMac(): string {
  return listMacAddresses()[0] || ''
}

export function machineLabel() {
  return `${os.hostname()} · ${os.platform()} ${os.release()}`
}
