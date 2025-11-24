import RAPIER, { World, RigidBody, Collider } from '@dimforge/rapier3d-compat'

export type Physics = {
  world: World
  ready: Promise<void>
  step: (dt: number) => void
  createStaticGround: (size: { x: number; y: number; z: number }) => Collider
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

  return {
    get world() {
      if (!world) throw new Error('Physics not ready')
      return world
    },
    ready,
    step,
    createStaticGround,
  }
}

export type CharacterController = {
  body: RigidBody
  update: (dt: number, input: {
    desiredVX: number
    desiredVZ: number
    jump: boolean
  }) => void
}

export function createCapsuleCharacter(physics: Physics, position: { x: number; y: number; z: number }): CharacterController {
  const world = physics.world
  const height = 1.0
  const radius = 0.35
  const rbDesc = new RAPIER.RigidBodyDesc(RAPIER.RigidBodyType.Dynamic)
    .setTranslation(position.x, position.y, position.z)
    .setLinearDamping(0.1)
    .setCanSleep(false)
  const body = world.createRigidBody(rbDesc)
  const shape = RAPIER.ColliderDesc.capsule(height * 0.5, radius)
    .setFriction(0.9)
    .setRestitution(0.0)
  world.createCollider(shape, body)

  const maxSpeed = 9.0
  const accel = 40.0
  const jumpImpulse = 4.5

  const update = (dt: number, input: { desiredVX: number; desiredVZ: number; jump: boolean }) => {
    const linvel = body.linvel()

    // Ground check: simplistic — raycast down a small distance
    const origin = body.translation()
    const ray = new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 })
    const hit = world.castRay(ray, 0.6, true)
    let onGround = false
    if (hit) {
      // castRay returns RayColliderHit | null; toi is time-of-impact
      const anyHit = hit as unknown as { toi?: number }
      onGround = typeof anyHit.toi === 'number' && anyHit.toi < 0.55
    }

    // Desired world-space horizontal velocity
    let desiredVX = input.desiredVX
    let desiredVZ = input.desiredVZ
    const desiredSpeedSq = desiredVX * desiredVX + desiredVZ * desiredVZ
    if (desiredSpeedSq > maxSpeed * maxSpeed) {
      const invLen = 1 / Math.sqrt(desiredSpeedSq)
      desiredVX *= invLen * maxSpeed
      desiredVZ *= invLen * maxSpeed
    }

    // Accelerate toward desired horizontal velocity; preserve Y
    const dvx = desiredVX - linvel.x
    const dvz = desiredVZ - linvel.z
    const ax = Math.max(-accel, Math.min(accel, dvx / Math.max(dt, 0.0001)))
    const az = Math.max(-accel, Math.min(accel, dvz / Math.max(dt, 0.0001)))
    body.applyImpulse({ x: ax * body.mass() * dt, y: 0, z: az * body.mass() * dt }, true)

    if (input.jump && onGround) {
      body.applyImpulse({ x: 0, y: jumpImpulse * body.mass(), z: 0 }, true)
    }
  }

  return { body, update }
}


