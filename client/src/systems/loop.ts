import { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
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
  username: string
}) {
  const { renderer, scene, camera, physics, player, input, stats, serverUrl, username } = args

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
  net.connect(serverUrl, username)
  const remotes = new Map<string, ReturnType<typeof import('./remotes').createRemoteNode>>() as any

  // CSS2D renderer for username labels
  const labelRenderer = new CSS2DRenderer()
  const container = renderer.domElement.parentElement
  if (container) {
    const resizeLabelRenderer = () => {
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || window.innerHeight
      labelRenderer.setSize(w, h)
    }
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.top = '0'
    labelRenderer.domElement.style.left = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(labelRenderer.domElement)
    window.addEventListener('resize', resizeLabelRenderer)
    resizeLabelRenderer()
  }

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
      if (snap && net.id) {
        // Filter out local player from remotes
        const remotePlayers: Record<string, { x: number; y: number; z: number; yaw: number; username: string }> = {}
        for (const [id, player] of Object.entries(snap.players)) {
          if (id !== net.id) {
            remotePlayers[id] = player
          }
        }
        updateRemotes(remotes as any, remotePlayers, scene)
      }
      simulateRemotes(remotes as any, fixedDt)
      accumulator -= fixedDt
    }

    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
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


