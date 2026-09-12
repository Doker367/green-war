// =====================================================================
// GREEN CODE — Environment
// Ciclo día/noche (amanecer, tarde, atardecer, noche) + restauración.
// La noche NO queda 100% oscura: hay luz de luna, estrellas y ambiente.
// =====================================================================

import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { lerp, clamp, damp } from '../core/Utils.js'

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene
    this.renderer = renderer
    this.target = 0
    this.restoration = 0
    this.time = 0
    this._t = 0

    // --- Ciclo día/noche ---
    this.dayTime = 0.30        // 0 = medianoche, 0.25 = amanecer, 0.5 = mediodía, 0.75 = atardecer
    this.dayLength = 90        // segundos por día completo (corto para la demo)
    this.dayFactor = 1         // 1 = día, 0 = noche
    this.paused = false

    this.sunVec = new THREE.Vector3()
    this.moonVec = new THREE.Vector3()

    // --- Cielo ---
    this.sky = new Sky()
    this.sky.scale.setScalar(45000)
    scene.add(this.sky)
    const u = this.sky.material.uniforms
    u.turbidity.value = 12
    u.rayleigh.value = 2
    u.mieCoefficient.value = 0.003
    u.mieDirectionalG.value = 0.8

    // --- Luces ---
    this.sun = new THREE.DirectionalLight(0xfff2d0, 3)
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

    this.hemi = new THREE.HemisphereLight(0xbcd4e8, 0x4a3a24, 0.85)
    scene.add(this.hemi)

    this.ambient = new THREE.AmbientLight(0xffffff, 0.26)
    scene.add(this.ambient)

    // --- Niebla ---
    this.fogColor = new THREE.Color(0xc2a878)
    scene.fog = new THREE.FogExp2(this.fogColor.getHex(), 0.0038)

    // --- Estrellas y luna ---
    this._buildStars()
    this._buildMoon()

    this._apply(0, this.dayTime)
  }

  _buildStars() {
    const n = 900
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const phi = Math.acos(Math.random() * 0.9 + 0.05) // hemisferio superior
      const theta = Math.random() * Math.PI * 2
      const r = 900
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r
      pos[i * 3 + 1] = Math.cos(phi) * r
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 2.2, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false, fog: false
    })
    this.stars = new THREE.Points(geo, this.starMat)
    this.stars.frustumCulled = false
    this.scene.add(this.stars)
  }

  _buildMoon() {
    this.moonMat = new THREE.MeshBasicMaterial({
      color: 0xe6ecff, fog: false, transparent: true, opacity: 0
    })
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 14), this.moonMat)
    this.moon.frustumCulled = false
    this.scene.add(this.moon)
  }

  setRestoration(t) { this.target = clamp(t, 0, 1) }

  // Calcula las direcciones del sol y de la luna según la hora
  _updateOrbits() {
    const ang = (this.dayTime - 0.25) * Math.PI * 2
    const sinElev = Math.sin(ang)
    const elevDeg = sinElev * 70
    const azim = (this.dayTime * 360 + 90) % 360

    this.sunVec.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevDeg), THREE.MathUtils.degToRad(azim))

    // Luz direccional: sol de día, luna (opuesta y elevada) de noche
    const moonAzim = (azim + 180) % 360
    this.moonVec.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 42), THREE.MathUtils.degToRad(moonAzim))

    const dayFactor = THREE.MathUtils.smoothstep(sinElev, -0.06, 0.30)
    this.dayFactor = dayFactor
    this.sinElev = sinElev
    this.azim = azim

    const lightVec = sinElev > 0.02 ? this.sunVec : this.moonVec
    this.sun.position.copy(lightVec).multiplyScalar(160)
    this.sun.target.position.set(0, 0, 0)
  }

  _apply(restoration = this.restoration, dayTime = this.dayTime) {
    this._updateOrbits()
    const d = this.dayFactor
    const u = this.sky.material.uniforms

    // --- Cielo (día/atardecer/noche), modulado por restauración ---
    u.turbidity.value = lerp(6, lerp(12, 3, restoration), d)
    u.rayleigh.value = lerp(0.6, lerp(2.0, 1.1, restoration), d)
    u.mieCoefficient.value = lerp(0.0008, lerp(0.002, 0.0012, restoration), d)
    u.mieDirectionalG.value = 0.8
    u.sunPosition.value.copy(this.sunVec)

    // --- Color e intensidad de la luz principal ---
    const moonColor = new THREE.Color(0x9fb8e8)
    const dawnColor = new THREE.Color(0xff9a4d)
    const dayColor = new THREE.Color(0xfff4d8)
    const c = new THREE.Color()
    if (this.sinElev <= 0.02) {
      c.copy(moonColor)
    } else {
      const w = THREE.MathUtils.smoothstep(this.sinElev, 0.02, 0.38)
      c.copy(dawnColor).lerp(dayColor, w)
    }
    this.sun.color.copy(c)

    // Noche nunca 100% oscura: intensidad mínima de luna
    this.sun.intensity = lerp(0.55, 3.2, d)
    this.hemi.intensity = lerp(0.55, 1.0, d)
    this.hemi.color.setHex(lerp(0x24365e, lerp(0xc2b596, 0xa9d8ee, restoration), d))
    this.hemi.groundColor.setHex(lerp(0x0c1424, lerp(0x5a4a30, 0x3a5a30, restoration), d))
    this.ambient.intensity = lerp(0.34, 0.28, d)
    this.ambient.color.setHex(lerp(0x33456b, 0xffffff, d))

    // --- Niebla ---
    const dayFog = new THREE.Color().setHex(lerp(0xc2a878, 0xa9d8e6, restoration))
    const nightFog = new THREE.Color(0x12203a)
    this.fogColor.copy(nightFog).lerp(dayFog, d)
    this.scene.fog.color.copy(this.fogColor)
    const baseDensity = lerp(0.0038, 0.0014, restoration)
    this.scene.fog.density = baseDensity * lerp(1.15, 1.0, d)

    // --- Exposición: se sube algo de noche para no perder detalle ---
    this.renderer.toneMappingExposure = lerp(1.2, lerp(0.92, 1.06, restoration), d)

    // --- Estrellas y luna ---
    const nightAmount = clamp(1 - d * 1.25, 0, 1)
    this.starMat.opacity = nightAmount * 0.9
    this.stars.visible = this.starMat.opacity > 0.02
    this.moonMat.opacity = nightAmount
    this.moon.visible = nightAmount > 0.05
    this.moon.position.copy(this.moonVec).multiplyScalar(760)
    this.moon.lookAt(0, 0, 0)
  }

  update(dt) {
    this.time += dt

    if (!this.paused) {
      this.dayTime = (this.dayTime + dt / this.dayLength) % 1
    }

    this.restoration = damp(this.restoration, this.target, 1.2, dt)

    // Aplicar cada frame (barato): el sol se mueve continuamente
    this._apply(this.restoration, this.dayTime)
  }
}
