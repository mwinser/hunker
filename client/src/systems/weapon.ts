import { Camera, Raycaster, Vector3 } from 'three'

export type Hitscan = {
  fire: () => { origin: Vector3; hitPoint: Vector3 | null }
}

export function createHitscan(camera: Camera, targets: { getHitPoint: (rayOrigin: Vector3, rayDir: Vector3) => Vector3 | null }[]): Hitscan {
  const raycaster = new Raycaster()
  const origin = new Vector3()
  const dir = new Vector3()

  return {
    fire() {
      origin.copy((camera as any).getWorldPosition(new Vector3()))
      const forward = new Vector3(0, 0, -1)
      dir.copy(forward.applyQuaternion((camera as any).quaternion))
      raycaster.set(origin, dir)
      let best: Vector3 | null = null
      let bestDist = Infinity
      for (const t of targets) {
        const hit = t.getHitPoint(origin, dir)
        if (hit) {
          const d = hit.distanceTo(origin)
          if (d < bestDist) {
            bestDist = d
            best = hit
          }
        }
      }
      return { origin: origin.clone(), hitPoint: best }
    },
  }
}


