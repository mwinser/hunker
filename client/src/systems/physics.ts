import RAPIER, { World, RigidBody, Collider } from '@dimforge/rapier3d-compat'

export type Physics = {
  world: World
  ready: Promise<void>
  step: (dt: number) => void
  createStaticGround: (size: { x: number; y: number; z: number }) => Collider
  createStaticCube: (position: { x: number; y: number; z: number }, size: { x: number; y: number; z: number }) => { collider: Collider; rigidBody: RigidBody }
  createStaticWall: (position: { x: number; y: number; z: number }, size: { x: number; y: number; z: number }) => Collider
  removeRigidBody: (rigidBody: RigidBody) => void
}

export function createPhysicsWorld(): Physics {
  let world: World
  const ready = RAPIER.init().then(() => {
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  })

  const step = (dt: number) => {
    if (!world) return
    world.timestep = dt
    world.step()
  }

  const createStaticGround = (size: { x: number; y: number; z: number }) => {
    if (!world) throw new Error('Physics not ready')
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x * 0.5, size.y * 0.5, size.z * 0.5),
      rb
    )
    return col
  }

  const createStaticCube = (position: { x: number; y: number; z: number }, size: { x: number; y: number; z: number }) => {
    if (!world) throw new Error('Physics not ready')
    const rbDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
    const rb = world.createRigidBody(rbDesc)
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x * 0.5, size.y * 0.5, size.z * 0.5)
        .setFriction(0.9)
        .setRestitution(0.0),
      rb
    )
    return { collider: col, rigidBody: rb }
  }

  const removeRigidBody = (rigidBody: RigidBody) => {
    if (!world) throw new Error('Physics not ready')
    world.removeRigidBody(rigidBody)
  }

  const createStaticWall = (position: { x: number; y: number; z: number }, size: { x: number; y: number; z: number }) => {
    if (!world) throw new Error('Physics not ready')
    const rbDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
    const rb = world.createRigidBody(rbDesc)
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x * 0.5, size.y * 0.5, size.z * 0.5)
        .setFriction(0.9)
        .setRestitution(0.0),
      rb
    )
    return col
  }

  return {
    get world() {
      if (!world) throw new Error('Physics not ready')
      return world
    },
    ready,
    step,
    createStaticGround,
    createStaticCube,
    createStaticWall,
    removeRigidBody,
  }
}

export type CharacterController = {
  body: RigidBody
  update: (dt: number, input: {
    desiredVX: number
    desiredVZ: number
    jump: boolean
  }) => void
  isOnGround: () => boolean
}

