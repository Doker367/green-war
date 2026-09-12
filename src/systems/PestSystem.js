import * as THREE from 'three'
import { Hojas } from './Hojas.js'

export const PEST_TYPES = [
  { id: 'small', label: 'PLAGA PEQUEÑA', probability: 0.6, scale: 0.45, color: 0xb7d34b, speed: 5.5 },
  { id: 'medium', label: 'PLAGA MEDIANA', probability: 0.3, scale: 0.75, color: 0xd49a3a, speed: 4.4 },
  { id: 'large', label: 'PLAGA GRANDE', probability: 0.1, scale: 1.15, color: 0x9f493b, speed: 3.3 }
]

export class PestSystem {
  constructor(scene, world, quality = 'med') {
    this.scene = scene
    this.world = world
    this.maxActive = quality === 'low' ? 5 : quality === 'high' ? 11 : 8
    this.active = []
    this.spawnTimer = 600
    this.spawnDelay = 600
    this.bodyGeometry = new THREE.IcosahedronGeometry(1, 1)
    this.wingGeometry = new THREE.PlaneGeometry(0.8, 0.38)
    this.materials = new Map()
    this.leaves = new Hojas(scene)
  }

  _getType(typeId) {
    return PEST_TYPES.find((type) => type.id === typeId) || PEST_TYPES[0]
  }

  _getRandomType() {
    const roll = Math.random()
    let accumulated = 0
    for (const type of PEST_TYPES) {
      accumulated += type.probability
      if (roll < accumulated) return type
    }
    return PEST_TYPES[0]
  }

  _getMaterial(type) {
    if (!this.materials.has(type.id)) {
      this.materials.set(type.id, new THREE.MeshStandardMaterial({
        color: type.color,
        roughness: 0.8,
        flatShading: true
      }))
    }
    return this.materials.get(type.id)
  }

  spawn(typeId = null) {
    const type = typeId ? this._getType(typeId) : this._getRandomType()
    const trees = []
    this.scene.traverse((object) => {
      if (object.userData.isTree && object.userData.isShoot && object.visible &&
        !object.userData.pestActive && !object.userData.pestAffected) trees.push(object)
    })
    if (!trees.length) return type

    const target = trees[Math.floor(Math.random() * trees.length)]
    target.userData.pestActive = true
    const bounds = new THREE.Box3().setFromObject(target)
    const targetPosition = bounds.getCenter(new THREE.Vector3())
    const pest = new THREE.Group()
    const body = new THREE.Mesh(this.bodyGeometry, this._getMaterial(type))
    body.scale.set(0.65, 0.9, 0.65)
    body.castShadow = true
    pest.add(body)

    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x5f4330,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      roughness: 1
    })
    const leftWing = new THREE.Mesh(this.wingGeometry, wingMaterial)
    const rightWing = new THREE.Mesh(this.wingGeometry, wingMaterial.clone())
    leftWing.position.set(-0.55, 0.2, 0)
    rightWing.position.set(0.55, 0.2, 0)
    leftWing.rotation.y = -0.35
    rightWing.rotation.y = 0.35
    pest.add(leftWing, rightWing)

    const x = targetPosition.x + THREE.MathUtils.randFloat(-1.2, 1.2)
    const z = targetPosition.z + THREE.MathUtils.randFloat(-1.2, 1.2)
    pest.position.set(x, bounds.max.y + THREE.MathUtils.randFloat(18, 30), z)
    pest.scale.setScalar(type.scale)
    pest.userData.pest = { type, target, landingY: bounds.max.y, age: 0 }
    this.scene.add(pest)
    this.active.push(pest)
    return type
  }

  _remove(index) {
    const pest = this.active[index]
    if (pest.userData.pest.landed) {
      const data = pest.userData.pest
      const severity = PEST_TYPES.findIndex((item) => item.id === data.type.id)
      this.leaves.apply(data.target, data.type, severity)
      data.target.userData.pestActive = false
      data.target.userData.pestAffected = true
    }
    this.scene.remove(pest)
    pest.traverse((object) => {
      if (object.isMesh && object.material !== this._getMaterial(pest.userData.pest.type)) object.material.dispose()
    })
    this.active.splice(index, 1)
  }

  update(dt, enabled = true) {
    if (!enabled) return
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0 && this.active.length < this.maxActive) {
      this.spawn()
      this.spawnTimer = this.spawnDelay
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const pest = this.active[i]
      const data = pest.userData.pest
      data.age += dt
      pest.position.y -= data.type.speed * dt
      pest.rotation.y += dt * 2.2
      pest.rotation.z = Math.sin(data.age * 7) * 0.18
      if (pest.position.y <= data.landingY + 0.8) {
        data.landed = true
        this._remove(i)
      }
    }

    this.leaves.update(dt)
  }
}