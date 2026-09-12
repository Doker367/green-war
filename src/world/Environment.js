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

    // Variables internas para el ciclo de día y noche
    this.time = 10 // Comenzar de día
    this._c1 = new THREE.Color()
    this._c2 = new THREE.Color()
    this._c3 = new THREE.Color()
    this._cDry = new THREE.Color()
    this._cRest = new THREE.Color()

    this._apply()
  }

  setRestoration(t) { this.target = THREE.MathUtils.clamp(t, 0, 1) }

  _apply() {
    const t = this.restoration
    const sunAngle = this.time * 0.05 // Velocidad del ciclo de día/noche

    // Posición del sol (gira alrededor del eje X, inclinado un poco en Z)
    this.sunVec.set(Math.cos(sunAngle), Math.sin(sunAngle), 0.5).normalize()
    
    const u = this.sky.material.uniforms
    u.sunPosition.value.copy(this.sunVec)
    this.sun.position.copy(this.sunVec).multiplyScalar(160)

    const sunY = this.sunVec.y
    // Factores de transición suave basados en la altura del sol
    const dayFactor = THREE.MathUtils.clamp((sunY - 0.1) / 0.3, 0, 1)
    const nightFactor = THREE.MathUtils.clamp((-sunY - 0.1) / 0.3, 0, 1)
    const sunsetFactor = 1.0 - dayFactor - nightFactor

    const blendColor = (out, hexDay, hexSunset, hexNight) => {
      this._c1.setHex(hexDay).multiplyScalar(dayFactor)
      this._c2.setHex(hexSunset).multiplyScalar(sunsetFactor)
      this._c3.setHex(hexNight).multiplyScalar(nightFactor)
      out.copy(this._c1).add(this._c2).add(this._c3)
    }

    // Color del Sol
    blendColor(this._cDry, 0xffd9a0, 0xff7700, 0x1a2530)
    blendColor(this._cRest, 0xfff4d8, 0xff8c00, 0x223355)
    this.sun.color.lerpColors(this._cDry, this._cRest, t)

    // Color Hemisphere
    blendColor(this._cDry, 0xc2b596, 0x8a5a40, 0x101520)
    blendColor(this._cRest, 0xa9d8ee, 0xffa07a, 0x112233)
    this.hemi.color.lerpColors(this._cDry, this._cRest, t)

    // Color Ground
    blendColor(this._cDry, 0x5a4a30, 0x402515, 0x0a0c10)
    blendColor(this._cRest, 0x3a5a30, 0x4a3020, 0x051015)
    this.hemi.groundColor.lerpColors(this._cDry, this._cRest, t)

    // Color Niebla
    blendColor(this._cDry, 0xc2a878, 0x8a4020, 0x10151a)
    blendColor(this._cRest, 0xa9d8e6, 0xff8c60, 0x0a1018)
    this.fogColor.lerpColors(this._cDry, this._cRest, t)
    this.scene.fog.color.copy(this.fogColor)

    // Cielo: de brumoso/seco a limpio/azul
    u.turbidity.value = lerp(12, 3, t)
    u.rayleigh.value = lerp(2.0, 1.1, t)
    u.mieCoefficient.value = lerp(0.002, 0.0012, t)
    u.mieDirectionalG.value = lerp(0.82, 0.75, t)

    const getInt = (day, sunset, night) => day * dayFactor + sunset * sunsetFactor + night * nightFactor

    // Apagar el sol al cruzar el horizonte para evitar sombras invertidas
    const sunVisibility = THREE.MathUtils.clamp(sunY * 10, 0, 1)
    
    const sunIntDry = getInt(2.4, 1.5, 0.0) * sunVisibility
    const sunIntRest = getInt(3.2, 2.0, 0.0) * sunVisibility
    this.sun.intensity = lerp(sunIntDry, sunIntRest, t)

    const hemiIntDry = getInt(0.78, 0.5, 0.2)
    const hemiIntRest = getInt(1.02, 0.6, 0.3)
    this.hemi.intensity = lerp(hemiIntDry, hemiIntRest, t)

    const ambIntDry = getInt(0.24, 0.1, 0.05)
    const ambIntRest = getInt(0.32, 0.15, 0.08)
    this.ambient.intensity = lerp(ambIntDry, ambIntRest, t)

    // Densidad de niebla
    this.scene.fog.density = lerp(0.0038, 0.0014, t)

    // Exposición / grading
    const expDry = getInt(0.92, 0.85, 0.6)
    const expRest = getInt(1.06, 0.95, 0.7)
    this.renderer.toneMappingExposure = lerp(expDry, expRest, t)
  }

  update(dt) {
    this.restoration = damp(this.restoration, this.target, 1.2, dt)
    this.time += dt
    this._apply()
  }
}
