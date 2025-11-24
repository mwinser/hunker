## Browser FPS Zombie Survival — Development Plan

### Phase 1 — Local-only physics and controls (offline)
- **objective**: Establish core player feel and local gameplay loop without networking.
- **core tasks**:
  - Implement FPS controller with Pointer Lock mouse-look; walk, sprint, jump.
  - Integrate capsule collider physics (Rapier WASM preferred); grounding, slopes, friction.
  - Fixed-timestep simulation loop; input buffering; pause/focus handling.
  - Simple weapon (hitscan): fire, damage, basic recoil/spread; impact decals/sounds.
  - Greybox test level; basic HUD (FPS counter, position, health).
- **deliverable**: Local build where movement, collisions, and simple combat feel responsive at 60 FPS on a mid laptop.
- **acceptance**:
  - Smooth, jitter-free camera/control; reliable ground detection; no clipping/rubberbanding locally.
  - Consistent damage on targets; frame-time within budget; no major GC spikes.

### Phase 2 — Two-computer multiplayer connectivity test (same network) ✅ **COMPLETED**
- **objective**: Connect two browsers on the same WiFi network and synchronize player transforms with prediction/reconciliation.
- **core tasks**:
  - Stand up minimal authoritative server (Node.js + TypeScript; Colyseus or custom) with tick @ 30–60 Hz.
  - Networking: WebRTC DataChannel (with simple signaling + STUN/TURN) or WebSocket fallback.
  - Local network discovery: server broadcasts/listens on local IP (e.g., via mDNS/Bonjour or manual IP entry); clients can discover or connect via host's local IP address.
  - Client prediction for local movement; server reconciliation; remote interpolation.
  - Replicate essentials: player transform, input sequence numbers, join/leave; debug net HUD (RTT, loss, snapshot rate).
  - Basic error handling: reconnect, room rejoin, version mismatch guard.
- **deliverable**: Two separate machines on the same WiFi network can discover/connect and see each other move smoothly in the same room.
- **acceptance**:
  - Under ~100 ms RTT, remote motion appears smooth with minimal snapping; local motion feels unchanged.
  - Clean connect/disconnect flows; no desync after 5+ minutes of movement.
  - Clients on the same WiFi network can successfully discover or manually connect to the game server.

### Phase 3 — Gameplay systems and content
- **objective**: Add core gameplay mechanics, zombie AI, and survival elements.
- **core tasks**:
  - Zombie AI: pathfinding, spawn system, basic behaviors (patrol, chase, attack).
  - Health/damage system: player health, zombie health, death/respawn mechanics.
  - Weapon variety: multiple weapon types, ammo system, reload mechanics.
  - Survival elements: resource gathering, crafting, base building (optional).
  - Wave/spawn system: progressive difficulty, zombie spawning mechanics.
  - UI/UX: inventory, health bar, ammo counter, game over screen.
- **deliverable**: Playable survival game loop with zombies, weapons, and basic progression.
- **acceptance**:
  - Zombies spawn and chase players reliably; combat feels responsive.
  - Health/damage system works correctly; death and respawn flow smoothly.
  - Multiple weapons feel distinct; ammo management adds tactical depth.


