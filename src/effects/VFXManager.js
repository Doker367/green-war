// =====================================================================
// GREEN CODE — VFXManager
// Partículas (humo, fuego, brasas, agua, polvo, hojas) + fauna.
// Object pooling sencillo: se reutilizan los mismos buffers.
// =====================================================================

import * as THREE from 'three'
import { rand } from '../core/Utils.js'

function spriteTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, inner)
  g.addColorStop(0.4, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

class ParticleField {
  constructor(scene, opts) {
    this.count = opts.count
    this.opts = opts
    this.pos = new Float32Array(this.count * 3)
    this.vel = new Float32Array(this.count * 3)
    this.life = new Float32Array(this.count)
    this.maxLife = new Float32Array(this.count)
    this.base = new THREE.Vector3(...(opts.origin || [0, 0, 0]))
    this.radius = opts.radius || 2
    this.intensity = opts.intensity ?? 1

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.geo = geo

    const mat = new THREE.PointsMaterial({
      size: opts.size || 1.2,
      map: opts.texture,
      transparent: true,
      opacity: opts.opacity ?? 0.6,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      color: opts.color || 0xffffff,
      sizeAttenuation: true
    })
    this.mat = mat
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    scene.add(this.points)

    for (let i = 0; i < this.count; i++) this._respawn(i, true)
  }

  setOrigin(v) { this.base.copy(v) }

  _respawn(i, initial = false) {
    const { rise, spread, life } = this.opts
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * this.radius
    const i3 = i * 3
    this.pos[i3] = this.base.x + Math.cos(a) * r
    this.pos[i3 + 1] = this.base.y + (initial ? Math.random() * 4 : rand(0, 0.6))
    this.pos[i3 + 2] = this.base.z + Math.sin(a) * r
    this.vel[i3] = rand(-spread, spread)
    this.vel[i3 + 1] = rand(rise * 0.6, rise)
    this.vel[i3 + 2] = rand(-spread, spread)
    this.life[i] = initial ? Math.random() * life : 0
    this.maxLife[i] = life
  }

  update(dt) {
    const i3n = this.count * 3
    const { gravity = 0, drift = 0, grow = 0 } = this.opts
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3
      this.life[i] += dt
      if (this.life[i] >= this.maxLife[i]) {
        if (this.intensity <= 0.001) {
          this.pos[i3 + 1] = -9999
          continue
        }
        this._respawn(i)
      }
      this.vel[i3 + 1] += gravity * dt
      this.vel[i3] += Math.sin(this.life[i] * 2 + i) * drift * dt
      this.pos[i3] += this.vel[i3] * dt
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt
    }
    this.geo.attributes.position.needsUpdate = true
    this.mat.opacity = (this.opts.opacity ?? 0.6) * Math.min(1, this.intensity)
    this.points.visible = this.intensity > 0.01
  }
}

export class VFXManager {
  constructor(scene, quality = 'med') {
    this.scene = scene
    this.quality = quality
    this.fields = []
    this.fireLights = []
    this.wildlife = new THREE.Group()
    this.birds = []
    this.butterflies = []
    this.deer = []
    this._restoration = 0
    this._fireLevel = 1
    this._t = 0

    this.texSoft = spriteTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)')
    this.texSmoke = spriteTexture('rgba(120,110,100,0.9)', 'rgba(120,110,100,0)')

