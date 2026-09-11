// =====================================================================
// GREEN CODE — World
// Construye la comunidad mexicana ficticia: terreno, caminos, casas,
// zona de agua, bosque incendiado y zona de reforestación.
// =====================================================================

import * as THREE from 'three'
import { terrainHeight, rand, makeRandom } from '../core/Utils.js'

export const ZONES = {
  community: new THREE.Vector3(0, 0, 0),
  water: new THREE.Vector3(-62, 0, -30),
  fire: new THREE.Vector3(58, 0, -44),
  reforest: new THREE.Vector3(6, 0, 74)
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
    this._restoration = 0

    this._buildTerrain()
    this._buildPaths()
    this._buildCommunity()
    this._buildWaterZone()
    this._buildFireZone()
    this._buildReforestZone()
    this._scatterNaturals()
    this._buildWildlife()
    this._buildBoundary()
  }

  getHeight(x, z) { return terrainHeight(x, z) + 0.02 }

  // =====================================================================
  //  TERRENO
  // =====================================================================
  _buildTerrain() {
    const size = 300, seg = 140
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

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: false })
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
      // Cada zona verde aparece en un umbral distinto -> transición orgánica
      const threshold = 0.28 + p * 0.6
      const local = THREE.MathUtils.smoothstep(t, threshold - 0.25, threshold + 0.1)
      const dry = this._dry[i % 3]
      const lush = this._lush[i % 3]
      c.copy(dry).lerp(lush, local)
      // Variación fina
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
  //  CAMINOS
  // =====================================================================
  _buildPaths() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xb09363, roughness: 1 })
    const g = new THREE.Group()
    const routes = [
      [ZONES.community, ZONES.water],
      [ZONES.community, ZONES.fire],
      [ZONES.community, ZONES.reforest]
    ]
    for (const [a, b] of routes) {
      const dir = new THREE.Vector3().subVectors(b, a)
      const len = dir.length()
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(len, 3.4), mat)
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
  //  COMUNIDAD
  // =====================================================================
  _buildCommunity() {
    const g = new THREE.Group()
    const center = ZONES.community
    const n = 7
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3
      const r = 16 + this.rand() * 6
      const x = center.x + Math.cos(a) * r
      const z = center.z + Math.sin(a) * r
      const house = this.assets.get('house')
      house.position.set(x, terrainHeight(x, z), z)
      house.rotation.y = -a + Math.PI / 2 + rand(-0.2, 0.2)
      g.add(house)
    }
    // Plaza central: pozo seco / fuente
    const wellBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.6, 1.0, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a7a64, roughness: 1, flatShading: true })
    )
    wellBase.position.set(center.x, terrainHeight(center.x, center.z) + 0.5, center.z)
    wellBase.castShadow = wellBase.receiveShadow = true
    g.add(wellBase)

    // Señal GREEN CODE y props
    const sign = this.assets.get('sign')
    sign.position.set(center.x + 8, terrainHeight(center.x + 8, center.z + 6), center.z + 6)
    sign.rotation.y = -0.6
    g.add(sign)

    for (let i = 0; i < 3; i++) {
      const b = this.assets.get('barrel')
      b.position.set(center.x - 10 + i * 1.4, terrainHeight(center.x - 10 + i * 1.4, center.z + 8), center.z + 8)
      g.add(b)
      const c = this.assets.get('crate')
      c.position.set(center.x + 11 + i * 1.2, terrainHeight(center.x + 11, center.z - 7), center.z - 7 + i)
      g.add(c)
    }
    for (let i = 0; i < 5; i++) {
      const p = this.assets.get('post')
      const a = (i / 5) * Math.PI * 2
      const x = center.x + Math.cos(a) * 22, z = center.z + Math.sin(a) * 22
      p.position.set(x, terrainHeight(x, z), z)
      g.add(p)
    }
    // Árboles vivos siempre presentes en la comunidad
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2)
      const x = center.x + Math.cos(a) * rand(11, 20)
      const z = center.z + Math.sin(a) * rand(11, 20)
      const t = this.assets.get('tree_alive')
      t.position.set(x, terrainHeight(x, z), z)
      t.scale.setScalar(rand(1.3, 1.9))
      g.add(t)
    }
    this.scene.add(g)
    this.groups.community = g
    this.zones.community = { pos: center }
  }

  // =====================================================================
  //  ZONA DE AGUA
  // =====================================================================
  _buildWaterZone() {
    const g = new THREE.Group()
    const c = ZONES.water
    const base = terrainHeight(c.x, c.z)

    const tank = this.assets.get('water_tank')
    tank.position.set(c.x, base, c.z)
    g.add(tank)

    // Tubería rota: 3 segmentos, cada uno rotado al azar (puzzle)
    const segments = []
    const pipeMatDir = [0, 1, 2]
    for (let i = 0; i < 3; i++) {
      const seg = this.assets.get('pipe_segment')
      const px = c.x + 6 + i * 2.6
      seg.position.set(px, base + 0.6, c.z + 4)
      seg.rotation.y = rand(0, Math.PI * 2)
      seg.userData.name = `SEG-${String.fromCharCode(65 + i)}`
      seg.userData.aligned = false
      seg.userData.offset = Math.floor(rand(1, 4))
      g.add(seg)
      segments.push(seg)
    }
    // Poste con fuga (indicador)
    const sign = this.assets.get('sign')
    sign.position.set(c.x + 8, base, c.z + 7)
    sign.rotation.y = -1.0
    g.add(sign)

    // Charco de agua (aparece al reparar)
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(9, 32),
      new THREE.MeshStandardMaterial({
        color: 0x2f86b5, roughness: 0.15, metalness: 0.2,
        transparent: true, opacity: 0,
        emissive: 0x0a2a3a, emissiveIntensity: 0.4
      })
    )
    pool.rotation.x = -Math.PI / 2
    pool.position.set(c.x - 1, base + 0.08, c.z - 9)
    g.add(pool)

    this.scene.add(g)
    this.groups.water = g
    this.zones.water = { pos: c, segments, tank, pool, base }
  }

  // =====================================================================
  //  ZONA DE INCENDIO
  // =====================================================================
  _buildFireZone() {
    const g = new THREE.Group()
    const c = ZONES.fire
    const rng = makeRandom(777)

    // Árboles quemados
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
    // Rocas
    for (let i = 0; i < 5; i++) {
      const x = c.x + rand(-16, 16), z = c.z + rand(-16, 16)
      const rock = this.assets.get('rock')
      rock.position.set(x, terrainHeight(x, z), z)
      g.add(rock)
    }
    // 3 torres de control
    const towers = []
    const towerPositions = [
      new THREE.Vector3(c.x - 15, 0, c.z - 13),
      new THREE.Vector3(c.x + 15, 0, c.z - 13),
      new THREE.Vector3(c.x, 0, c.z + 16)
    ]
    towerPositions.forEach((p, i) => {
      const tower = this.assets.get('tower')
      p.y = terrainHeight(p.x, p.z)
      tower.position.copy(p)
      g.add(tower)
      towers.push(tower)
    })
    // Base de operaciones
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

    // Puntos de plantado (10)
    const spots = []
    const layout = []
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        if (layout.length >= 10) break
        layout.push({ x: c.x - 9 + col * 6, z: c.z - 6 + row * 6 })
      }
    }
    layout.forEach((p, i) => {
      const y = terrainHeight(p.x, p.z)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.25, 24),
        new THREE.MeshBasicMaterial({ color: 0x35e07a, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.set(p.x, y + 0.06, p.z)
      g.add(ring)
      const marker = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.6, 6),
        new THREE.MeshBasicMaterial({ color: 0x35e07a })
      )
      marker.position.set(p.x, y + 0.4, p.z)
      g.add(marker)
      spots.push({ pos: new THREE.Vector3(p.x, y, p.z), ring, marker, tree: null })
    })

    // Algunos árboles muertos en la zona
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
    // Cactus (toque México)
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
  //  NATURALEZA DISPERSA (árboles, arbustos, rocas, hierba)
  // =====================================================================
  _scatterNaturals() {
    const rng = makeRandom(99)
    const g = new THREE.Group()
    const dead = new THREE.Group()
    this.scene.add(g, dead)

    for (let i = 0; i < 46; i++) {
      const x = rand(-130, 130), z = rand(-130, 130)
      if (Math.hypot(x, z) < 26) continue
      if (Math.hypot(x - ZONES.reforest.x, z - ZONES.reforest.z) < 20) continue
      const y = terrainHeight(x, z)
      const t = this.assets.get(rng() < 0.45 ? 'tree_dead' : 'tree_alive')
      t.position.set(x, y, z)
      t.scale.setScalar(rand(1.0, 2.0))
      t.rotation.y = rng() * Math.PI * 2
      if (t.userData) {}
      // Los vivos "despiertan" con la restauración
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
      const y = terrainHeight(x, z)
      const b = this.assets.get(rng() < 0.5 ? 'bush' : 'rock')
      b.position.set(x, y, z)
      b.scale.setScalar(rand(0.6, 1.4))
      dead.add(b)
    }

    // Hierba (InstancedMesh) que aparece con la restauración
    const bladeGeo = new THREE.ConeGeometry(0.09, 0.7, 4)
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x4f9a3f, roughness: 1, flatShading: true, transparent: true, opacity: 0 })
    const count = 3000
    const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, count)
    grass.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    const dummy = new THREE.Object3D()
    let placed = 0
    for (let i = 0; i < count * 2 && placed < count; i++) {
      const x = rand(-140, 140), z = rand(-140, 140)
      if (Math.hypot(x - ZONES.fire.x, z - ZONES.fire.z) < 24) continue
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
    // Montañas lejanas de bajo poligonaje para cerrar el horizonte
    const geo = new THREE.ConeGeometry(1, 1, 5)
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b6250, roughness: 1, flatShading: true })
    const inst = new THREE.InstancedMesh(geo, mat, 26)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      const r = 180 + rand(-15, 15)
      const h = rand(30, 70)
      dummy.position.set(Math.cos(a) * r, h * 0.35, Math.sin(a) * r)
      dummy.scale.set(rand(30, 55), h, rand(30, 55))
      dummy.rotation.y = rand(0, Math.PI)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    }
    inst.instanceMatrix.needsUpdate = true
    this.scene.add(inst)
  }

  update(dt, restoration) {
    this.setRestoration(restoration)
    if (this.aliveTrees) {
      for (const t of this.aliveTrees) {
        t.obj.visible = restoration > t.threshold
        if (t.obj.visible && t.obj.scale.x < 0.01) t.obj.scale.setScalar(1)
      }
    }
    if (this.grassMat) {
      this.grassMat.opacity = Math.max(0, (restoration - 0.45) / 0.55)
      this.grass.visible = this.grassMat.opacity > 0.02
    }
  }
}
