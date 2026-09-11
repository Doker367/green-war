// =====================================================================
// GREEN CODE — AssetManager
// Genera assets low-poly "prefabricados" por procedimiento (estilo
// estilizado y limpio, no cubos) y permite SUSTITUIRLOS por modelos
// GLB/GLTF reales colocados en /public/assets/models/.
//
// Si existe /public/assets/models/<nombre>.glb se carga y se usa en
// lugar del placeholder. Ver ASSETS.md para la lista de nombres.
// =====================================================================

import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { rand, hash2 } from './Utils.js'

const MODELS = [
  'house', 'tree_alive', 'tree_dead', 'tree_burnt', 'water_tank',
  'pipe_segment', 'tower', 'rock', 'cactus', 'bush', 'barrel',
  'crate', 'sign', 'post', 'deer', 'bird', 'person'
]

export class AssetManager {
  constructor() {
    this.models = new Map()
    this.loadedGLB = new Set()
    this._mats = {}
    this._geos = {}
    this._buildShared()
  }

  // ---------- materiales / geometrías compartidas ----------
  mat(name, color, opts = {}) {
    if (!this._mats[name]) {
      this._mats[name] = new THREE.MeshStandardMaterial({
        color, flatShading: true, roughness: opts.roughness ?? 0.85,
        metalness: opts.metalness ?? 0.0, emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 1
      })
    }
    return this._mats[name]
  }

  _buildShared() {
    this._geos.box = new THREE.BoxGeometry(1, 1, 1)
    this._geos.cyl = new THREE.CylinderGeometry(1, 1, 1, 8)
    this._geos.cylTop = new THREE.CylinderGeometry(0.6, 1, 1, 8)
    this._geos.ico = new THREE.IcosahedronGeometry(1, 0)
    this._geos.ico1 = new THREE.IcosahedronGeometry(1, 1)
    this._geos.cone = new THREE.ConeGeometry(1, 1, 7)
    this._geos.sphere = new THREE.SphereGeometry(1, 10, 8)
    this._geos.plane = new THREE.PlaneGeometry(1, 1)
  }