export function createCapsuleCharacter(physics: Physics, position: { x: number; y: number; z: number }): CharacterController {
  const world = physics.world
  const height = 1.0
  const radius = 0.35
  const rbDesc = new RAPIER.RigidBodyDesc(RAPIER.RigidBodyType.Dynamic)
    .setTranslation(position.x, position.y, position.z)
    .setLinearDamping(0.1)
    .setAngularDamping(0.9) // Prevent unwanted rotation
    .setCanSleep(false)
    .lockRotations() // Lock all rotations for FPS controller
  const body = world.createRigidBody(rbDesc)
  const shape = RAPIER.ColliderDesc.capsule(height * 0.5, radius)
    .setFriction(0.9)
    .setRestitution(0.0)
  world.createCollider(shape, body)

  // Physics parameters
  const maxSpeed = 9.0
  const accel = 40.0
  const airAccel = 8.0 // Reduced acceleration in air
  const jumpImpulse = 4.5 // Reduced from 4.5 for more reasonable jump height
  const groundCheckDistance = radius + 0.1 // Slightly more than radius
  const maxSlopeAngle = Math.PI / 3 // 60 degrees max walkable slope
  const groundFriction = 0.85 // Friction when on ground
  const airFriction = 0.1 // Minimal friction in air

  // Ground detection state
  let groundNormal = { x: 0, y: 1, z: 0 }
  let groundDistance = Infinity
  let onGround = false
  let slopeAngle = 0
  
  // Jump state tracking for edge detection
  let wasJumpPressed = false
  let jumpCooldown = 0 // Cooldown timer to prevent rapid successive jumps
  const jumpCooldownTime = 0.1 // 100ms cooldown after jumping

  const update = (dt: number, input: { desiredVX: number; desiredVZ: number; jump: boolean }) => {
    // Update jump cooldown
    if (jumpCooldown > 0) {
      jumpCooldown -= dt
    }
    
    const linvel = body.linvel()
    const position = body.translation()

    // Enhanced ground detection using multiple raycasts
    // Cast from center and slightly offset positions for better detection
    const rayOrigins = [
      position,
      { x: position.x + radius * 0.7, y: position.y, z: position.z },
      { x: position.x - radius * 0.7, y: position.y, z: position.z },
      { x: position.x, y: position.y, z: position.z + radius * 0.7 },
      { x: position.x, y: position.y, z: position.z - radius * 0.7 },
    ]

    let closestHit: { toi: number; normal: { x: number; y: number; z: number } } | null = null
    let minDistance = Infinity

    for (const origin of rayOrigins) {
      const ray = new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 })
      const hit = world.castRay(ray, groundCheckDistance + 0.2, true)
      
      if (hit) {
        const anyHit = hit as unknown as { toi?: number; normal?: { x: number; y: number; z: number } }
        const toi = typeof anyHit.toi === 'number' ? anyHit.toi : (hit as any).timeOfImpact
        if (typeof toi === 'number' && toi < minDistance) {
          minDistance = toi
          // Use normal from hit if available, otherwise default to up
          const normal = anyHit.normal || { x: 0, y: 1, z: 0 }
          closestHit = { toi, normal }
        }
      }
    }

    // Determine ground state
    onGround = false
    groundDistance = Infinity
    groundNormal = { x: 0, y: 1, z: 0 }
    slopeAngle = 0

    if (closestHit && minDistance < groundCheckDistance) {
      groundDistance = minDistance
      groundNormal = closestHit.normal
      
      // Calculate slope angle (angle between ground normal and up vector)
      const upDot = groundNormal.y
      slopeAngle = Math.acos(Math.max(-1, Math.min(1, upDot)))
      
      // Check vertical velocity - must be zero or negative (falling) to be considered on ground
      const verticalVelocity = linvel.y
      
      // Consider on ground ONLY if:
      // 1. Slope is walkable
      // 2. Close enough to ground (with tighter tolerance)
      // 3. NOT moving upward at all (vertical velocity must be <= 0)
      // 4. Ground is actually beneath the player (normal points mostly up)
      onGround = slopeAngle < maxSlopeAngle && 
                 minDistance < groundCheckDistance * 0.7 && // Tighter distance check
                 verticalVelocity <= 0 && // CRITICAL: Must not be moving upward
                 upDot > 0.5 // Ground normal should point mostly upward
    }

    // Apply friction based on ground state
    const currentFriction = onGround ? groundFriction : airFriction
    const horizontalVel = { x: linvel.x, y: 0, z: linvel.z }
    const horizontalSpeed = Math.sqrt(horizontalVel.x * horizontalVel.x + horizontalVel.z * horizontalVel.z)
    
    if (horizontalSpeed > 0.01 && onGround) {
      const frictionForce = horizontalSpeed * currentFriction
      const frictionDir = {
        x: -horizontalVel.x / horizontalSpeed,
        y: 0,
        z: -horizontalVel.z / horizontalSpeed
      }
      body.applyImpulse({
        x: frictionDir.x * frictionForce * body.mass() * dt,
        y: 0,
        z: frictionDir.z * frictionForce * body.mass() * dt
      }, true)
    }

    // Project desired movement onto ground plane if on slope
    let desiredVX = input.desiredVX
    let desiredVZ = input.desiredVZ
    
    if (onGround && slopeAngle > 0.01) {
      // Project movement direction onto the ground plane
      const desiredDir = { x: desiredVX, y: 0, z: desiredVZ }
      const desiredLen = Math.sqrt(desiredDir.x * desiredDir.x + desiredDir.z * desiredDir.z)
      if (desiredLen > 0.001) {
        // Normalize
        desiredDir.x /= desiredLen
        desiredDir.z /= desiredLen
        
        // Project onto ground plane (remove component along ground normal)
        const dot = desiredDir.x * groundNormal.x + desiredDir.z * groundNormal.z
        desiredDir.x -= groundNormal.x * dot
        desiredDir.z -= groundNormal.z * dot
        
        // Renormalize and scale
        const projLen = Math.sqrt(desiredDir.x * desiredDir.x + desiredDir.z * desiredDir.z)
        if (projLen > 0.001) {
          desiredDir.x /= projLen
          desiredDir.z /= projLen
          desiredVX = desiredDir.x * desiredLen
          desiredVZ = desiredDir.z * desiredLen
        }
      }
    }

    // Clamp desired speed
    const desiredSpeedSq = desiredVX * desiredVX + desiredVZ * desiredVZ
    if (desiredSpeedSq > maxSpeed * maxSpeed) {
      const invLen = 1 / Math.sqrt(desiredSpeedSq)
      desiredVX *= invLen * maxSpeed
      desiredVZ *= invLen * maxSpeed
    }

    // Apply acceleration (different in air vs on ground)
    const currentAccel = onGround ? accel : airAccel
    const dvx = desiredVX - linvel.x
    const dvz = desiredVZ - linvel.z
    const accelX = Math.max(-currentAccel, Math.min(currentAccel, dvx / Math.max(dt, 0.0001)))
    const accelZ = Math.max(-currentAccel, Math.min(currentAccel, dvz / Math.max(dt, 0.0001)))
    
    body.applyImpulse({
      x: accelX * body.mass() * dt,
      y: 0,
      z: accelZ * body.mass() * dt
    }, true)

    // Jump handling - only trigger on edge (press, not hold)
    const jumpPressed = input.jump && !wasJumpPressed
    if (jumpPressed && onGround && jumpCooldown <= 0) {
      body.applyImpulse({ x: 0, y: jumpImpulse * body.mass(), z: 0 }, true)
      jumpCooldown = jumpCooldownTime // Set cooldown after jumping
    }
    wasJumpPressed = input.jump
  }

  return { 
    body, 
    update,
    isOnGround: () => onGround
  }
}


