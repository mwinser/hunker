import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'os'
// @ts-ignore - bonjour is CommonJS
import Bonjour from 'bonjour'

type Client = {
  ws: WebSocket
  id: string
  username: string
}

type ServerMsg =
  | { t: 'welcome'; id: string }
  | { t: 'snapshot'; players: Record<string, { x: number; y: number; z: number; yaw: number; username: string }> }

type ClientMsg =
  | { t: 'hello'; username?: string }
  | { t: 'state'; x: number; y: number; z: number; yaw: number }

const PORT = Number(process.env.PORT ?? 8787)
const wss = new WebSocketServer({ host: '0.0.0.0', port: PORT })
const clients = new Map<string, Client>()

// Get local IP addresses
function getLocalIPs(): string[] {
  const interfaces = networkInterfaces()
  const ips: string[] = []
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name]
    if (!nets) continue
    for (const net of nets) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address)
      }
    }
  }
  return ips
}

function broadcast(obj: ServerMsg) {
  const data = JSON.stringify(obj)
  for (const c of clients.values()) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data)
  }
}

function snapshot() {
  const players: Record<string, { x: number; y: number; z: number; yaw: number; username: string }> = {}
  for (const [id, c] of clients) {
    const state = (c as any).state ?? { x: 0, y: 0, z: 0, yaw: 0 }
    ;(players as any)[id] = { ...state, username: c.username }
  }
  broadcast({ t: 'snapshot', players })
}

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2)
  const client: Client = { ws, id, username: 'Player' }
  clients.set(id, client)
  ws.send(JSON.stringify({ t: 'welcome', id } satisfies ServerMsg))

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(String(data)) as ClientMsg
      if (msg.t === 'hello' && msg.username) {
        client.username = msg.username
      } else if (msg.t === 'state') {
        ;(client as any).state = { x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw }
      }
    } catch {}
  })

  ws.on('close', () => {
    clients.delete(id)
  })
})

setInterval(snapshot, 1000 / 15) // broadcast 15Hz snapshots

// Start mDNS/Bonjour service for automatic discovery
const bonjour = Bonjour()
const service = bonjour.publish({
  name: 'Hunker Game Server',
  type: 'hunker-ws',
  port: PORT,
  protocol: 'tcp',
})

// Display server information
const localIPs = getLocalIPs()
console.log('\n=== Game Server Started ===')
console.log(`Port: ${PORT}`)
console.log('\nConnect from other devices on the same network using:')
if (localIPs.length > 0) {
  localIPs.forEach((ip) => {
    console.log(`  ws://${ip}:${PORT}`)
  })
} else {
  console.log('  (No network interfaces found)')
}
console.log('\nLocal connections:')
console.log(`  ws://localhost:${PORT}`)
console.log('\nmDNS/Bonjour: Server is discoverable as "Hunker Game Server"')
console.log('========================\n')

// Cleanup on exit
process.on('SIGINT', () => {
  bonjour.unpublishAll(() => {
    bonjour.destroy()
    process.exit(0)
  })
})