  // ---------- carga opcional de GLB ----------
  async preload(onModel) {
    const loader = new GLTFLoader()
    for (const name of MODELS) {
      const url = `${import.meta.env.BASE_URL}assets/models/${name}.glb`
      try {
        const gltf = await loader.loadAsync(url)
        const root = gltf.scene
        root.traverse((o) => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true }
        })
        this.models.set(name, root)
        this.loadedGLB.add(name)
        if (onModel) onModel(name)
      } catch (e) {
        // No existe el GLB: seguimos con el placeholder procedural.
      }
    }
    return this.loadedGLB
  }

  get(name) {
    if (this.models.has(name)) {
      const clone = this.models.get(name).clone(true)
      clone.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
      return clone
    }
    const factory = this.factories[name]
    return factory ? factory() : new THREE.Group()
  }

  // =====================================================================
  //  FÁBRICAS PROCEDURALES (placeholders de calidad)
  // =====================================================================
  get factories() {
    return {
      house: () => this.makeHouse(),
      tree_alive: () => this.makeTree('alive'),
      tree_dead: () => this.makeTree('dead'),
      tree_burnt: () => this.makeTree('burnt'),
      water_tank: () => this.makeWaterTank(),
      pipe_segment: () => this.makePipeSegment(),
      tower: () => this.makeTower(),
      rock: () => this.makeRock(),
      cactus: () => this.makeCactus(),
      bush: () => this.makeBush(),
      barrel: () => this.makeBarrel(),
      crate: () => this.makeCrate(),
      sign: () => this.makeSign('GREEN CODE'),
      post: () => this.makePost(),
      deer: () => this.makeDeer(),
      bird: () => this.makeBird(),
      person: () => this.makePerson()
    }
  }

  _mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.scale.set(sx, sy, sz)
    m.castShadow = true; m.receiveShadow = true
    return m
  }

  makeTree(kind = 'alive') {
    const g = new THREE.Group()
    const trunkMat = kind === 'alive'
      ? this.mat('trunk', 0x6b4a2b, { roughness: 1 })
      : this.mat('trunkDead', 0x4a3a2a, { roughness: 1 })
    const trunkH = kind === 'alive' ? rand(3.0, 4.2) : rand(2.4, 3.6)
    g.add(this._mesh(this._geos.cyl, trunkMat, 0, trunkH / 2, 0, 0.28, trunkH, 0.28))

    if (kind === 'dead') {
      for (let i = 0; i < 4; i++) {
        const a = rand(0, Math.PI * 2)
        const b = this._mesh(this._geos.cyl, trunkMat, Math.cos(a) * 0.5, trunkH + rand(-0.1, 0.4), Math.sin(a) * 0.5, 0.08, rand(1, 1.8), 0.08)
        b.rotation.z = rand(-1, 1); b.rotation.x = rand(-1, 1)
        g.add(b)
      }
      return g
    }
    if (kind === 'burnt') {
      g.scale.setScalar(rand(0.7, 1.0))
      trunkMat.color.setHex(0x1c1512)
      for (let i = 0; i < 3; i++) {
        const a = rand(0, Math.PI * 2)
        const b = this._mesh(this._geos.cyl, trunkMat, Math.cos(a) * 0.4, trunkH * 0.8, Math.sin(a) * 0.4, 0.07, rand(0.8, 1.6), 0.07)
        b.rotation.z = rand(-1, 1); b.rotation.x = rand(-1, 1)
        g.add(b)
      }
      return g
    }
    // alive: copa frondosa con tonos variados
    const greens = [0x2e8b47, 0x37a154, 0x256e3c, 0x3fae5f]
    const leafMat = this.mat('leaf' + Math.floor(rand(0, greens.length)), greens[Math.floor(rand(0, greens.length))], { roughness: 0.95 })
    const blobs = 3 + Math.floor(rand(0, 3))
    for (let i = 0; i < blobs; i++) {
      const s = rand(0.9, 1.6)
      g.add(this._mesh(this._geos.ico, leafMat,
        rand(-0.8, 0.8), trunkH + rand(0.0, 1.4), rand(-0.8, 0.8), s, s * 0.85, s))
    }
    return g
  }

  makeHouse() {
    const g = new THREE.Group()
    const w = rand(3.6, 4.8), d = rand(3.2, 4.2), h = rand(2.6, 3.2)
    const wallColors = [0xe8d9b5, 0xd9b98c, 0xc98b5a, 0xb5654a, 0xe0c9a6]
    const wallMat = this.mat('wall' + Math.floor(rand(0, wallColors.length)), wallColors[Math.floor(rand(0, wallColors.length))], { roughness: 0.95 })
    const roofMat = this.mat('roof' + Math.floor(rand(0, 3)), [0x8a3b2a, 0x6e5a44, 0xa5522f][Math.floor(rand(0, 3))], { roughness: 0.9 })
    g.add(this._mesh(this._geos.box, wallMat, 0, h / 2, 0, w, h, d))
    const roof = this._mesh(this._geos.cone, roofMat, 0, h + 0.85, 0, Math.max(w, d) * 0.82, 1.7, Math.max(w, d) * 0.82)
    roof.rotation.y = Math.PI / 4
    g.add(roof)
    // puerta
    const doorMat = this.mat('door', 0x5a3a22)
    g.add(this._mesh(this._geos.box, doorMat, 0, 0.85, d / 2 + 0.02, 0.9, 1.7, 0.1))
    // ventanas
    const winMat = this.mat('window', 0x2b4a5a, { emissive: 0x18313d, emissiveIntensity: 0.6, roughness: 0.3 })
    g.add(this._mesh(this._geos.box, winMat, -w / 2 - 0.02, h * 0.6, 0, 0.1, 1.0, 1.0))
    g.add(this._mesh(this._geos.box, winMat, w / 2 + 0.02, h * 0.6, 0, 0.1, 1.0, 1.0))
    return g
  }

  makeWaterTank() {
    const g = new THREE.Group()
    const metal = this.mat('tankMetal', 0x9fb0b5, { roughness: 0.45, metalness: 0.6 })
    const rust = this.mat('tankRust', 0x8a5a3a, { roughness: 0.9 })
    const body = this._mesh(this._geos.cyl, metal, 0, 3.2, 0, 2.4, 6.4, 2.4)
    g.add(body)
    g.add(this._mesh(this._geos.cyl, rust, 0, 1.0, 0, 2.5, 2.0, 2.5))
    g.add(this._mesh(this._geos.cone, metal, 0, 6.9, 0, 2.5, 1.2, 2.5))
    // patas
    const legMat = this.mat('leg', 0x556066, { metalness: 0.4, roughness: 0.6 })
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      g.add(this._mesh(this._geos.cyl, legMat, Math.cos(a) * 1.9, 0.5, Math.sin(a) * 1.9, 0.18, 1.0, 0.18))
    }
    return g
  }

  makePipeSegment() {
    const g = new THREE.Group()
    const pipeMat = this.mat('pipe', 0xa8b4ba, { roughness: 0.4, metalness: 0.7 })
    const body = this._mesh(this._geos.cyl, pipeMat, 0, 0, 0, 0.45, 2.4, 0.45)
    body.rotation.z = Math.PI / 2
    g.add(body)
    g.add(this._mesh(this._geos.cyl, pipeMat, -1.2, 0, 0, 0.6, 0.25, 0.6))
    g.add(this._mesh(this._geos.cyl, pipeMat, 1.2, 0, 0, 0.6, 0.25, 0.6))
    return g
  }

  makeTower() {
    const g = new THREE.Group()
    const metal = this.mat('towerMetal', 0x6b7078, { roughness: 0.5, metalness: 0.6 })
    const beam = this.mat('beam', 0x40464d, { roughness: 0.7, metalness: 0.5 })
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const leg = this._mesh(this._geos.cyl, metal, Math.cos(a) * 0.7, 2.5, Math.sin(a) * 0.7, 0.12, 5, 0.12)
      g.add(leg)
    }
    g.add(this._mesh(this._geos.box, beam, 0, 5, 0, 1.4, 0.3, 1.4))
    g.add(this._mesh(this._geos.box, beam, 0, 2.5, 0, 1.0, 0.2, 1.0))
    const sensor = this._mesh(this._geos.sphere, metal, 0, 5.5, 0, 0.4, 0.4, 0.4)
    g.add(sensor)
    const lightMat = this.mat('towerLight', 0x333333, { emissive: 0xff2222, emissiveIntensity: 2 })
    const light = this._mesh(this._geos.sphere, lightMat, 0, 5.9, 0, 0.16, 0.16, 0.16)
    g.add(light)
    g.userData.light = light
    g.userData.lightMat = lightMat
    return g
  }

  makeRock() {
    const g = new THREE.Group()
    const rockMat = this.mat('rock', 0x7d7a72, { roughness: 1 })
    for (let i = 0; i < 3; i++) {
      const s = rand(0.4, 1.1)
      const m = this._mesh(this._geos.ico, rockMat, rand(-0.6, 0.6), s * 0.4, rand(-0.6, 0.6), s, s * 0.7, s)
      m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3))
      g.add(m)
    }
    return g
  }

  makeCactus() {
    const g = new THREE.Group()
    const cactusMat = this.mat('cactus', 0x3f7d43, { roughness: 0.9 })
    const h = rand(2.2, 3.4)
    g.add(this._mesh(this._geos.cylTop, cactusMat, 0, h / 2, 0, 0.35, h, 0.35))
    const armH = h * 0.6
    const arm1 = this._mesh(this._geos.cyl, cactusMat, 0.55, armH, 0, 0.18, 1.3, 0.18)
    g.add(arm1)
    const arm1b = this._mesh(this._geos.cyl, cactusMat, 0.55, armH + 0.65, 0, 0.18, 1.2, 0.18)
    g.add(arm1b)
    return g
  }

  makeBush() {
    const g = new THREE.Group()
    const mat = this.mat('bush', [0x3d6b3a, 0x4a7a44, 0x2f5c34][Math.floor(rand(0, 3))], { roughness: 1 })
    for (let i = 0; i < 3; i++) {
      g.add(this._mesh(this._geos.ico, mat, rand(-0.4, 0.4), rand(0.3, 0.7), rand(-0.4, 0.4), rand(0.5, 0.9), rand(0.4, 0.7), rand(0.5, 0.9)))
    }
    return g
  }

  makeBarrel() {
    const g = new THREE.Group()
    const mat = this.mat('barrel', [0xb5532f, 0x3f6b8a, 0x7a7a3f][Math.floor(rand(0, 3))], { roughness: 0.7, metalness: 0.3 })
    g.add(this._mesh(this._geos.cyl, mat, 0, 0.55, 0, 0.5, 1.1, 0.5))
    const ring = this.mat('ring', 0x2a2a2a, { metalness: 0.6, roughness: 0.4 })
    g.add(this._mesh(this._geos.cyl, ring, 0, 0.3, 0, 0.52, 0.08, 0.52))
    g.add(this._mesh(this._geos.cyl, ring, 0, 0.85, 0, 0.52, 0.08, 0.52))
    return g
  }

  makeCrate() {
    const g = new THREE.Group()
    const mat = this.mat('crate', 0x9a6b3a, { roughness: 1 })
    g.add(this._mesh(this._geos.box, mat, 0, 0.45, 0, 0.9, 0.9, 0.9))
    return g
  }

  makeSign(text = 'GREEN CODE') {
    const g = new THREE.Group()
    const postMat = this.mat('signPost', 0x6b4a2b)
    g.add(this._mesh(this._geos.cyl, postMat, 0, 1.0, 0, 0.09, 2.0, 0.09))
    const boardMat = this.mat('signBoard', 0x1c4a2e, { emissive: 0x0a2a18, emissiveIntensity: 0.5 })
    g.add(this._mesh(this._geos.box, boardMat, 0, 2.0, 0, 1.8, 0.7, 0.08))
    return g
  }

  makePost() {
    const g = new THREE.Group()
    const mat = this.mat('post', 0x7a5a3a, { roughness: 1 })
    g.add(this._mesh(this._geos.cyl, mat, 0, 1.4, 0, 0.12, 2.8, 0.12))
    g.add(this._mesh(this._geos.box, mat, 0, 2.7, 0, 0.8, 0.1, 0.1))
    return g
  }

  makeDeer() {
    const g = new THREE.Group()
    const body = this.mat('deer', 0x9a6b3f, { roughness: 1 })
    const dark = this.mat('deerDark', 0x5a3f26, { roughness: 1 })
    const b = this._mesh(this._geos.ico1, body, 0, 1.1, 0, 0.55, 0.45, 1.05)
    g.add(b)
    g.add(this._mesh(this._geos.box, body, 0, 1.45, -0.75, 0.4, 0.5, 0.5))
    const head = this._mesh(this._geos.box, body, 0, 1.55, -1.05, 0.3, 0.35, 0.55)
    g.add(head)
    for (const [x, z] of [[-0.3, 0.55], [0.3, 0.55], [-0.3, -0.55], [0.3, -0.55]]) {
      g.add(this._mesh(this._geos.cyl, dark, x, 0.5, z, 0.09, 1.0, 0.09))
    }
    // astas
    for (const s of [-1, 1]) {
      const ant = this._mesh(this._geos.cyl, dark, s * 0.15, 1.95, -0.95, 0.04, 0.7, 0.04)
      ant.rotation.z = s * 0.4
      g.add(ant)
    }
    g.userData.head = head
    return g
  }

  makeBird() {
    const g = new THREE.Group()
    const mat = this.mat('bird', 0x2a2a2a, { roughness: 1 })
    g.add(this._mesh(this._geos.ico, mat, 0, 0, 0, 0.18, 0.12, 0.4))
    const wl = this._mesh(this._geos.box, mat, -0.35, 0, 0, 0.6, 0.03, 0.22)
    const wr = this._mesh(this._geos.box, mat, 0.35, 0, 0, 0.6, 0.03, 0.22)
    g.add(wl, wr)
    g.userData.wings = [wl, wr]
    return g
  }

  makePerson() {
    const g = new THREE.Group()
    const skin = this.mat('skin', 0xb5825a, { roughness: 1 })
    const shirt = this.mat('shirt', 0x2f8f5b, { roughness: 0.9 })
    const pants = this.mat('pants', 0x2c3e50, { roughness: 0.9 })
    g.add(this._mesh(this._geos.cyl, pants, 0, 0.5, 0, 0.18, 1.0, 0.18))
    g.add(this._mesh(this._geos.box, shirt, 0, 1.35, 0, 0.5, 0.7, 0.3))
    g.add(this._mesh(this._geos.sphere, skin, 0, 1.9, 0, 0.22, 0.24, 0.22))
    return g
  }
}
