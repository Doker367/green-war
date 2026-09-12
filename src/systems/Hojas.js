import * as THREE from 'three'

export class Hojas {
  constructor(scene) {
    this.scene = scene
    this.dotGeometry = new THREE.SphereGeometry(0.12, 6, 4)
    this.leafGeometry = new THREE.IcosahedronGeometry(0.16, 0)
    this.falling = []
  }

  apply(tree, type, severity) {
    const state = tree.userData.pestState || { severity: -1, overlays: [] }
    if (severity <= state.severity) return
    state.severity = severity
    tree.userData.pestState = state

    if (type.id === 'small') this._addSpots(tree, state)
    if (type.id === 'medium') this._addCracks(tree, state)
    if (type.id === 'large') this._addSevereDamage(tree, state)
  }

  _addSpots(tree, state) {
    const overlay = new THREE.Group()
    const material = new THREE.MeshBasicMaterial({ color: 0x080808 })
    for (let i = 0; i < 14; i++) {
      const dot = new THREE.Mesh(this.dotGeometry, material)
      const angle = (i / 14) * Math.PI * 2
      dot.position.set(Math.cos(angle) * 1.2, 3.8 + (i % 4) * 0.35, Math.sin(angle) * 1.2)
      overlay.add(dot)
    }
    tree.add(overlay)
    state.overlays.push(overlay)
  }

  _addCracks(tree, state) {
    const overlay = new THREE.Group()
    const material = new THREE.LineBasicMaterial({ color: 0x17120f })
    for (let i = 0; i < 3; i++) {
      const x = -0.32 + i * 0.32
      const points = [
        new THREE.Vector3(x, 0.5, 0.3),
        new THREE.Vector3(x + 0.16, 1.2, 0.31),
        new THREE.Vector3(x - 0.08, 1.9, 0.31),
        new THREE.Vector3(x + 0.1, 2.5, 0.31)
      ]
      overlay.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material))
    }
    tree.add(overlay)
    state.overlays.push(overlay)
  }

  _addSevereDamage(tree, state) {
    const overlay = new THREE.Group()
    const material = new THREE.MeshBasicMaterial({ color: 0x070707 })
    const bounds = new THREE.Box3().setFromObject(tree)
    for (let i = 0; i < 18; i++) {
      const leaf = new THREE.Mesh(this.leafGeometry, material)
      leaf.position.set(
        bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x),
        bounds.max.y - Math.random() * 1.2,
        bounds.min.z + Math.random() * (bounds.max.z - bounds.min.z)
      )
      this.scene.add(leaf)
      this.falling.push({
        leaf,
        velocity: new THREE.Vector3(
          THREE.MathUtils.randFloat(-0.5, 0.5),
          THREE.MathUtils.randFloat(-2.2, -0.8),
          THREE.MathUtils.randFloat(-0.5, 0.5)
        ),
        life: 2.5
      })
    }
    tree.traverse((object) => {
      if (object.userData.isLeaf) object.visible = false
      if (object.isMesh && object.material && object.material.color) {
        object.material = object.material.clone()
        object.material.color.setHex(0x101010)
      }
    })
    tree.add(overlay)
    state.overlays.push(overlay)
  }

  update(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const leaf = this.falling[i]
      leaf.life -= dt
      leaf.velocity.y -= 3.5 * dt
      leaf.leaf.position.addScaledVector(leaf.velocity, dt)
      leaf.leaf.rotation.x += dt * 3
      leaf.leaf.rotation.z += dt * 2
      if (leaf.life <= 0) {
        this.scene.remove(leaf.leaf)
        this.falling.splice(i, 1)
      }
    }
  }
}