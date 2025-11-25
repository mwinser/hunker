import './style.css'
import { Scene, Mesh, BoxGeometry, MeshStandardMaterial, Line, BufferGeometry, LineBasicMaterial, Vector3, Quaternion, Raycaster } from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { createRenderer, createCamera, createLights, createGround, createWalls, createStatsOverlay, createCrosshair, applySkybox } from './view'
import { createInput } from './systems/input'
import { createPhysicsWorld } from './systems/physics'
import { createPlayer } from './systems/player'
import { createLoop } from './systems/loop'
import { createConnectionUI } from './systems/connection-ui'
import { createHitscan } from './systems/weapon'
import { makeHitscanAdapter } from './systems/targets'
import { createNet, type Block } from './systems/net'
import type { RigidBody } from '@dimforge/rapier3d-compat'

export async function bootstrap(): Promise<void> {
  const appRoot = document.querySelector<HTMLDivElement>('#app')
  if (!appRoot) {
    throw new Error('Missing #app root element')
  }

  appRoot.innerHTML = ''

  // Show connection UI first
  const connectionUI = createConnectionUI(appRoot)
  const connectionResult = await connectionUI.show()

  if (!connectionResult) {
    // User cancelled connection
    appRoot.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: #fff; font-family: system-ui;">Connection cancelled. Refresh to try again.</div>'
    return
  }

  const { url: serverUrl, username } = connectionResult

  // Clear the UI and start the game
  appRoot.innerHTML = ''

  const scene = new Scene()
  const renderer = createRenderer(appRoot)
  const camera = createCamera()
  const lights = createLights()
  lights.forEach((l) => scene.add(l))

  const ground = createGround()
  scene.add(ground)
  const walls = createWalls()
  scene.add(walls)
  applySkybox(scene)

  const physics = createPhysicsWorld()
  const input = createInput(appRoot)
  const net = createNet()
  net.connect(serverUrl, username)

  // Block data structure
  type BlockData = {
    id: string
    mesh: Mesh
    health: number
    rigidBody: RigidBody | null
    healthLabel: CSS2DObject | null
    healthLabelDiv: HTMLDivElement | null
    destroyed: boolean
    lastHitTime: number // Time in seconds since last hit
  }

  const blocks = new Map<string, BlockData>()

  // Function to create blocks from server data
  const createBlocksFromServer = (serverBlocks: Block[], scene: Scene): void => {
    for (const serverBlock of serverBlocks) {
      if (blocks.has(serverBlock.id)) continue // Already exists
      
      const block = new Mesh(
        new BoxGeometry(1, 1, 1),
        new MeshStandardMaterial({ color: 0x66ccff })
      )
      block.position.set(serverBlock.x, serverBlock.y, serverBlock.z)
      scene.add(block)

      blocks.set(serverBlock.id, {
        id: serverBlock.id,
        mesh: block,
        health: serverBlock.health,
        rigidBody: null,
        healthLabel: null,
        healthLabelDiv: null,
        destroyed: serverBlock.health <= 0,
        lastHitTime: 0,
      })
    }
  }

  // Function to update blocks from server snapshot
  const updateBlocksFromServer = (serverBlocks: Block[]): void => {
    const serverBlockIds = new Set(serverBlocks.map(b => b.id))
    
    // Remove blocks that no longer exist on server
    for (const [id, blockData] of blocks.entries()) {
      if (!serverBlockIds.has(id)) {
        if (blockData.rigidBody) {
          physics.removeRigidBody(blockData.rigidBody)
        }
        if (blockData.healthLabel) {
          blockData.mesh.remove(blockData.healthLabel)
        }
        scene.remove(blockData.mesh)
        blocks.delete(id)
      }
    }
    
    // Update existing blocks or create new ones
    for (const serverBlock of serverBlocks) {
      const blockData = blocks.get(serverBlock.id)
      if (blockData) {
        blockData.health = serverBlock.health
        const wasDestroyed = blockData.destroyed
        blockData.destroyed = serverBlock.health <= 0
        
        // Handle destruction
        if (blockData.destroyed && !wasDestroyed && blockData.rigidBody) {
          if (blockData.healthLabel) {
            blockData.mesh.remove(blockData.healthLabel)
            blockData.healthLabel = null
            blockData.healthLabelDiv = null
          }
          scene.remove(blockData.mesh)
          physics.removeRigidBody(blockData.rigidBody)
          blockData.rigidBody = null
        }
      } else {
        // New block from server
        const block = new Mesh(
          new BoxGeometry(1, 1, 1),
          new MeshStandardMaterial({ color: 0x66ccff })
        )
        block.position.set(serverBlock.x, serverBlock.y, serverBlock.z)
        scene.add(block)
        
        blocks.set(serverBlock.id, {
          id: serverBlock.id,
          mesh: block,
          health: serverBlock.health,
          rigidBody: null,
          healthLabel: null,
          healthLabelDiv: null,
          destroyed: serverBlock.health <= 0,
          lastHitTime: 0,
        })
        
        // Create physics for new block when physics is ready
        physics.ready.then(() => {
          const blockData = blocks.get(serverBlock.id)
          if (blockData && !blockData.destroyed && !blockData.rigidBody) {
            const cubePhysics = physics.createStaticCube(
              { x: serverBlock.x, y: serverBlock.y, z: serverBlock.z },
              { x: 1, y: 1, z: 1 }
            )
            blockData.rigidBody = cubePhysics.rigidBody
          }
        })
      }
    }
  }

  // Wait for initial blocks from server
  const waitForBlocks = () => {
    const initialBlocks = net.getInitialBlocks()
    if (initialBlocks) {
      createBlocksFromServer(initialBlocks, scene)
      return true
    }
    return false
  }

  // Poll for initial blocks (they come in welcome message)
  const checkForBlocks = setInterval(() => {
    if (waitForBlocks()) {
      clearInterval(checkForBlocks)
      initializeGame()
    }
  }, 100)

  // Also check immediately
  if (waitForBlocks()) {
    clearInterval(checkForBlocks)
    initializeGame()
  }

  function initializeGame() {
    physics.ready.then(() => {
      // Create physics for all blocks
      for (const blockData of blocks.values()) {
        if (blockData.destroyed || blockData.rigidBody) continue
        const pos = blockData.mesh.position
        const cubePhysics = physics.createStaticCube(
          { x: pos.x, y: pos.y, z: pos.z },
          { x: 1, y: 1, z: 1 }
        )
        blockData.rigidBody = cubePhysics.rigidBody
      }

    // Create wall colliders around the ground perimeter
    const groundSize = 40
    const wallHeight = 10
    const wallThickness = 0.2
    
    // North wall (positive Z)
    physics.createStaticWall(
      { x: 0, y: wallHeight * 0.5, z: groundSize * 0.5 },
      { x: groundSize, y: wallHeight, z: wallThickness }
    )
    
    // South wall (negative Z)
    physics.createStaticWall(
      { x: 0, y: wallHeight * 0.5, z: -groundSize * 0.5 },
      { x: groundSize, y: wallHeight, z: wallThickness }
    )
    
    // East wall (positive X)
    physics.createStaticWall(
      { x: groundSize * 0.5, y: wallHeight * 0.5, z: 0 },
      { x: wallThickness, y: wallHeight, z: groundSize }
    )
    
    // West wall (negative X)
    physics.createStaticWall(
      { x: -groundSize * 0.5, y: wallHeight * 0.5, z: 0 },
      { x: wallThickness, y: wallHeight, z: groundSize }
    )

    const player = createPlayer({ scene, camera, physics, input, username })
    scene.add(player.mesh)

    // Create hitscan adapter for all blocks
    const blockMeshes = Array.from(blocks.values()).filter(b => !b.destroyed).map(b => b.mesh)
    const cubeTargetAdapter = makeHitscanAdapter(blockMeshes)
    const hitscan = createHitscan(camera, [cubeTargetAdapter])

    // Function to create a tracer line
    const createTracerLine = (origin: Vector3, hitPoint: Vector3 | null, direction: Vector3) => {
      const endPoint = hitPoint || origin.clone().add(direction.clone().multiplyScalar(100))
      const geometry = new BufferGeometry().setFromPoints([origin, endPoint])
      const material = new LineBasicMaterial({ 
        color: 0xffff00, 
        linewidth: 2,
        transparent: true,
        opacity: 0.8
      })
      const line = new Line(geometry, material)
      scene.add(line)
      
      // Remove the line after a brief moment
      setTimeout(() => {
        scene.remove(line)
        geometry.dispose()
        material.dispose()
      }, 50) // 50ms visibility
    }

    // Weapon firing handler
    const handleWeaponFire = () => {
      const result = hitscan.fire()
      
      // Create tracer line
      const dir = new Vector3(0, 0, -1)
      const worldQuat = new Quaternion()
      camera.getWorldQuaternion(worldQuat)
      dir.applyQuaternion(worldQuat)
      createTracerLine(result.origin, result.hitPoint, dir)
      
      if (result.hitPoint) {
        // Use raycaster to find which block was actually hit
        const raycaster = new Raycaster()
        raycaster.set(result.origin, dir.normalize())
        
        // Get all non-destroyed block meshes
        const blockMeshes = Array.from(blocks.values())
          .filter(b => !b.destroyed)
          .map(b => b.mesh)
        
        // Find intersections
        const intersections = raycaster.intersectObjects(blockMeshes, false)
        
        if (intersections.length > 0) {
          // Get the closest intersection (first one is closest)
          const hitMesh = intersections[0].object as Mesh
          
          // Find the block data for this mesh
          for (const blockData of blocks.values()) {
            if (blockData.mesh === hitMesh) {
              // Send hit to server
              net.sendHitBlock(blockData.id)
              blockData.lastHitTime = performance.now() / 1000 // Record hit time in seconds
              break
            }
          }
        }
      }
    }

    // Function to update health labels from server state
    const maxCubeHealth = 100
    const updateHealthLabels = () => {
      const snapshot = net.getLatestSnapshot()
      if (snapshot && snapshot.blocks) {
        updateBlocksFromServer(snapshot.blocks)
        
        // Update health labels for visible blocks
        const currentTime = performance.now() / 1000
        const showDuration = 3
        
        for (const blockData of blocks.values()) {
          if (blockData.destroyed) continue
          
          const timeSinceHit = currentTime - blockData.lastHitTime
          const shouldShow = timeSinceHit < showDuration && timeSinceHit > 0
          
          if (shouldShow) {
            if (!blockData.healthLabelDiv || !blockData.healthLabel) {
              const healthLabelDiv = document.createElement('div')
              healthLabelDiv.textContent = `${blockData.health}/${maxCubeHealth}`
              healthLabelDiv.style.cssText = `
                color: #ffffff !important;
                font-family: system-ui, sans-serif !important;
                font-size: 24px !important;
                font-weight: 700 !important;
                background: rgba(0, 0, 0, 0.9) !important;
                padding: 6px 12px !important;
                border-radius: 6px !important;
                white-space: nowrap !important;
                pointer-events: none !important;
                user-select: none !important;
                text-align: center !important;
                display: block !important;
                line-height: 1.2 !important;
                text-shadow: 2px 2px 4px rgba(0, 0, 0, 1) !important;
                border: 2px solid rgba(255, 255, 255, 0.3) !important;
              `
              const healthLabel = new CSS2DObject(healthLabelDiv)
              healthLabel.position.set(0, 1.2, 0)
              blockData.mesh.add(healthLabel)
              blockData.healthLabel = healthLabel
              blockData.healthLabelDiv = healthLabelDiv
            } else {
              blockData.healthLabelDiv.textContent = `${blockData.health}/${maxCubeHealth}`
              blockData.healthLabelDiv.style.display = 'block'
            }
          } else if (blockData.healthLabel) {
            blockData.mesh.remove(blockData.healthLabel)
            blockData.healthLabel = null
            blockData.healthLabelDiv = null
          }
        }
      }
    }

    // Update health labels and blocks from server
    void setInterval(updateHealthLabels, 100) // Check every 100ms

    if (!appRoot) {
      throw new Error('Missing #app root element')
    }
    const stats = createStatsOverlay(appRoot)
    const crosshair = createCrosshair(appRoot)
    
    // Update handleWeaponFire to flash crosshair
    const originalHandleWeaponFire = handleWeaponFire
    const handleWeaponFireWithFlash = () => {
      crosshair.flash()
      originalHandleWeaponFire()
    }
    
    const loop = createLoop({ renderer, scene, camera, physics, player, input, stats, serverUrl, username, onFire: handleWeaponFireWithFlash, net })
    loop.start()
  })
  }
}


