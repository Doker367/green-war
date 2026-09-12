// =====================================================================
// GREEN CODE — Player
// Movimiento sobre el terreno: andar, correr, saltar y agacharse.
// Soporta vista en primera persona, tercera persona y cámara frontal.
// =====================================================================

import * as THREE from 'three'
import { terrainHeight } from '../core/Utils.js'
import { ViewMode } from './MutantCharacter.js'

export class Player {
  constructor(camera, world) {
    this.camera = camera
    this.world = world
    this.position = new THREE.Vector3(0, 0, 42)
    this.velocity = new THREE.Vector3()
    this.eye = 1.7
    this.currentEye = 1.7
    this.radius = 0.45
    this.speed = 6.2
    this.runSpeed = 11.5
    this.crouchSpeed = 3.0
    this.jumpSpeed = 6.2
    this.gravity = 18
    this.onGround = true
    this.crouching = false
    this.footstepTimer = 0
    this.onFootstep = null

    // Vista y personaje
    this.viewMode = ViewMode.FIRST
    this.character = null
    this._charYaw = 0
    this._camPos = new THREE.Vector3()
    this._camInit = false

    // Cámara de tercera persona
    this.tpDistance = 3.7
    this.frontDistance = 3.9
    this.shoulder = 0.55
    this.pivotHeight = 1.42

    this.position.y = terrainHeight(this.position.x, this.position.z)
  }

  reset() {
    this.position.set(0, terrainHeight(0, 42), 42)
    this.velocity.set(0, 0, 0)
    this.onGround = true
    this._charYaw = 0
  }

  get eyePosition() {
    return new THREE.Vector3(this.position.x, this.position.y + this.currentEye, this.position.z)
  }

  get isFirstPerson() { return this.viewMode === ViewMode.FIRST }
  get isFront() { return this.viewMode === ViewMode.FRONT }

  setViewMode(mode) {
    this.viewMode = mode
    if (this.character) this.character.setViewMode(mode)
    this._camInit = false
  }

  update(dt, input, yaw, pitch = 0) {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))

    // Agacharse
    this.crouching = !!input.crouch && this.onGround

    const move = new THREE.Vector3()
    if (input.forward) move.add(forward)
    if (input.back) move.sub(forward)
    if (input.right) move.add(right)
    if (input.left) move.sub(right)

    const running = input.run && move.lengthSq() > 0 && !this.crouching
    const speed = this.crouching ? this.crouchSpeed : (running ? this.runSpeed : this.speed)
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed)

    // Suavizado horizontal
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, move.x, 12, dt)
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, move.z, 12, dt)

    // Salto y gravedad
    if (input.jump && this.onGround && !this.crouching) {
      this.velocity.y = this.jumpSpeed
      this.onGround = false
    }
    this.velocity.y -= this.gravity * dt

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    this.position.y += this.velocity.y * dt

    // Colisión con el terreno
    const ground = terrainHeight(this.position.x, this.position.z)
    if (this.position.y <= ground) {
      this.position.y = ground
      this.velocity.y = 0
      this.onGround = true
    }

    // Límites del mapa
    const lim = 138
    this.position.x = THREE.MathUtils.clamp(this.position.x, -lim, lim)
    this.position.z = THREE.MathUtils.clamp(this.position.z, -lim, lim)

    // Colisiones con estructuras (paredes del refugio, búnker…)
    if (this.world && this.world.resolveCollisions) {
      this.world.resolveCollisions(this.position, this.radius)
    }

    // Altura de ojos suavizada (agachado / de pie)
    const targetEye = this.crouching ? 1.05 : this.eye
    this.currentEye = THREE.MathUtils.damp(this.currentEye, targetEye, 9, dt)

    this._updateCharacter(dt, yaw, move.lengthSq() > 0)
    this._updateCamera(dt, yaw, pitch)

    // Pasos
    if (move.lengthSq() > 0 && this.onGround) {
      this.footstepTimer -= dt * (running ? 1.7 : 1)
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 0.5
        if (this.onFootstep) this.onFootstep()
      }
    }
  }

  _updateCharacter(dt, yaw, moving) {
    if (!this.character) return
    this.character.root.position.copy(this.position)

    // Dirección a la que mira: hacia el movimiento o hacia la cámara
    let desired = yaw
    if (moving) {
      desired = Math.atan2(-this.velocity.x, -this.velocity.z)
    }
    let diff = desired - this._charYaw
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    this._charYaw += diff * (1 - Math.exp(-14 * dt))
    this.character.root.rotation.y = this._charYaw

    this.character.update(dt, {
      speed: Math.hypot(this.velocity.x, this.velocity.z),
      running: !this.crouching && Math.hypot(this.velocity.x, this.velocity.z) > 6,
      crouching: this.crouching,
      grounded: this.onGround
    })
  }

  _updateCamera(dt, yaw, pitch) {
    if (this.isFirstPerson) {
      this.camera.position.set(this.position.x, this.position.y + this.currentEye, this.position.z)
      return
    }

    const cp = Math.cos(pitch)
    const forward = new THREE.Vector3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp)
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    const pivot = new THREE.Vector3(this.position.x, this.position.y + this.pivotHeight, this.position.z)

    const dist = this.isFront ? this.frontDistance : this.tpDistance
    const side = this.isFront ? -this.shoulder : this.shoulder
    const desired = this.isFront
      ? pivot.clone().addScaledVector(forward, dist).addScaledVector(right, side)
      : pivot.clone().addScaledVector(forward, -dist).addScaledVector(right, side)

    // No atravesar el terreno
    const g = terrainHeight(desired.x, desired.z) + 0.45
    if (desired.y < g) desired.y = g

    if (!this._camInit) { this._camPos.copy(desired); this._camInit = true }
    const lambda = this.isFront ? 5 : 11
    this._camPos.x = THREE.MathUtils.damp(this._camPos.x, desired.x, lambda, dt)
    this._camPos.y = THREE.MathUtils.damp(this._camPos.y, desired.y, lambda, dt)
    this._camPos.z = THREE.MathUtils.damp(this._camPos.z, desired.z, lambda, dt)
    this.camera.position.copy(this._camPos)

    if (this.isFront) {
      this.camera.lookAt(pivot.x, pivot.y + 0.05, pivot.z)
    } else {
      this.camera.rotation.set(pitch, yaw, 0, 'YXZ')
    }
  }
}
