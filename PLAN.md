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

### Architecture Evaluation — OOP vs Functional Programming

#### Current State Analysis
The codebase currently uses a **functional programming approach** with factory functions:
- Factory functions return objects with methods: `createPhysicsWorld()`, `createPlayer()`, `createInput()`, `createLoop()`, `createNet()`
- State is encapsulated in closures within factory functions
- No classes are used (except external libraries: Three.js, Rapier)
- Type safety via TypeScript interfaces for returned objects

#### Strengths of Current Approach
- ✅ **Simple and straightforward**: Easy to understand, minimal boilerplate
- ✅ **Good encapsulation**: Closures provide natural private state
- ✅ **Testable**: Dependencies can be easily mocked/injected
- ✅ **No inheritance complexity**: Avoids deep class hierarchies
- ✅ **Functional composition**: Natural for systems that transform data
- ✅ **Works well for Phase 1-2**: Sufficient for current scope

#### Potential Issues as Codebase Grows
- ⚠️ **Scalability concerns**: Many factory functions may become unwieldy with 50+ entities
- ⚠️ **Hidden state mutations**: Closures make debugging state changes harder
- ⚠️ **No entity hierarchy**: Similar entities (zombies, players, NPCs) will duplicate logic
- ⚠️ **Serialization challenges**: Closure-based state is harder to serialize for networking/debugging
- ⚠️ **Limited polymorphism**: Difficult to have variants (e.g., different zombie types, weapon types)

#### Recommended Architectural Changes

**1. Hybrid Approach (Recommended)**
- **Keep functional factories** for simple, stateless systems:
  - `createInput()`, `createNet()`, `createRenderer()` — these work well as-is
- **Consider classes or ECS** for game entities:
  - Players, zombies, weapons, projectiles — these benefit from shared behavior and state management

**2. Entity Component System (ECS) for Phase 3**
- **Why**: ECS is industry-standard for game development, especially with many entities
- **Structure**:
  - **Entities**: Simple IDs (zombie_1, player_2, bullet_42)
  - **Components**: Data only (Position, Health, Weapon, AIState)
  - **Systems**: Logic that operates on components (MovementSystem, CombatSystem, AISystem)
- **Benefits**:
  - Easy to add new entity types (just combine components)
  - Efficient queries (find all entities with Health + Position)
  - Natural fit for networking (components serialize easily)
  - Better performance for many entities
- **Migration path**: Start with new entities (zombies) in ECS, keep existing player system functional

**3. Explicit State Objects**
- Replace closure-hidden state with explicit state objects:
  ```typescript
  // Instead of closure state
  type PlayerState = {
    position: Vector3
    health: number
    weapon: WeaponState
  }
  ```
- Benefits: Easier debugging, serialization, time-travel debugging

**4. Composition Pattern for Variants**
- Use composition over inheritance for entity variants:
  - `createZombie({ type: 'walker', speed: 2.0 })`
  - `createZombie({ type: 'runner', speed: 5.0 })`
  - Components define behavior, not classes

#### Implementation Strategy
- **Phase 2 (Current)**: Keep functional approach — it's working well
- **Phase 3 (Zombies/Weapons)**: 
  - Option A: Introduce ECS for new entities, keep player functional
  - Option B: Migrate player to ECS, use ECS for all entities
  - Option C: Use classes for entities, keep systems functional
- **Decision point**: Evaluate when implementing first zombie — if simple factory works, keep it; if complexity grows, migrate to ECS

#### Specific Recommendations
1. **Keep as-is**: Input, Networking, Rendering, Physics wrapper
2. **Consider classes**: Player, Zombie (if variants needed), Weapon (if multiple types)
3. **Consider ECS**: If >10 entity types or need efficient queries
4. **Explicit state**: Migrate closure state to explicit state objects for debugging
5. **No premature optimization**: Current approach is fine until it becomes a problem

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


