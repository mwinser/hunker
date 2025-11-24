export type Snapshot = {
  players: Record<string, { x: number; y: number; z: number; yaw: number }>
}

export type Net = {
  id: string | null
  peers: number
  rttMs: number | null
  connect: (url?: string) => void
  sendState: (s: { x: number; y: number; z: number; yaw: number }) => void
  getLatestSnapshot: () => Snapshot | null
}

export function createNet(): Net {
  let ws: WebSocket | null = null
  let id: string | null = null
  let latestSnapshot: Snapshot | null = null
  let peers = 0
  let rttMs: number | null = null
  let lastPingSentAt = 0

  const connect = (url?: string) => {
    if (!url) {
      console.warn('Net.connect() called without URL. Use connection UI to get URL first.')
      return
    }
    
    // Close existing connection if any
    if (ws) {
      ws.close()
      ws = null
    }

    const target = url
    ws = new WebSocket(target)
    ws.onopen = () => {
      // simple keepalive/ping to estimate RTT
      lastPingSentAt = performance.now()
      ws?.send(JSON.stringify({ t: 'hello' }))
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.t === 'welcome') {
          id = msg.id as string
          rttMs = performance.now() - lastPingSentAt
        } else if (msg.t === 'snapshot') {
          latestSnapshot = { players: msg.players as Snapshot['players'] }
          peers = Object.keys(latestSnapshot.players).length
        }
      } catch {}
    }
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    ws.onclose = () => {
      ws = null
      // Only auto-reconnect if we had a successful connection
      if (id) {
        setTimeout(() => connect(url), 1000)
      }
    }
  }

  const sendState = (s: { x: number; y: number; z: number; yaw: number }) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ t: 'state', ...s }))
  }

  return {
    get id() {
      return id
    },
    get peers() {
      return peers
    },
    get rttMs() {
      return rttMs
    },
    connect,
    sendState,
    getLatestSnapshot: () => latestSnapshot,
  }
}


