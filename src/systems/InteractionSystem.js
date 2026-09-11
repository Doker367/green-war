// =====================================================================
// GREEN CODE — InteractionSystem
// Detecta el objeto interactuable más cercano y gestiona la tecla [E].
// =====================================================================

import * as THREE from 'three'

export class InteractionSystem {
  constructor() {
    this.items = []
    this.current = null
    this.enabled = true
  }

  register(item) {
    // item: { id, position:Vector3|Object3D, radius, label, available(), onInteract() }
    this.items.push(item)
    return item
  }

  clear() { this.items = []; this.current = null }

  _getPos(item) {
    if (item.position.isVector3) return item.position
    const v = new THREE.Vector3()
    return item.position.getWorldPosition(v)
  }

  check(playerPos) {
    if (!this.enabled) { this.current = null; return null }
    let best = null, bestDist = Infinity
    for (const item of this.items) {
      if (item.available && !item.available()) continue
      const p = this._getPos(item)
      const d = p.distanceTo(playerPos)
      if (d < item.radius && d < bestDist) { best = item; bestDist = d }
    }
    this.current = best
    return best
  }

  trigger() {
    if (this.current) {
      this.current.onInteract()
      return true
    }
    return false
  }
}
