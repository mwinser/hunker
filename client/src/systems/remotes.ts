import { Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'

export type RemotePlayer = {
  id: string
  node: Group
  targetPos: Vector3
  yaw: number
}

export function createRemoteNode(): Group {
  const g = new Group()
  const body = new Mesh(new SphereGeometry(0.35, 16, 16), new MeshStandardMaterial({ color: 0x44ff88 }))
  body.position.set(0, 0.9, 0)
  g.add(body)
  return g
}

export function updateRemotes(remotes: Map<string, RemotePlayer>, snapshot: Record<string, { x: number; y: number; z: number; yaw: number }>, scene: import('three').Scene): void {
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
    if (!remotes.has(id)) {
      const node = createRemoteNode()
      const rp: RemotePlayer = { id, node, targetPos: new Vector3(), yaw: 0 }
      remotes.set(id, rp)
      scene.add(node)
    }
    const r = remotes.get(id)!
    const s = snapshot[id]
    r.targetPos.set(s.x, s.y, s.z)
    r.yaw = s.yaw
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


