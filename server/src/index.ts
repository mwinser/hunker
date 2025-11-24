import { WebSocketServer, WebSocket } from 'ws'

type Client = {
  ws: WebSocket
  id: string
}

type ServerMsg =
  | { t: 'welcome'; id: string }
  | { t: 'snapshot'; players: Record<string, { x: number; y: number; z: number; yaw: number }> }

type ClientMsg =
  | { t: 'hello' }
  | { t: 'state'; x: number; y: number; z: number; yaw: number }

const wss = new WebSocketServer({ port: Number(process.env.PORT ?? 8787) })
const clients = new Map<string, Client>()

function broadcast(obj: ServerMsg) {
  const data = JSON.stringify(obj)
  for (const c of clients.values()) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data)
  }
}

function snapshot() {
  const players: Record<string, { x: number; y: number; z: number; yaw: number }> = {}
  for (const [id, c] of clients) {
    ;(players as any)[id] = (c as any).state ?? { x: 0, y: 0, z: 0, yaw: 0 }
  }
  broadcast({ t: 'snapshot', players })
}

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2)
  const client: Client = { ws, id }
  clients.set(id, client)
  ws.send(JSON.stringify({ t: 'welcome', id } satisfies ServerMsg))

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(String(data)) as ClientMsg
      if (msg.t === 'state') {
        ;(client as any).state = { x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw }
      }
    } catch {}
  })

  ws.on('close', () => {
    clients.delete(id)
  })
})

setInterval(snapshot, 1000 / 15) // broadcast 15Hz snapshots

console.log('WebSocket server listening on port', (wss.options.port as number) ?? 8787)


