// =====================================================================
// GREEN CODE — EcosystemSystem
// Estado global del ecosistema, salud y progreso de misiones.
// =====================================================================

export class EcosystemSystem {
  constructor() {
    this._listeners = {}
    this.reset()
  }

  reset() {
    this.water = 0
    this.forest = 18
    this.fire = 100
    this.biodiversity = 12
    this.health = 20
    this.treesPlanted = 0
    this.fireTowers = 0
    this.waterFixed = false
    this.fireFixed = false
    this.reforestFixed = false
    this._emitChange()
  }

  on(evt, cb) {
    (this._listeners[evt] = this._listeners[evt] || []).push(cb)
    return this
  }
  emit(evt, data) {
    (this._listeners[evt] || []).forEach((cb) => cb(data))
  }
  _emitChange() { this.emit('change', this.getState()) }

  getState() {
    return {
      water: this.water, forest: this.forest, fire: this.fire,
      biodiversity: this.biodiversity, health: this.health,
      treesPlanted: this.treesPlanted, fireTowers: this.fireTowers,
      waterFixed: this.waterFixed, fireFixed: this.fireFixed,
      reforestFixed: this.reforestFixed
    }
  }

  // Relación de restauración visual 0..1
  get restoration() { return Math.max(0, Math.min(1, (this.health - 20) / 80)) }

  _recompute() {
    this.forest = Math.min(100, 18 + this.treesPlanted * 6 + (this.fireFixed ? 14 : 0))
    this.biodiversity = Math.min(100, 12 + this.treesPlanted * 5 + (this.waterFixed ? 14 : 0) + (this.fireFixed ? 12 : 0))
    this.health = 20 + (this.waterFixed ? 25 : 0) + (this.fireFixed ? 25 : 0) + (this.reforestFixed ? 30 : 0)
  }

  repairWater() {
    if (this.waterFixed) return
    this.waterFixed = true
    this.water = 100
    this._recompute()
    this._emitChange()
    this.emit('event', { type: 'water', message: 'SISTEMA DE AGUA RESTAURADO' })
  }

  activateTower() {
    if (this.fireFixed) return
    this.fireTowers = Math.min(3, this.fireTowers + 1)
    this.fire = Math.max(0, 100 - this.fireTowers * (100 / 3))
    if (this.fireTowers >= 3) {
      this.fireFixed = true
      this.fire = 0
      this.emit('event', { type: 'fire', message: 'INCENDIO CONTROLADO' })
    }
    this._recompute()
    this._emitChange()
  }

  plantTree() {
    if (this.treesPlanted >= 10) return false
    this.treesPlanted++
    if (this.treesPlanted >= 10 && !this.reforestFixed) {
      this.reforestFixed = true
      this.emit('event', { type: 'reforest', message: 'ZONA REFORESTADA' })
    }
    this._recompute()
    this._emitChange()
    return true
  }

  get done() { return this.waterFixed && this.fireFixed && this.reforestFixed }
}
