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

### Phase 2 — Two-computer multiplayer connectivity test
- **objective**: Connect two browsers and synchronize player transforms with prediction/reconciliation.
- **core tasks**:
  - Stand up minimal authoritative server (Node.js + TypeScript; Colyseus or custom) with tick @ 30–60 Hz.
  - Networking: WebRTC DataChannel (with simple signaling + STUN/TURN) or WebSocket fallback.
  - Client prediction for local movement; server reconciliation; remote interpolation.
  - Replicate essentials: player transform, input sequence numbers, join/leave; debug net HUD (RTT, loss, snapshot rate).
  - Basic error handling: reconnect, room rejoin, version mismatch guard.
- **deliverable**: Two separate machines see each other move smoothly in the same room over the network.
- **acceptance**:
  - Under ~100 ms RTT, remote motion appears smooth with minimal snapping; local motion feels unchanged.
  - Clean connect/disconnect flows; no desync after 5+ minutes of movement.


