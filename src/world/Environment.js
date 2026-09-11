// =====================================================================
// GREEN CODE — Environment
// Cielo, sol, niebla, iluminación y color grading dinámico.
// Interpola del estado "seco/contaminado" al "restaurado".
// =====================================================================

import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { lerp, damp } from '../core/Utils.js'

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene
    this.renderer = renderer
    this.target = 0
    this.restoration = 0
    this.time = 0
    this._t = 0

    // --- Cielo ---
    this.sky = new Sky()
    this.sky.scale.setScalar(45000)
    scene.add(this.sky)
    const u = this.sky.material.uniforms
    u.turbidity.value = 16
    u.rayleigh.value = 3
    u.mieCoefficient.value = 0.006
    u.mieDirectionalG.value = 0.8
    this.sunVec = new THREE.Vector3()

    // --- Luces ---
    this.sun = new THREE.DirectionalLight(0xffcf8a, 2.2)
    this.sun.position.set(60, 80, 30)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const s = 120
    this.sun.shadow.camera.left = -s
    this.sun.shadow.camera.right = s
    this.sun.shadow.camera.top = s
    this.sun.shadow.camera.bottom = -s
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 400
    this.sun.shadow.bias = -0.0006
    scene.add(this.sun)
    scene.add(this.sun.target)

    this.hemi = new THREE.HemisphereLight(0x9bb8c8, 0x4a3a24, 0.55)
    scene.add(this.hemi)

    this.ambient = new THREE.AmbientLight(0xffffff, 0.18)
    scene.add(this.ambient)

    // --- Niebla ---
    this.fogColor = new THREE.Color(0x9a8a6e)
    scene.fog = new THREE.FogExp2(this.fogColor.getHex(), 0.006)

    this._apply(0)
  }

  setRestoration(t) { this.target = THREE.MathUtils.clamp(t, 0, 1) }

  _apply(t) {
    const u = this.sky.material.uniforms
    // Cielo: de brumoso/seco a limpio/azul
    u.turbidity.value = lerp(12, 3, t)
    u.rayleigh.value = lerp(2.0, 1.1, t)
    u.mieCoefficient.value = lerp(0.002, 0.0012, t)
    u.mieDirectionalG.value = lerp(0.82, 0.75, t)

    // Posición del sol: bajo y cálido -> alto y brillante
    const elev = lerp(26, 50, t)
    const azim = 155
    const phi = THREE.MathUtils.degToRad(90 - elev)
    const theta = THREE.MathUtils.degToRad(azim)
    this.sunVec.setFromSphericalCoords(1, phi, theta)
    u.sunPosition.value.copy(this.sunVec)
    this.sun.position.copy(this.sunVec).multiplyScalar(160)

    // Luz
    this.sun.color.setHex(lerp(0xffd9a0, 0xfff4d8, t))
    this.sun.intensity = lerp(2.4, 3.2, t)
    this.hemi.intensity = lerp(0.78, 1.02, t)
    this.hemi.color.setHex(lerp(0xc2b596, 0xa9d8ee, t))
    this.hemi.groundColor.setHex(lerp(0x5a4a30, 0x3a5a30, t))
    this.ambient.intensity = lerp(0.24, 0.32, t)

    // Niebla
    this.fogColor.setHex(lerp(0xc2a878, 0xa9d8e6, t))
    this.scene.fog.color.copy(this.fogColor)
    this.scene.fog.density = lerp(0.0038, 0.0014, t)

    // Exposición / grading
    this.renderer.toneMappingExposure = lerp(0.92, 1.06, t)
  }

  update(dt) {
    this.restoration = damp(this.restoration, this.target, 1.2, dt)
    if (Math.abs(this.restoration - this.target) > 0.001) {
      this._apply(this.restoration)
      this._dirty = true
    } else if (this._dirty) {
      this._apply(this.target)
      this._dirty = false
    }
    // Parpadeo suave del sol
    this.time += dt
  }
}