    this._buildFire()
    this._buildRestoration()
    scene.add(this.wildlife)
  }

  // ---------------- Incendio ----------------
  _buildFire() {
    const f = this.fields
    this.fire = new ParticleField(this.scene, {
      count: this.quality === 'low' ? 60 : 130,
      texture: this.texSoft, color: 0xff7a1a, additive: true,
      size: 2.6, opacity: 0.9, origin: [0, 0, 0], radius: 16,
      rise: 3.2, spread: 0.5, life: 1.4, drift: 0.6
    })
    this.embers = new ParticleField(this.scene, {
      count: this.quality === 'low' ? 30 : 70,
      texture: this.texSoft, color: 0xffb347, additive: true,
      size: 0.55, opacity: 1, origin: [0, 0, 0], radius: 18,
      rise: 5.5, spread: 1.4, life: 2.2, gravity: 0.4, drift: 1.2
    })
    this.smoke = new ParticleField(this.scene, {
      count: this.quality === 'low' ? 40 : 90,
      texture: this.texSmoke, color: 0x33302c, additive: false,
      size: 9, opacity: 0.5, origin: [0, 0, 0], radius: 18,
      rise: 2.2, spread: 0.9, life: 5.5, drift: 0.8
    })
    this.fields.push(this.fire, this.embers, this.smoke)

    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xff5a1a, 0, 34, 2)
      light.position.set(0, 6, 0)
      this.scene.add(light)
      this.fireLights.push(light)
    }
  }

  setFireOrigin(v) {
    this.fire.setOrigin(v)
    this.embers.setOrigin(v)
    this.smoke.setOrigin(v)
  }

  setFireLevel(level01) {
    this._fireLevel = level01
    this.fire.intensity = level01
    this.embers.intensity = level01
    this.smoke.intensity = level01
  }

  // ---------------- Restauración (hojas/agua) ----------------
  _buildRestoration() {
    this.leaves = new ParticleField(this.scene, {
      count: this.quality === 'low' ? 40 : 90,
      texture: this.texSoft, color: 0x6fbf5a, additive: false,
      size: 0.5, opacity: 0.85, origin: [0, 10, 0], radius: 55,
      rise: -0.5, spread: 0.4, life: 7, drift: 1.5
    })
    this.sparkles = new ParticleField(this.scene, {
      count: this.quality === 'low' ? 30 : 70,
      texture: this.texSoft, color: 0x9fe6bf, additive: true,
      size: 0.6, opacity: 0.9, origin: [0, 4, 0], radius: 50,
      rise: 1.2, spread: 0.5, life: 3, drift: 0.6
    })
    this.fields.push(this.leaves, this.sparkles)
    this.leaves.intensity = 0
    this.sparkles.intensity = 0
  }

  // Ráfaga de agua o polvo reutilizando un pool temporal
  burst(type, position, amount = 30) {
    const color = type === 'water' ? 0x5fd0ff : type === 'dust' ? 0xb99a6b : 0x9fe6bf
    const rise = type === 'water' ? 4 : type === 'dust' ? 3 : 2
    const field = new ParticleField(this.scene, {
      count: amount, texture: this.texSoft, color, additive: type !== 'dust',
      size: 0.7, opacity: 0.95, origin: [position.x, position.y, position.z],
      radius: 1.2, rise, spread: 2.2, life: rand(1.2, 2.0), gravity: -6, drift: 0.5
    })
    field.intensity = 1
    this._bursts = this._bursts || []
    this._bursts.push({ field, t: 0, dur: 2.2 })
  }

  // ---------------- Fauna ----------------
  registerWildlife(animals) {
    this.birds = animals.birds || []
    this.butterflies = animals.butterflies || []
    this.deer = animals.deer || []
    this.birds.forEach((b) => { b.visible = false; this.wildlife.add(b) })
    this.butterflies.forEach((b) => { b.visible = false; this.wildlife.add(b) })
    this.deer.forEach((d) => { d.visible = false; this.wildlife.add(d) })
  }

  setRestoration(t) {
    this._restoration = t
    const appear = Math.max(0, t - 0.35) / 0.65
    this.leaves.intensity = t > 0.5 ? t : 0
    this.sparkles.intensity = t > 0.6 ? (t - 0.6) / 0.4 : 0
  }

  update(dt, ecosystem) {
    this._t += dt
    for (const f of this.fields) f.update(dt)

    // Brasas / humo dependen del nivel de fuego
    if (ecosystem) {
      const fl = ecosystem.fire / 100
      this.setFireLevel(Math.max(0, fl))
      for (let i = 0; i < this.fireLights.length; i++) {
        const flick = 0.7 + Math.sin(this._t * (12 + i * 3) + i) * 0.3
        this.fireLights[i].intensity = fl * 70 * flick
      }
    }

    // Fauna
    const rest = this._restoration
    this.birds.forEach((b, i) => {
      b.visible = rest > 0.45
      if (!b.visible) return
      const r = 28 + i * 4
      const a = this._t * (0.25 + (i % 3) * 0.05) + i
      b.position.set(Math.cos(a) * r, 16 + Math.sin(this._t + i) * 2, Math.sin(a) * r - 10)
      b.rotation.y = -a + Math.PI / 2
      const flap = Math.sin(this._t * 9 + i) * 0.5
      if (b.userData.wings) {
        b.userData.wings[0].rotation.z = flap
        b.userData.wings[1].rotation.z = -flap
      }
    })
    this.butterflies.forEach((bf, i) => {
      bf.visible = rest > 0.55
      if (!bf.visible) return
      const a = this._t * (0.8 + (i % 4) * 0.2) + i * 2
      bf.position.set(
        Math.cos(a) * (4 + (i % 5) * 2) + (i % 2 ? 6 : -6),
        1.6 + Math.sin(this._t * 2 + i) * 0.6,
        Math.sin(a) * (4 + (i % 3) * 2) + 8
      )
      bf.rotation.y = -a
      const flap = Math.sin(this._t * 18 + i) * 0.9
      if (bf.userData.wings) {
        bf.userData.wings[0].rotation.y = flap
        bf.userData.wings[1].rotation.y = -flap
      }
    })
    this.deer.forEach((d, i) => {
      d.visible = rest > 0.7
      if (!d.visible) return
      const a = this._t * 0.1 + i * 2.1
      d.position.set(Math.cos(a) * 14 - 4, 0, Math.sin(a) * 14 + 10)
      d.rotation.y = -a + Math.PI / 2
      d.position.y = this.groundY ? this.groundY(d.position.x, d.position.z) : 0
    })

    // Ráfagas
    if (this._bursts) {
      for (let i = this._bursts.length - 1; i >= 0; i--) {
        const b = this._bursts[i]
        b.t += dt
        const k = 1 - b.t / b.dur
        b.field.intensity = Math.max(0, k)
        b.field.update(dt)
        if (b.t > b.dur) {
          this.scene.remove(b.field.points)
          b.field.geo.dispose()
          b.field.mat.dispose()
          this._bursts.splice(i, 1)
        }
      }
    }
  }
}
