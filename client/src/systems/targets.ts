import { Box3, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, Ray } from 'three'

export type Target = Mesh

export function createTargets(): Target[] {
  const targets: Target[] = []
  for (let i = 0; i < 6; i++) {
    const m = new Mesh(new SphereGeometry(0.25, 16, 16), new MeshStandardMaterial({ color: 0xff4444 }))
    const x = -6 + i * 2.4
    m.position.set(x, 1.2, -6 - i * 2)
    targets.push(m)
  }
  return targets
}

export function makeHitscanAdapter(meshes: Target[]) {
  const box = new Box3()
  const closest = new Vector3()
  const tmp = new Vector3()
  const ray = new Ray()
  return {
    getHitPoint(origin: Vector3, dir: Vector3) {
      let best: Vector3 | null = null
      let bestDist = Infinity
      ray.origin.copy(origin)
      ray.direction.copy(dir)
      for (const m of meshes) {
        box.setFromObject(m)
        const hit = ray.intersectBox(box, closest)
        if (hit) {
          const d = hit.distanceTo(origin)
          if (d < bestDist) {
            bestDist = d
            best = tmp.copy(hit)
          }
        }
      }
      return best ? best.clone() : null
    },
  }
}


