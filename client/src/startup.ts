import './style.css'
import { Scene, Mesh, BoxGeometry, MeshStandardMaterial } from 'three'
import { createRenderer, createCamera, createLights, createGround, createStatsOverlay, applySkybox } from './view'
import { createInput } from './systems/input'
import { createPhysicsWorld } from './systems/physics'
import { createPlayer } from './systems/player'
import { createLoop } from './systems/loop'
import { createConnectionUI } from './systems/connection-ui'

export async function bootstrap(): Promise<void> {
  const appRoot = document.querySelector<HTMLDivElement>('#app')
  if (!appRoot) {
    throw new Error('Missing #app root element')
  }

  appRoot.innerHTML = ''

  // Show connection UI first
  const connectionUI = createConnectionUI(appRoot)
  const serverUrl = await connectionUI.show()

  if (!serverUrl) {
    // User cancelled connection
    appRoot.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: #fff; font-family: system-ui;">Connection cancelled. Refresh to try again.</div>'
    return
  }

  // Clear the UI and start the game
  appRoot.innerHTML = ''

  const scene = new Scene()
  const renderer = createRenderer(appRoot)
  const camera = createCamera()
  const lights = createLights()
  lights.forEach((l) => scene.add(l))

  const ground = createGround()
  scene.add(ground)
  applySkybox(scene)

  // simple block
  const block = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x66ccff }))
  block.position.set(0, 1, -3)
  scene.add(block)

  const physics = createPhysicsWorld()
  const input = createInput(appRoot)

  physics.ready.then(() => {
    const player = createPlayer({ scene, camera, physics, input })
    scene.add(player.mesh)

    const stats = createStatsOverlay(appRoot)
    const loop = createLoop({ renderer, scene, camera, physics, player, input, stats, serverUrl })
    loop.start()
  })
}


