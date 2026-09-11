// =====================================================================
// GREEN CODE — CameraController
// Pointer Lock + mirada en primera persona.
// =====================================================================

import * as THREE from 'three'

export class CameraController {
  constructor(camera, domElement) {
    this.camera = camera
    this.dom = domElement
    this.yaw = 0
    this.pitch = 0
    this.sensitivity = 0.0022
    this.invertY = false
    this.locked = false
    this.enabled = false
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ')

    this._onMouseMove = this._onMouseMove.bind(this)
    this._onLockChange = this._onLockChange.bind(this)
    document.addEventListener('mousemove', this._onMouseMove)
    document.addEventListener('pointerlockchange', this._onLockChange)
  }

  requestLock() {
    if (this.dom.requestPointerLock) this.dom.requestPointerLock()
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock()
  }

  _onLockChange() {
    this.locked = document.pointerLockElement === this.dom
    if (this.onLockChange) this.onLockChange(this.locked)
  }

  _onMouseMove(e) {
    if (!this.locked || !this.enabled) return
    this.yaw -= e.movementX * this.sensitivity
    const dy = e.movementY * this.sensitivity * (this.invertY ? 1 : -1)
    this.pitch += dy
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch))
    this.apply()
  }

  apply() {
    this._euler.set(this.pitch, this.yaw, 0)
    this.camera.quaternion.setFromEuler(this._euler)
  }

  update() {
    this.apply()
  }

  dispose() {
    document.removeEventListener('mousemove', this._onMouseMove)
    document.removeEventListener('pointerlockchange', this._onLockChange)
  }
}
