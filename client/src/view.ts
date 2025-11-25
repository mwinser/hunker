import {
  WebGLRenderer,
  PerspectiveCamera,
  Color,
  AmbientLight,
  DirectionalLight,
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
  Group,
  CanvasTexture,
  RepeatWrapping,
  CubeTexture,
  BoxGeometry,
} from 'three'

export function createRenderer(container: HTMLElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setClearColor(new Color(0x202226))
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  const resize = () => {
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight
    renderer.setSize(w, h)
  }
  window.addEventListener('resize', resize)
  resize()
  container.appendChild(renderer.domElement)
  return renderer
}

export function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  return camera
}

export function createLights(): (AmbientLight | DirectionalLight)[] {
  const amb = new AmbientLight(0xffffff, 0.35)
  const dir = new DirectionalLight(0xffffff, 1.0)
  dir.position.set(5, 10, 5)
  dir.castShadow = false
  return [amb, dir]
}

export function createGround(): Group {
  const group = new Group()
  const tex = createCheckerTexture(256, 4, '#5b5f66', '#3a3d42')
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(20, 20)

  const plane = new Mesh(
    new PlaneGeometry(40, 40, 1, 1),
    new MeshStandardMaterial({ color: 0xffffff, map: tex })
  )
  plane.rotateX(-Math.PI / 2)
  plane.receiveShadow = false
  group.add(plane)
  return group
}

export function createWalls(): Group {
  const group = new Group()
  const wallMaterial = new MeshStandardMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.3,
  })

  const groundSize = 40
  const wallHeight = 10
  const wallThickness = 0.2

  // North wall (positive Z)
  const northWall = new Mesh(
    new BoxGeometry(groundSize, wallHeight, wallThickness),
    wallMaterial
  )
  northWall.position.set(0, wallHeight * 0.5, groundSize * 0.5)
  group.add(northWall)

  // South wall (negative Z)
  const southWall = new Mesh(
    new BoxGeometry(groundSize, wallHeight, wallThickness),
    wallMaterial
  )
  southWall.position.set(0, wallHeight * 0.5, -groundSize * 0.5)
  group.add(southWall)

  // East wall (positive X)
  const eastWall = new Mesh(
    new BoxGeometry(wallThickness, wallHeight, groundSize),
    wallMaterial
  )
  eastWall.position.set(groundSize * 0.5, wallHeight * 0.5, 0)
  group.add(eastWall)

  // West wall (negative X)
  const westWall = new Mesh(
    new BoxGeometry(wallThickness, wallHeight, groundSize),
    wallMaterial
  )
  westWall.position.set(-groundSize * 0.5, wallHeight * 0.5, 0)
  group.add(westWall)

  return group
}

export type StatsOverlay = {
  el: HTMLDivElement
  update: (args: { fps: number; position: string }) => void
}

export function createStatsOverlay(container: HTMLElement): StatsOverlay {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.left = '12px'
  el.style.top = '12px'
  el.style.padding = '8px 10px'
  el.style.background = 'rgba(0,0,0,0.35)'
  el.style.color = '#fff'
  el.style.fontFamily = 'monospace'
  el.style.fontSize = '12px'
  el.style.borderRadius = '6px'
  el.style.pointerEvents = 'none'
  el.textContent = 'FPS: --\nPos: --'
  container.appendChild(el)

  return {
    el,
    update({ fps, position }) {
      el.textContent = `FPS: ${fps.toFixed(0)}\nPos: ${position}`
    },
  }
}

export type Crosshair = {
  flash: () => void
}

export function createCrosshair(container: HTMLElement): Crosshair {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.left = '50%'
  el.style.top = '50%'
  el.style.transform = 'translate(-50%, -50%)'
  el.style.width = '20px'
  el.style.height = '20px'
  el.style.pointerEvents = 'none'
  el.style.zIndex = '1000'
  
  // Create crosshair lines
  const lineSize = 8
  const lineThickness = 2
  const gap = 2
  
  // Horizontal line (top)
  const topLine = document.createElement('div')
  topLine.style.position = 'absolute'
  topLine.style.left = '50%'
  topLine.style.top = `${gap}px`
  topLine.style.transform = 'translateX(-50%)'
  topLine.style.width = `${lineSize}px`
  topLine.style.height = `${lineThickness}px`
  topLine.style.background = 'rgba(255, 255, 255, 0.8)'
  el.appendChild(topLine)
  
  // Horizontal line (bottom)
  const bottomLine = document.createElement('div')
  bottomLine.style.position = 'absolute'
  bottomLine.style.left = '50%'
  bottomLine.style.bottom = `${gap}px`
  bottomLine.style.transform = 'translateX(-50%)'
  bottomLine.style.width = `${lineSize}px`
  bottomLine.style.height = `${lineThickness}px`
  bottomLine.style.background = 'rgba(255, 255, 255, 0.8)'
  el.appendChild(bottomLine)
  
  // Vertical line (left)
  const leftLine = document.createElement('div')
  leftLine.style.position = 'absolute'
  leftLine.style.left = `${gap}px`
  leftLine.style.top = '50%'
  leftLine.style.transform = 'translateY(-50%)'
  leftLine.style.width = `${lineThickness}px`
  leftLine.style.height = `${lineSize}px`
  leftLine.style.background = 'rgba(255, 255, 255, 0.8)'
  el.appendChild(leftLine)
  
  // Vertical line (right)
  const rightLine = document.createElement('div')
  rightLine.style.position = 'absolute'
  rightLine.style.right = `${gap}px`
  rightLine.style.top = '50%'
  rightLine.style.transform = 'translateY(-50%)'
  rightLine.style.width = `${lineThickness}px`
  rightLine.style.height = `${lineSize}px`
  rightLine.style.background = 'rgba(255, 255, 255, 0.8)'
  el.appendChild(rightLine)
  
  container.appendChild(el)

  return {
    flash() {
      // Flash by changing opacity and adding a white glow
      el.style.transition = 'none'
      el.style.opacity = '1'
      el.style.filter = 'brightness(3) drop-shadow(0 0 4px rgba(255, 255, 255, 0.8))'
      
      // Reset after a brief moment
      setTimeout(() => {
        el.style.transition = 'opacity 0.2s ease-out, filter 0.2s ease-out'
        el.style.opacity = '1'
        el.style.filter = 'brightness(1) drop-shadow(none)'
      }, 100)
    },
  }
}

function createCheckerTexture(size: number, squares: number, colorA: string, colorB: string): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const step = size / squares
  for (let y = 0; y < squares; y++) {
    for (let x = 0; x < squares; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? colorA : colorB
      ctx.fillRect(x * step, y * step, step, step)
    }
  }
  const tex = new CanvasTexture(canvas)
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

export function applySkybox(scene: import('three').Scene): void {
  const faces: HTMLCanvasElement[] = []
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 512
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, 512)
    grad.addColorStop(0, '#8ec5ff') // sky top
    grad.addColorStop(1, '#dfefff') // sky horizon
    g.fillStyle = grad
    g.fillRect(0, 0, 512, 512)
    faces.push(c)
  }
  const cube = new CubeTexture(faces.map((c) => new CanvasTexture(c).image))
  // three expects images[] for CubeTexture; using CanvasTexture(image) ensures correct shape
  ;(cube as any).needsUpdate = true
  scene.background = cube
}


