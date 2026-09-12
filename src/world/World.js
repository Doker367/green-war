// =====================================================================
// GREEN CODE — World
// Refugio (con cofres), río contaminado, zona incendiada, zona de
// reforestación y búnker de semillas. Balizas para orientarse.
// =====================================================================

import * as THREE from 'three'
import { terrainHeight, rand, makeRandom, RIVER_Z, RIVER_HALF, RIVER_BED, lerp, clamp } from '../core/Utils.js'

export const ZONES = {
  refugio: new THREE.Vector3(0, 0, 22),
  water: new THREE.Vector3(18, 0, -50),   // estación de filtración (orilla)
  fire: new THREE.Vector3(82, 0, -14),
  reforest: new THREE.Vector3(-34, 0, 84),
  bunker: new THREE.Vector3(-90, 0, 30)
}

// Montaña irregular (sin costuras porque el ruido depende de la posición)
function makeMountainGeo(seed) {
  const geo = new THREE.ConeGeometry(1, 1, 10, 6)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 1e-4) continue
    const n =
      Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 - seed) * 0.5 +
      Math.sin((x + z) * 4.3 + seed) * 0.5
    const ridge = Math.sin(y * 9 + seed) * 0.05
    const f = 1 + n * 0.22 + ridge
    pos.setX(i, x * f)
    pos.setZ(i, z * f)
    pos.setY(i, y + (Math.sin(x * 5 + seed) * 0.5 + 0.5) * 0.05)
  }
  geo.computeVertexNormals()
  return geo
}

// Textura de normales para el agua (rizado), generada en canvas
function makeWaterNormalTexture(size = 128) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const h = (x, y) =>
    Math.sin(x * 0.18) * 0.5 + Math.sin(y * 0.22 + x * 0.05) * 0.5 +
    Math.sin((x + y) * 0.09) * 0.4
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y)
      const dy = h(x, y + 1) - h(x, y - 1)
      const nz = 1
      const len = Math.hypot(-dx, -dy, nz)
      const i = (y * size + x) * 4
      img.data[i] = (-dx / len * 0.5 + 0.5) * 255
      img.data[i + 1] = (-dy / len * 0.5 + 0.5) * 255
      img.data[i + 2] = (nz / len * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(16, 2)
  return t
}

export class World {
  constructor(scene, assets, vfx) {
    this.scene = scene
    this.assets = assets
    this.vfx = vfx
    this.rand = makeRandom(20260211)
    this.groups = {}
    this.zones = {}
    this.aliveTrees = []
    this.beacons = {}
    this.colliders = []
    this._restoration = 0
    this._waterClean = 0

    this._buildTerrain()
    this._buildRiver()
    this._buildPaths()
    this._buildRefugio()
    this._buildBunker()
    this._buildWaterStation()
    this._buildFireZone()
    this._buildReforestZone()
    this._scatterNaturals()
    this._buildWildlife()
    this._buildBoundary()
    this._buildBeacons()
  }

  getHeight(x, z) { return terrainHeight(x, z) + 0.02 }

  // =====================================================================
  //  COLISIONES (AABB en XZ, con rango vertical)
  // =====================================================================
  addCollider(minX, minZ, maxX, maxZ, minY = -9999, maxY = 9999) {
    this.colliders.push({ minX, minZ, maxX, maxZ, minY, maxY })
  }

