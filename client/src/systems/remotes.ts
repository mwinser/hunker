import { Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

export type RemotePlayer = {
  id: string
  node: Group
  targetPos: Vector3
  yaw: number
  username: string
  label: CSS2DObject
}

export function createRemoteNode(username: string): { group: Group; label: CSS2DObject } {
  const g = new Group()
  const body = new Mesh(new SphereGeometry(0.35, 16, 16), new MeshStandardMaterial({ color: 0x44ff88 }))
  body.position.set(0, 0.9, 0)
  g.add(body)

  // Create username label
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
  g.add(label)

  return { group: g, label }
}

export function updateRemotes(remotes: Map<string, RemotePlayer>, snapshot: Record<string, { x: number; y: number; z: number; yaw: number; username: string }>, scene: import('three').Scene): void {
  // Ensure all snapshot players exist; remove stale ones
  const present = new Set(Object.keys(snapshot))
  for (const id of remotes.keys()) {
    if (!present.has(id)) {
      const r = remotes.get(id)!
      scene.remove(r.node)
      remotes.delete(id)
    }
  }
  for (const id of Object.keys(snapshot)) {
    const s = snapshot[id]
    if (!remotes.has(id)) {
      const { group: node, label } = createRemoteNode(s.username)
      const rp: RemotePlayer = { id, node, targetPos: new Vector3(), yaw: 0, username: s.username, label }
      remotes.set(id, rp)
      scene.add(node)
    }
    const r = remotes.get(id)!
    r.targetPos.set(s.x, s.y, s.z)
    r.yaw = s.yaw
    // Update username if it changed
    if (r.username !== s.username) {
      r.username = s.username
      r.label.element.textContent = s.username
    }
  }
}

export function simulateRemotes(remotes: Map<string, RemotePlayer>, dt: number): void {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const posLerp = Math.min(1, dt * 10)
  for (const r of remotes.values()) {
    r.node.position.set(
      lerp(r.node.position.x, r.targetPos.x, posLerp),
      lerp(r.node.position.y, r.targetPos.y, posLerp),
      lerp(r.node.position.z, r.targetPos.z, posLerp)
    )
    // Optionally rotate to yaw later
  }
}


