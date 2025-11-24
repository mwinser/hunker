import { WebSocketServer, WebSocket } from 'ws';
const wss = new WebSocketServer({ port: Number(process.env.PORT ?? 8787) });
const clients = new Map();
function broadcast(obj) {
    const data = JSON.stringify(obj);
    for (const c of clients.values()) {
        if (c.ws.readyState === WebSocket.OPEN)
            c.ws.send(data);
    }
}
function snapshot() {
    const players = {};
    for (const [id, c] of clients) {
        ;
        players[id] = c.state ?? { x: 0, y: 0, z: 0, yaw: 0 };
    }
    broadcast({ t: 'snapshot', players });
}
wss.on('connection', (ws) => {
    const id = Math.random().toString(36).slice(2);
    const client = { ws, id };
    clients.set(id, client);
    ws.send(JSON.stringify({ t: 'welcome', id }));
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(String(data));
            if (msg.t === 'state') {
                ;
                client.state = { x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw };
            }
        }
        catch { }
    });
    ws.on('close', () => {
        clients.delete(id);
    });
});
setInterval(snapshot, 1000 / 15); // broadcast 15Hz snapshots
console.log('WebSocket server listening on port', wss.options.port ?? 8787);
