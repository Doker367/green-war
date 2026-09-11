// =====================================================================
// GREEN CODE — Player
// Movimiento FPS sobre el terreno: andar, correr, saltar.
// =====================================================================

import * as THREE from 'three'
import { terrainHeight } from '../core/Utils.js'

export class Player {
  constructor(camera, world) {
    this.camera = camera
    this.world = world
    this.position = new THREE.Vector3(-10, 0, 30)
    this.velocity = new THREE.Vector3()
    this.eye = 1.7
    this.radius = 0.45
    this.speed = 6.2
    this.runSpeed = 11.5
    this.jumpSpeed = 6.2
    this.gravity = 18
    this.onGround = true
    this.footstepTimer = 0
    this.onFootstep = null
    this.position.y = terrainHeight(this.position.x, this.position.z)
  }

  reset() {
    this.position.set(-10, terrainHeight(-10, 30), 30)
    this.velocity.set(0, 0, 0)
    this.onGround = true
  }

  get eyePosition() {
    return new THREE.Vector3(this.position.x, this.position.y + this.eye, this.position.z)
  }

  update(dt, input, yaw) {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))

    const move = new THREE.Vector3()
    if (input.forward) move.add(forward)
    if (input.back) move.sub(forward)
    if (input.right) move.add(right)
    if (input.left) move.sub(right)

    const running = input.run && move.lengthSq() > 0
    const speed = running ? this.runSpeed : this.speed
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed)

    // Suavizado horizontal
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, move.x, 12, dt)
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, move.z, 12, dt)

    // Salto y gravedad
    if (input.jump && this.onGround) {
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

    // Cámara
    this.camera.position.set(this.position.x, this.position.y + this.eye, this.position.z)

    // Pasos
    if (move.lengthSq() > 0 && this.onGround) {
      this.footstepTimer -= dt * (running ? 1.7 : 1)
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 0.5
        if (this.onFootstep) this.onFootstep()
      }
    }
  }
}
