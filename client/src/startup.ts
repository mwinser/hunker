import './style.css'
import { Scene, Mesh, BoxGeometry, MeshStandardMaterial, Line, BufferGeometry, LineBasicMaterial, Vector3, Quaternion } from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { createRenderer, createCamera, createLights, createGround, createWalls, createStatsOverlay, applySkybox } from './view'
import { createInput } from './systems/input'
import { createPhysicsWorld } from './systems/physics'
import { createPlayer } from './systems/player'
import { createLoop } from './systems/loop'
import { createConnectionUI } from './systems/connection-ui'
import { createHitscan } from './systems/weapon'
import { makeHitscanAdapter } from './systems/targets'
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

  // Function to randomly create blocks with stacking
  type BlockData = {
    mesh: Mesh
    health: number
    rigidBody: RigidBody
    healthLabel: CSS2DObject | null
    healthLabelDiv: HTMLDivElement | null
    destroyed: boolean
    lastHitTime: number // Time in seconds since last hit
  }

  const createRandomBlocks = (count: number, scene: Scene): BlockData[] => {
    const blocks: BlockData[] = []
    const positionStackCount = new Map<string, number>() // Track how many blocks are at each grid position
    const blockSize = 1
    const groundSize = 40
    const playArea = groundSize * 0.8 // Use 80% of ground size to keep blocks away from walls
    const halfPlayArea = playArea * 0.5

    for (let i = 0; i < count; i++) {
      // Generate random position within play area
      const x = Math.floor((Math.random() * playArea - halfPlayArea) / blockSize) * blockSize
      const z = Math.floor((Math.random() * playArea - halfPlayArea) / blockSize) * blockSize
      
      // Create position key for stacking
      const posKey = `${x},${z}`
      const stackHeight = positionStackCount.get(posKey) || 0
      positionStackCount.set(posKey, stackHeight + 1)
      
      // Calculate Y position based on stack height
      const y = 0.5 + stackHeight * blockSize
      
      // Create block mesh
      const block = new Mesh(
        new BoxGeometry(blockSize, blockSize, blockSize),
        new MeshStandardMaterial({ color: 0x66ccff })
      )
      block.position.set(x, y, z)
      scene.add(block)

      blocks.push({
        mesh: block,
        health: 100,
        rigidBody: null as any, // Will be set after physics is ready
        healthLabel: null,
        healthLabelDiv: null,
        destroyed: false,
        lastHitTime: 0,
      })
    }

    return blocks
  }

  const blocks = createRandomBlocks(20, scene)

  physics.ready.then(() => {
    // Create physics for all blocks
    const maxCubeHealth = 100
    for (const blockData of blocks) {
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
    const blockMeshes = blocks.map(b => b.mesh)
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
        // Find which block was hit by checking distance to block centers
        let hitBlock: BlockData | null = null
        let closestDist = Infinity
        
        for (const blockData of blocks) {
          if (blockData.destroyed) continue
          
          const blockPos = blockData.mesh.position
          const dist = result.hitPoint!.distanceTo(blockPos)
          
          // Check if hit point is within block bounds (0.6 is roughly half diagonal of 1x1x1 cube)
          if (dist < 0.6 && dist < closestDist) {
            closestDist = dist
            hitBlock = blockData
          }
        }
        
        if (hitBlock) {
          hitBlock.health -= 25 // 4 shots to destroy
          hitBlock.lastHitTime = performance.now() / 1000 // Record hit time in seconds
          
          // Create health label if it doesn't exist
          if (!hitBlock.healthLabelDiv || !hitBlock.healthLabel) {
            const healthLabelDiv = document.createElement('div')
            healthLabelDiv.textContent = `${hitBlock.health}/${maxCubeHealth}`
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
            hitBlock.mesh.add(healthLabel)
            hitBlock.healthLabel = healthLabel
            hitBlock.healthLabelDiv = healthLabelDiv
          } else {
            // Update existing health label
            hitBlock.healthLabelDiv.textContent = `${hitBlock.health}/${maxCubeHealth}`
            hitBlock.healthLabelDiv.style.display = 'block'
          }
          
          if (hitBlock.health <= 0 && !hitBlock.destroyed && hitBlock.rigidBody) {
            hitBlock.destroyed = true
            if (hitBlock.healthLabel) {
              hitBlock.mesh.remove(hitBlock.healthLabel)
            }
            scene.remove(hitBlock.mesh)
            physics.removeRigidBody(hitBlock.rigidBody)
          }
        }
      }
    }

    // Function to update health label visibility based on time since last hit
    const updateHealthLabelVisibility = () => {
      const currentTime = performance.now() / 1000
      const showDuration = 3 // Show for 3 seconds after hit
      
      for (const blockData of blocks) {
        if (blockData.destroyed || !blockData.healthLabelDiv || !blockData.healthLabel) continue
        
        const timeSinceHit = currentTime - blockData.lastHitTime
        if (timeSinceHit > showDuration) {
          // Remove the label after 3 seconds
          if (blockData.healthLabel) {
            blockData.mesh.remove(blockData.healthLabel)
            blockData.healthLabel = null
            blockData.healthLabelDiv = null
          }
        }
      }
    }

    // Update health label visibility every frame (60fps check)
    void setInterval(updateHealthLabelVisibility, 16) // ~60fps

    const stats = createStatsOverlay(appRoot)
    const loop = createLoop({ renderer, scene, camera, physics, player, input, stats, serverUrl, username, onFire: handleWeaponFire })
    loop.start()
  })
}


