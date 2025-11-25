import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'os'
import { createServer } from 'http'
// @ts-ignore - bonjour is CommonJS
import Bonjour from 'bonjour'

type Client = {
  ws: WebSocket
  id: string
  username: string
}

type Block = {
  id: string
  x: number
  y: number
  z: number
  health: number
}

type ServerMsg =
  | { t: 'welcome'; id: string; blocks: Block[] }
  | { t: 'snapshot'; players: Record<string, { x: number; y: number; z: number; yaw: number; username: string }>; blocks: Block[] }

type ClientMsg =
  | { t: 'hello'; username?: string }
  | { t: 'state'; x: number; y: number; z: number; yaw: number }
  | { t: 'hitBlock'; blockId: string }

const PORT = Number(process.env.PORT ?? 8787)

// Create HTTP server for discovery endpoint
const httpServer = createServer((req, res) => {
  // CORS headers for browser access
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  
  if (req.method === 'GET' && req.url === '/discover') {
    // Discovery endpoint - respond with server info
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      name: 'Hunker Game Server',
      port: PORT,
      players: clients.size,
      status: 'running'
    }))
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
})

// Attach WebSocket server to HTTP server
const wss = new WebSocketServer({ server: httpServer })
const clients = new Map<string, Client>()

// Create blocks on server (source of truth)
function createBlocks(count: number): Block[] {
  const blocks: Block[] = []
  const positionStackCount = new Map<string, number>()
  const blockSize = 1
  const groundSize = 40
  const playArea = groundSize * 0.8
  const halfPlayArea = playArea * 0.5

  for (let i = 0; i < count; i++) {
    const x = Math.floor((Math.random() * playArea - halfPlayArea) / blockSize) * blockSize
    const z = Math.floor((Math.random() * playArea - halfPlayArea) / blockSize) * blockSize
    
    const posKey = `${x},${z}`
    const stackHeight = positionStackCount.get(posKey) || 0
    positionStackCount.set(posKey, stackHeight + 1)
    
    const y = 0.5 + stackHeight * blockSize
    
    blocks.push({
      id: `block_${i}`,
      x,
      y,
      z,
      health: 100,
    })
  }

  return blocks
}

const blocks = createBlocks(20)

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
  broadcast({ t: 'snapshot', players, blocks })
}

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2)
  const client: Client = { ws, id, username: 'Player' }
  clients.set(id, client)
  ws.send(JSON.stringify({ t: 'welcome', id, blocks } satisfies ServerMsg))

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(String(data)) as ClientMsg
      if (msg.t === 'hello' && msg.username) {
        client.username = msg.username
      } else if (msg.t === 'state') {
        ;(client as any).state = { x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw }
      } else if (msg.t === 'hitBlock') {
        const block = blocks.find(b => b.id === msg.blockId)
        if (block && block.health > 0) {
          block.health -= 25
          if (block.health <= 0) {
            block.health = 0
          }
        }
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

// Start HTTP server
httpServer.listen(PORT, '0.0.0.0', () => {
  // Display server information
  const localIPs = getLocalIPs()
  console.log('\n=== Game Server Started ===')
  console.log(`Port: ${PORT}`)
  console.log(`Discovery endpoint: http://<ip>:${PORT}/discover`)
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
})

// Cleanup on exit
process.on('SIGINT', () => {
  httpServer.close(() => {
    bonjour.unpublishAll(() => {
      bonjour.destroy()
      process.exit(0)
    })
  })
})