  // Empuja un círculo (posición, radio) fuera de los colisionadores
  resolveCollisions(pos, radius) {
    for (const c of this.colliders) {
      if (pos.y > c.maxY || pos.y + 1.7 < c.minY) continue
      const cx = clamp(pos.x, c.minX, c.maxX)
      const cz = clamp(pos.z, c.minZ, c.maxZ)
      const dx = pos.x - cx
      const dz = pos.z - cz
      const d2 = dx * dx + dz * dz
      if (d2 >= radius * radius) continue
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2)
        const push = (radius - d) / d
        pos.x += dx * push
        pos.z += dz * push
      } else {
        // Centro dentro de la caja: salir por la cara más cercana
        const left = pos.x - c.minX
        const right = c.maxX - pos.x
        const back = pos.z - c.minZ
        const front = c.maxZ - pos.z
        const m = Math.min(left, right, back, front)
        if (m === left) pos.x = c.minX - radius
        else if (m === right) pos.x = c.maxX + radius
        else if (m === back) pos.z = c.minZ - radius
        else pos.z = c.maxZ + radius
      }
    }
  }

  // =====================================================================
  //  TERRENO
  // =====================================================================
  _buildTerrain() {
    const size = 300, seg = 130
    const geo = new THREE.PlaneGeometry(size, size, seg, seg)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    this._terrainPatch = new Float32Array(pos.count)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      pos.setY(i, terrainHeight(x, z))
      this._terrainPatch[i] = (Math.sin(x * 0.12) + Math.sin(z * 0.14) + Math.sin((x + z) * 0.07) + 3) / 6
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    this.terrainGeo = geo
    this.terrainPos = pos

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
    this.terrain = new THREE.Mesh(geo, mat)
    this.terrain.receiveShadow = true
    this.scene.add(this.terrain)

    this._dry = [new THREE.Color(0x8a6f4a), new THREE.Color(0xa78a5c), new THREE.Color(0x6f5a3c)]
    this._lush = [new THREE.Color(0x4f8a3f), new THREE.Color(0x5fa348), new THREE.Color(0x3d7434)]
    this._applyTerrainColors(0)
  }

  _applyTerrainColors(t) {
    const colors = this.terrainGeo.attributes.color
    const c = new THREE.Color()
    const patch = this._terrainPatch
    for (let i = 0; i < colors.count; i++) {
      const p = patch[i]
      const threshold = 0.28 + p * 0.6
      const local = THREE.MathUtils.smoothstep(t, threshold - 0.25, threshold + 0.1)
      c.copy(this._dry[i % 3]).lerp(this._lush[i % 3], local)
      const v = 0.92 + ((i * 9301 + 49297) % 233280) / 233280 * 0.16
      colors.setXYZ(i, c.r * v, c.g * v, c.b * v)
    }
    colors.needsUpdate = true
  }

  setRestoration(t) {
    if (Math.abs(t - this._restoration) < 0.01) return
    this._restoration = t
    this._applyTerrainColors(t)
  }

  // =====================================================================
  //  RÍO CONTAMINADO
  // =====================================================================
  _buildRiver() {
    const geo = new THREE.PlaneGeometry(280, RIVER_HALF * 2, 40, 4)
    geo.rotateX(-Math.PI / 2)
    this.riverMat = new THREE.MeshStandardMaterial({
      color: 0x3f4a22, roughness: 0.5, metalness: 0.1,
      transparent: true, opacity: 0.96,
      emissive: 0x1a2408, emissiveIntensity: 0.6
    })
    this.waterNormal = makeWaterNormalTexture(128)
    this.riverMat.normalMap = this.waterNormal
    this.riverMat.normalScale.set(0.7, 0.7)
    this.river = new THREE.Mesh(geo, this.riverMat)
    this.river.position.set(0, RIVER_BED + 1.25, RIVER_Z)
    this.river.receiveShadow = true
    this.scene.add(this.river)
    this._riverBaseY = RIVER_BED + 1.25

    // Espuma en las orillas
    this.foamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.1,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
    for (const side of [-1, 1]) {
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(280, 1.6), this.foamMat)
      foam.rotation.x = -Math.PI / 2
      foam.position.set(0, this._riverBaseY + 0.05, RIVER_Z + side * (RIVER_HALF - 1.4))
      this.scene.add(foam)
    }

    // Manchas de contaminación (desaparecen al filtrar)
    this.sludge = []
    const sludgeMat = new THREE.MeshStandardMaterial({
      color: 0x2a3212, roughness: 0.6, transparent: true, opacity: 0.75, depthWrite: false
    })
    const rs = makeRandom(3301)
    for (let i = 0; i < 14; i++) {
      const blob = new THREE.Mesh(new THREE.CircleGeometry(rand(1.5, 3.6), 12), sludgeMat.clone())
      blob.rotation.x = -Math.PI / 2
      blob.position.set(-130 + rs() * 260, this._riverBaseY + 0.04, RIVER_Z + (rs() - 0.5) * RIVER_HALF)
      this.scene.add(blob)
      this.sludge.push(blob)
    }

    // Escombros / bidones abandonados (contaminación)
    for (let i = 0; i < 7; i++) {
      const x = rand(-120, 120)
      const side = Math.random() < 0.5 ? -1 : 1
      const z = RIVER_Z + side * (RIVER_HALF - 2)
      const obj = this.assets.get(Math.random() < 0.5 ? 'barrel' : 'crate')
      obj.position.set(x, this._riverBaseY - 0.2, z)
      obj.rotation.y = rand(0, Math.PI)
      this.scene.add(obj)
    }

    // Vegetación muerta / piedras en las orillas
    const g = new THREE.Group()
    const rng = makeRandom(5150)
    for (let i = 0; i < 40; i++) {
      const x = rand(-135, 135)
      const side = rng() < 0.5 ? -1 : 1
      const z = RIVER_Z + side * (RIVER_HALF + rng() * 6)
      const y = terrainHeight(x, z)
      const obj = this.assets.get(rng() < 0.4 ? 'rock' : rng() < 0.7 ? 'bush' : 'tree_dead')
      obj.position.set(x, y, z)
      obj.scale.setScalar(rand(0.6, 1.5))
      g.add(obj)
    }
    this.scene.add(g)
    this.groups.river = g
    this.zones.river = { z: RIVER_Z, pos: new THREE.Vector3(0, this._riverBaseY, RIVER_Z) }
  }

  setWaterClean(t) {
    this._waterClean = t
    const murky = new THREE.Color(0x3f4a22)
    const clean = new THREE.Color(0x2f86b5)
    this.riverMat.color.copy(murky).lerp(clean, t)
    this.riverMat.emissive.setHex(0x0a2a3a)
    this.riverMat.emissiveIntensity = lerp(0.6, 0.6, t)
    this.riverMat.opacity = lerp(0.96, 0.86, t)
    this.riverMat.roughness = lerp(0.5, 0.16, t)
    this.riverMat.metalness = lerp(0.1, 0.22, t)
    this.riverMat.normalScale.set(lerp(0.7, 0.35, t), lerp(0.7, 0.35, t))
    if (this.sludge) {
      for (const b of this.sludge) b.material.opacity = 0.75 * (1 - t)
    }
  }

  // =====================================================================
  //  CAMINOS
  // =====================================================================
  _buildPaths() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xb09363, roughness: 1 })
    const g = new THREE.Group()
    const routes = [
      [ZONES.refugio, ZONES.water],
      [ZONES.refugio, ZONES.fire],
      [ZONES.refugio, ZONES.reforest],
      [ZONES.refugio, ZONES.bunker]
    ]
    for (const [a, b] of routes) {
      const dir = new THREE.Vector3().subVectors(b, a)
      const len = dir.length()
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(len, 3.2), mat)
      plane.rotation.x = -Math.PI / 2
      plane.rotation.z = -Math.atan2(dir.z, dir.x)
      const mid = a.clone().add(b).multiplyScalar(0.5)
      plane.position.set(mid.x, terrainHeight(mid.x, mid.z) + 0.06, mid.z)
      plane.receiveShadow = true
      g.add(plane)
    }
    this.scene.add(g)
    this.groups.paths = g
  }

  // =====================================================================
  //  REFUGIO
  // =====================================================================
  _buildRefugio() {
    const g = new THREE.Group()
    const c = ZONES.refugio
    const base = terrainHeight(c.x, c.z)

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7a64, roughness: 0.95, flatShading: true })
    const wallDark = new THREE.MeshStandardMaterial({ color: 0x6b5d4a, roughness: 1, flatShading: true })
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x9a8a70, roughness: 0.95 })
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.9, flatShading: true })
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8, metalness: 0.2 })

    const W = 11, D = 8, H = 3.2
    // Piso
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, D), floorMat)
    floor.position.set(c.x, base - 0.05, c.z)
    floor.receiveShadow = true
    g.add(floor)

    const wall = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat)
      m.position.set(c.x + x, base + H / 2, c.z + z)
      m.castShadow = m.receiveShadow = true
      g.add(m)
    }
    // Paredes laterales y trasera
    wall(-W / 2, 0, 0.3, D)
    wall(W / 2, 0, 0.3, D)
    wall(0, -D / 2, W, 0.3)
    // Frente con hueco de puerta
    wall(-3.5, D / 2, 4, 0.3)
    wall(3.5, D / 2, 4, 0.3)
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.3), wallMat)
    lintel.position.set(c.x, base + H - 0.4, c.z + D / 2)
    g.add(lintel)

    // Techo
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.35, D + 1), roofMat)
    roof.position.set(c.x, base + H + 0.15, c.z)
    roof.castShadow = roof.receiveShadow = true
    g.add(roof)

    // Puerta entreabierta
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.15), doorMat)
    door.position.set(c.x - 1.6, base + 1.2, c.z + D / 2 + 0.05)
    door.rotation.y = -0.9
    door.castShadow = true
    g.add(door)

    // ---- Interior ----
    // Cama
    const bed = new THREE.Group()
    const bedBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 2.2), wallDark)
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x3f6b8a, roughness: 1 }))
    mattress.position.y = 0.35
    bed.add(bedBase, mattress)
    bed.position.set(c.x - 4, base + 0.25, c.z - 2.4)
    g.add(bed)

    // Mesa
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 1), wallDark)
    table.position.set(c.x + 3.6, base + 0.9, c.z - 2.6)
    table.castShadow = true
    g.add(table)
    for (const [dx, dz] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), wallDark)
      leg.position.set(c.x + 3.6 + dx, base + 0.45, c.z - 2.6 + dz)
      g.add(leg)
    }

    // Lámpara interior (encendida al entrar)
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffcf6a, emissiveIntensity: 0.2 })
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), lampMat)
    lamp.position.set(c.x, base + H - 0.5, c.z)
    g.add(lamp)
    const light = new THREE.PointLight(0xffcf8a, 0, 18, 2)
    light.position.set(c.x, base + H - 0.6, c.z)
    g.add(light)

    // Radio / utilería
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.6, metalness: 0.3 }))
    radio.position.set(c.x + 3.6, base + 1.1, c.z - 2.6)
    g.add(radio)

    // ---- Cofres ----
    const chestDefs = [
      { kind: 'wood', x: -3.0, z: -3.4, loot: 'suministros' },
      { kind: 'metal', x: -1.2, z: -3.6, loot: 'herramientas' },
      { kind: 'rusty', x: 0.7, z: -3.4, loot: 'mapa' }
    ]
    const chests = []
    chestDefs.forEach((def) => {
      const chest = this.assets.get('chest')
      chest.position.set(c.x + def.x, base + 0.1, c.z + def.z)
      chest.rotation.y = Math.PI
      chest.userData.kind = def.kind
      chest.userData.loot = def.loot
      chest.userData.opened = false
      g.add(chest)
      chests.push(chest)
    })

    // Señal exterior
    const sign = this.assets.get('sign')
    sign.position.set(c.x + 6.5, base, c.z + 5)
    sign.rotation.y = -0.5
    g.add(sign)

    this.scene.add(g)
    this.groups.refugio = g
    // Colisionadores de las paredes (la puerta queda libre)
    const top = base + H
    const t = 0.2
    this.addCollider(c.x - W / 2 - t, c.z - D / 2, c.x - W / 2 + t, c.z + D / 2, base, top)
    this.addCollider(c.x + W / 2 - t, c.z - D / 2, c.x + W / 2 + t, c.z + D / 2, base, top)
    this.addCollider(c.x - W / 2, c.z - D / 2 - t, c.x + W / 2, c.z - D / 2 + t, base, top)
    this.addCollider(c.x - W / 2, c.z + D / 2 - t, c.x - 1.5, c.z + D / 2 + t, base, top)
    this.addCollider(c.x + 1.5, c.z + D / 2 - t, c.x + W / 2, c.z + D / 2 + t, base, top)
    this.zones.refugio = {
      pos: c,
      base,
      size: { W, D, H },
      inside: new THREE.Vector3(c.x, base, c.z),
      chests,
      lampMat,
      light,
      insideRadius: 4.8
    }
  }

  // =====================================================================
  //  BÚNKER DE SEMILLAS
  // =====================================================================
  _buildBunker() {
    const g = new THREE.Group()
    const c = ZONES.bunker
    const base = terrainHeight(c.x, c.z)
    const concrete = new THREE.MeshStandardMaterial({ color: 0x8a8f88, roughness: 0.95, flatShading: true })
    const dark = new THREE.MeshStandardMaterial({ color: 0x4a4f4a, roughness: 1, flatShading: true })
    const metal = new THREE.MeshStandardMaterial({ color: 0x6b7078, roughness: 0.4, metalness: 0.7 })

    const bunker = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 7), concrete)
    bunker.position.set(c.x, base + 1.0, c.z)
    bunker.castShadow = bunker.receiveShadow = true
    g.add(bunker)
    // Entrada inclinada
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 5), dark)
    ramp.position.set(c.x, base + 0.2, c.z + 5.5)
    ramp.rotation.x = 0.25
    g.add(ramp)
    // Escotilla
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 16), metal)
    hatch.position.set(c.x, base + 2.75, c.z)
    g.add(hatch)
    // Antena
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), metal)
    antenna.position.set(c.x + 3.2, base + 4.5, c.z - 2.2)
    g.add(antenna)
    const beaconLight = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x45e0d8, emissiveIntensity: 2 }))
    beaconLight.position.set(c.x + 3.2, base + 6.5, c.z - 2.2)
    g.add(beaconLight)

    // Cajas alrededor
    for (let i = 0; i < 4; i++) {
      const cr = this.assets.get('crate')
      cr.position.set(c.x - 5 + i * 0.9, base + terrainHeight(c.x - 5 + i * 0.9, c.z + 4) - base, c.z + 4)
      g.add(cr)
    }

    this.scene.add(g)
    this.groups.bunker = g
    this.zones.bunker = { pos: c, base, hatch }
    this.addCollider(c.x - 4.6, c.z - 3.6, c.x + 4.6, c.z + 3.6, base, base + 2.9)
  }

  // =====================================================================
  //  ESTACIÓN DE FILTRACIÓN (orilla del río)
  // =====================================================================
  _buildWaterStation() {
    const g = new THREE.Group()
    const c = ZONES.water
    c.y = terrainHeight(c.x, c.z)
    const base = c.y

    // Plataforma junto al río
    const platform = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x7a6a52, roughness: 1, flatShading: true }))
    platform.position.set(c.x, base + 0.2, c.z)
    platform.receiveShadow = true
    g.add(platform)

    // Tanque de filtración
    const tank = this.assets.get('water_tank')
    tank.position.set(c.x - 2.5, base + 0.4, c.z - 1)
    tank.scale.setScalar(0.8)
    g.add(tank)

    // Panel de control
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.5, metalness: 0.4 }))
    panel.position.set(c.x + 2.8, base + 1.1, c.z + 1)
    panel.castShadow = true
    g.add(panel)
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x0a1a14, emissive: 0x35e07a, emissiveIntensity: 0.8 })
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.05), screenMat)
    screen.position.set(c.x + 2.8, base + 1.5, c.z + 1.18)
    g.add(screen)

    // Tuberías de succión hacia el río
    for (let i = 0; i < 4; i++) {
      const pipe = this.assets.get('pipe_segment')
      pipe.position.set(c.x - 3 + i * 2.2, base + 0.5, c.z - 4.5)
      pipe.rotation.y = 0
      g.add(pipe)
    }
    const barrel = this.assets.get('barrel')
    barrel.position.set(c.x + 3.5, base + 0.55, c.z - 2)
    g.add(barrel)

    this.scene.add(g)
    this.groups.water = g
    this.zones.water = { pos: c, base, tank, panel, screenMat }
  }

  // =====================================================================
  //  ZONA DE INCENDIO
  // =====================================================================
  _buildFireZone() {
    const g = new THREE.Group()
    const c = ZONES.fire
    const rng = makeRandom(777)
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2
      const r = Math.sqrt(rng()) * 20
      const x = c.x + Math.cos(a) * r
      const z = c.z + Math.sin(a) * r
      const t = this.assets.get('tree_burnt')
      t.position.set(x, terrainHeight(x, z), z)
      t.rotation.y = rng() * Math.PI * 2
      t.scale.setScalar(rand(0.9, 1.7))
      g.add(t)
    }
    for (let i = 0; i < 5; i++) {
      const x = c.x + rand(-16, 16), z = c.z + rand(-16, 16)
      const rock = this.assets.get('rock')
      rock.position.set(x, terrainHeight(x, z), z)
      g.add(rock)
    }
    const towers = []
    const towerPositions = [
      new THREE.Vector3(c.x - 15, 0, c.z - 13),
      new THREE.Vector3(c.x + 15, 0, c.z - 13),
      new THREE.Vector3(c.x, 0, c.z + 16)
    ]
    towerPositions.forEach((p) => {
      const tower = this.assets.get('tower')
      p.y = terrainHeight(p.x, p.z)
      tower.position.copy(p)
      g.add(tower)
      towers.push(tower)
    })
    const crate = this.assets.get('crate')
    crate.position.set(c.x + 6, terrainHeight(c.x + 6, c.z + 8), c.z + 8)
    g.add(crate)

    this.scene.add(g)
    this.groups.fire = g
    this.zones.fire = { pos: c, towers, firePos: new THREE.Vector3(c.x, 0.5, c.z) }
    if (this.vfx) this.vfx.setFireOrigin(new THREE.Vector3(c.x, 0.5, c.z))
  }

  // =====================================================================
  //  ZONA DE REFORESTACIÓN
  // =====================================================================
  _buildReforestZone() {
    const g = new THREE.Group()
    const c = ZONES.reforest
    const rng = makeRandom(4242)
    const spots = []
    const layout = []
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        if (layout.length >= 10) break
        layout.push({ x: c.x - 9 + col * 6, z: c.z - 6 + row * 6 })
      }
    }
    layout.forEach((p) => {
      const y = terrainHeight(p.x, p.z)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.25, 24),
        new THREE.MeshBasicMaterial({ color: 0x35e07a, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.set(p.x, y + 0.06, p.z)
      g.add(ring)
      const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6),
        new THREE.MeshBasicMaterial({ color: 0x35e07a }))
      marker.position.set(p.x, y + 0.4, p.z)
      g.add(marker)
      spots.push({ pos: new THREE.Vector3(p.x, y, p.z), ring, marker, tree: null })
    })
    for (let i = 0; i < 8; i++) {
      const a = rng() * Math.PI * 2
      const r = 14 + rng() * 10
      const x = c.x + Math.cos(a) * r
      const z = c.z + Math.sin(a) * r
      const t = this.assets.get('tree_dead')
      t.position.set(x, terrainHeight(x, z), z)
      t.scale.setScalar(rand(1.1, 1.8))
      g.add(t)
    }
    for (let i = 0; i < 4; i++) {
      const x = c.x + rand(-18, 18), z = c.z + rand(-16, 16)
      const cact = this.assets.get('cactus')
      cact.position.set(x, terrainHeight(x, z), z)
      g.add(cact)
    }
    this.scene.add(g)
    this.groups.reforest = g
    this.zones.reforest = { pos: c, spots }
  }

  // =====================================================================
  //  NATURALEZA DISPERSA
  // =====================================================================
  _scatterNaturals() {
    const rng = makeRandom(99)
    const g = new THREE.Group()
    const dead = new THREE.Group()
    this.scene.add(g, dead)

    const avoid = (x, z) =>
      Math.hypot(x - ZONES.refugio.x, z - ZONES.refugio.z) < 16 ||
      Math.hypot(x - ZONES.reforest.x, z - ZONES.reforest.z) < 20 ||
      Math.abs(z - RIVER_Z) < RIVER_HALF + 6

    for (let i = 0; i < 46; i++) {
      const x = rand(-130, 130), z = rand(-130, 130)
      if (avoid(x, z)) continue
      const y = terrainHeight(x, z)
      const t = this.assets.get(rng() < 0.45 ? 'tree_dead' : 'tree_alive')
      t.position.set(x, y, z)
      t.scale.setScalar(rand(1.0, 2.0))
      t.rotation.y = rng() * Math.PI * 2
      if (rng() < 0.5) {
        const threshold = 0.25 + rng() * 0.6
        t.visible = false
        this.aliveTrees.push({ obj: t, threshold })
        g.add(t)
      } else {
        dead.add(t)
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = rand(-135, 135), z = rand(-135, 135)
      if (avoid(x, z)) continue
      const y = terrainHeight(x, z)
      const b = this.assets.get(rng() < 0.5 ? 'bush' : 'rock')
      b.position.set(x, y, z)
      b.scale.setScalar(rand(0.6, 1.4))
      dead.add(b)
    }

    const bladeGeo = new THREE.ConeGeometry(0.09, 0.7, 4)
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x4f9a3f, roughness: 1, flatShading: true, transparent: true, opacity: 0 })
    const count = 3000
    const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, count)
    const dummy = new THREE.Object3D()
    let placed = 0
    for (let i = 0; i < count * 2 && placed < count; i++) {
      const x = rand(-140, 140), z = rand(-140, 140)
      if (Math.hypot(x - ZONES.fire.x, z - ZONES.fire.z) < 24) continue
      if (avoid(x, z)) continue
      const y = terrainHeight(x, z)
      dummy.position.set(x, y + 0.3, z)
      dummy.scale.setScalar(rand(0.6, 1.6))
      dummy.rotation.y = rand(0, Math.PI)
      dummy.updateMatrix()
      grass.setMatrixAt(placed++, dummy.matrix)
    }
    grass.count = placed
    grass.instanceMatrix.needsUpdate = true
    this.grass = grass
    this.grassMat = bladeMat
    this.scene.add(grass)
    this.aliveGroup = g
  }

  // =====================================================================
  //  FAUNA
  // =====================================================================
  _buildWildlife() {
    const birds = []
    for (let i = 0; i < 6; i++) {
      const b = this.assets.get('bird')
      b.scale.setScalar(rand(1.2, 2))
      birds.push(b)
    }
    const butterflies = []
    for (let i = 0; i < 10; i++) {
      const bf = new THREE.Group()
      const wingMat = new THREE.MeshStandardMaterial({
        color: [0xffb347, 0xff6f91, 0x6fd0ff, 0xffe066][i % 4],
        emissive: 0x222222, emissiveIntensity: 0.4, side: THREE.DoubleSide, roughness: 0.7
      })
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.45), wingMat)
      const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.45), wingMat)
      w1.position.x = -0.18; w2.position.x = 0.18
      bf.add(w1, w2)
      bf.userData.wings = [w1, w2]
      butterflies.push(bf)
    }
    const deer = []
    for (let i = 0; i < 2; i++) {
      const d = this.assets.get('deer')
      d.scale.setScalar(rand(1.1, 1.4))
      deer.push(d)
    }
    if (this.vfx) {
      this.vfx.registerWildlife({ birds, butterflies, deer })
      this.vfx.groundY = (x, z) => terrainHeight(x, z)
    }
  }

  _buildBoundary() {
    const geos = [makeMountainGeo(11), makeMountainGeo(29), makeMountainGeo(47)]
    const N = 30
    const per = Math.ceil(N / 3)
    const meshes = geos.map((geo) => {
      const m = new THREE.InstancedMesh(
        geo,
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
        per
      )
      m.count = 0
      return m
    })
    const snow = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 9, 2),
      new THREE.MeshStandardMaterial({ color: 0xeef5f8, roughness: 0.7, flatShading: true }),
      N
    )
    snow.count = 0
    const dummy = new THREE.Object3D()
    const col = new THREE.Color()
    const counts = [0, 0, 0]
    let snowN = 0
    for (let i = 0; i < N; i++) {
      const v = i % 3
      const a = (i / N) * Math.PI * 2 + rand(-0.09, 0.09)
      const r = 178 + rand(-18, 18)
      const h = rand(34, 82)
      const w = rand(26, 54)
      dummy.position.set(Math.cos(a) * r, h * 0.3, Math.sin(a) * r)
      dummy.rotation.set(0, rand(0, Math.PI), 0)
      dummy.scale.set(w, h, w)
      dummy.updateMatrix()
      meshes[v].setMatrixAt(counts[v], dummy.matrix)
      const shade = 0.42 + rand(0, 0.22)
      col.setRGB(shade * 0.95, shade * 0.9, shade * 0.82)
      meshes[v].setColorAt(counts[v], col)
      counts[v]++
      if (h > 58 && snowN < N) {
        dummy.position.y = h * 0.3 + h * 0.34
        dummy.scale.set(w * 0.2, h * 0.22, w * 0.2)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        snow.setMatrixAt(snowN++, dummy.matrix)
      }
    }
    meshes.forEach((m, idx) => {
      m.count = counts[idx]
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      this.scene.add(m)
    })
    snow.count = snowN
    snow.instanceMatrix.needsUpdate = true
    this.scene.add(snow)

    // Colinas cercanas que dan profundidad
    const hills = new THREE.InstancedMesh(
      makeMountainGeo(71),
      new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 1, flatShading: true }),
      14
    )
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(-0.2, 0.2)
      const r = 146 + rand(-12, 12)
      const h = rand(10, 26)
      dummy.position.set(Math.cos(a) * r, h * 0.3 - 2, Math.sin(a) * r)
      dummy.rotation.set(0, rand(0, Math.PI), 0)
      dummy.scale.set(rand(30, 62), h, rand(30, 62))
      dummy.updateMatrix()
      hills.setMatrixAt(i, dummy.matrix)
    }
    hills.instanceMatrix.needsUpdate = true
    this.scene.add(hills)
  }

  // =====================================================================
  //  BALIZAS DE OBJETIVO
  // =====================================================================
  _buildBeacons() {
    const defs = [
      { name: 'refugio', pos: ZONES.refugio, color: 0x35e07a, on: true },
      { name: 'water', pos: ZONES.water, color: 0x45a0e0, on: true },
      { name: 'fire', pos: ZONES.fire, color: 0xff7a1a, on: true },
      { name: 'reforest', pos: ZONES.reforest, color: 0x9fe65a, on: true },
      { name: 'bunker', pos: ZONES.bunker, color: 0x45e0d8, on: false }
    ]
    for (const d of defs) {
      const mat = new THREE.MeshBasicMaterial({
        color: d.color, transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 64, 10, 1, true), mat)
      const y = terrainHeight(d.pos.x, d.pos.z)
      beam.position.set(d.pos.x, y + 40, d.pos.z)
      beam.visible = d.on
      this.scene.add(beam)
      this.beacons[d.name] = beam
    }
  }

  showBeacon(name, on = true) {
    if (this.beacons[name]) this.beacons[name].visible = on
  }

  update(dt, restoration) {
    this.setRestoration(restoration)

    // Corriente del río (desplazamiento del rizado y espuma)
    this._riverTime = (this._riverTime || 0) + dt
    if (this.waterNormal) {
      this.waterNormal.offset.x = (this.waterNormal.offset.x + dt * 0.03) % 1
      this.waterNormal.offset.y = (this.waterNormal.offset.y + dt * 0.006) % 1
    }
    if (this.foamMat) {
      this.foamMat.opacity = 0.07 + Math.sin(this._riverTime * 1.6) * 0.035 + this._waterClean * 0.1
    }

    if (this.aliveTrees) {
      for (const t of this.aliveTrees) {
        t.obj.visible = restoration > t.threshold
      }
    }
    if (this.grassMat) {
      this.grassMat.opacity = Math.max(0, (restoration - 0.45) / 0.55)
      this.grass.visible = this.grassMat.opacity > 0.02
    }
  }
}
