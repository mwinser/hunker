import { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import type { Physics } from './physics'
import type { Player } from './player'
import type { Input } from './input'
import type { StatsOverlay } from '../view'
import { createNet } from './net'
import { simulateRemotes, updateRemotes } from './remotes'

export function createLoop(args: {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  physics: Physics
  player: Player
  input: Input
  stats: StatsOverlay
  serverUrl: string
}) {
  const { renderer, scene, camera, physics, player, input, stats, serverUrl } = args

  const stepHz = 60
  const fixedDt = 1 / stepHz
  let accumulator = 0
  let lastTime = performance.now() / 1000
  let frameCounter = 0
  let fpsTimer = 0
  let fps = 0

  let running = false

  // networking
  const net = createNet()
  net.connect(serverUrl)
  const remotes = new Map<string, ReturnType<typeof import('./remotes').createRemoteNode>>() as any

  function frame() {
    if (!running) return
    const now = performance.now() / 1000
    let dt = Math.min(0.25, now - lastTime)
    lastTime = now
    accumulator += dt

    while (accumulator >= fixedDt) {
      player.update(fixedDt)
      physics.step(fixedDt)
      // network send (lower rate, but piggyback here)
      const pos = player.mesh.position
      const yaw = player.mesh.quaternion.clone().setFromRotationMatrix(player.mesh.matrixWorld).y || 0
      net.sendState({ x: pos.x, y: pos.y, z: pos.z, yaw })
      // remotes integrate
      const snap = net.getLatestSnapshot()
      if (snap) updateRemotes(remotes as any, snap.players, scene)
      simulateRemotes(remotes as any, fixedDt)
      accumulator -= fixedDt
    }

    renderer.render(scene, camera)
    input.resetPerFrame()

    // HUD
    frameCounter++
    fpsTimer += dt
    if (fpsTimer >= 0.25) {
      fps = frameCounter / fpsTimer
      frameCounter = 0
      fpsTimer = 0
      const p = (player.mesh.position)
      stats.update({ fps, position: `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}` })
    }

    requestAnimationFrame(frame)
  }

  return {
    start() {
      running = true
      requestAnimationFrame(frame)
    },
    stop() {
      running = false
    },
  }
}


