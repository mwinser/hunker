import { WebSocketServer, WebSocket } from 'ws';
import { networkInterfaces } from 'os';
// @ts-ignore - bonjour is CommonJS
import Bonjour from 'bonjour';
const PORT = Number(process.env.PORT ?? 8787);
const wss = new WebSocketServer({ host: '0.0.0.0', port: PORT });
const clients = new Map();
// Get local IP addresses
function getLocalIPs() {
    const interfaces = networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        const nets = interfaces[name];
        if (!nets)
            continue;
        for (const net of nets) {
            // Skip internal (loopback) and non-IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                ips.push(net.address);
            }
        }
    }
    return ips;
}
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
// Start mDNS/Bonjour service for automatic discovery
const bonjour = Bonjour();
const service = bonjour.publish({
    name: 'Hunker Game Server',
    type: 'hunker-ws',
    port: PORT,
    protocol: 'tcp',
});
// Display server information
const localIPs = getLocalIPs();
console.log('\n=== Game Server Started ===');
console.log(`Port: ${PORT}`);
console.log('\nConnect from other devices on the same network using:');
if (localIPs.length > 0) {
    localIPs.forEach((ip) => {
        console.log(`  ws://${ip}:${PORT}`);
    });
}
else {
    console.log('  (No network interfaces found)');
}
console.log('\nLocal connections:');
console.log(`  ws://localhost:${PORT}`);
console.log('\nmDNS/Bonjour: Server is discoverable as "Hunker Game Server"');
console.log('========================\n');
// Cleanup on exit
process.on('SIGINT', () => {
    bonjour.unpublishAll(() => {
        bonjour.destroy();
        process.exit(0);
    });
});
