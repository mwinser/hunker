import { PerspectiveCamera, Group, Vector3, Quaternion } from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { CharacterController, Physics } from './physics'
import { createCapsuleCharacter } from './physics'
import type { Input } from './input'

export type Player = {
  mesh: Group
  update: (dt: number) => void
}

export function createPlayer(args: { scene: import('three').Scene; camera: PerspectiveCamera; physics: Physics; input: Input; username: string }): Player {
  const { camera, physics, input, username } = args

  const playerRoot = new Group()
  playerRoot.name = 'PlayerRoot'

  let character: CharacterController | null = null
  physics.ready.then(() => {
    physics.createStaticGround({ x: 40, y: 1, z: 40 })
    character = createCapsuleCharacter(physics, { x: 0, y: 2, z: 0 })
  })

  // Camera state
  const cameraPitch = { value: 0 }
  const cameraYaw = { value: 0 }

  const worldForward = new Vector3()
  const worldRight = new Vector3()
  const tmpQuat = new Quaternion()

  const update = (dt: number) => {
    if (!character) return

    const s = input.state

    // Mouse look
    const sensitivity = 0.0025
    cameraYaw.value += s.lookDeltaX * sensitivity
    cameraPitch.value += s.lookDeltaY * sensitivity
    cameraPitch.value = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, cameraPitch.value))

    tmpQuat.setFromAxisAngle(new Vector3(0, 1, 0), cameraYaw.value)
    const bodyPos = character.body.translation()
    playerRoot.position.set(bodyPos.x, bodyPos.y, bodyPos.z)
    playerRoot.quaternion.copy(tmpQuat)

    // Movement relative to yaw — compute desired world X/Z velocity
    worldForward.set(0, 0, -1).applyQuaternion(playerRoot.quaternion)
    worldRight.copy(worldForward).cross(new Vector3(0, 1, 0)).normalize()
    const forwardAxis = (s.moveForward ? 1 : 0) + (s.moveBackward ? -1 : 0)
    const rightAxis = (s.moveRight ? 1 : 0) + (s.moveLeft ? -1 : 0)
    const speed = s.sprint ? 9.0 : 6.0
    const move = worldForward.multiplyScalar(forwardAxis).add(worldRight.multiplyScalar(rightAxis))
    if (move.lengthSq() > 1e-6) move.normalize()
    const desired = move.multiplyScalar(speed)

    character.update(dt, {
      desiredVX: desired.x,
      desiredVZ: desired.z,
      jump: s.jump,
    })

    // Camera offset (head) — local to playerRoot
    const headHeight = 0.9
    camera.position.set(0, headHeight, 0)
    camera.rotation.set(cameraPitch.value, 0, 0)
  }

  playerRoot.add(camera)

  // Create username label for local player
  const labelDiv = document.createElement('div')
  labelDiv.textContent = username
  labelDiv.style.cssText = `
    color: #fff;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    font-weight: 500;
    background: rgba(0, 0, 0, 0.6);
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
    text-align: center;
  `
  const label = new CSS2DObject(labelDiv)
  label.position.set(0, 1.8, 0) // Position above the avatar
  playerRoot.add(label)

  return { mesh: playerRoot, update }
}


