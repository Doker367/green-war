// =====================================================================
// GREEN CODE — MissionManager
// Orquesta las 3 misiones y determina la misión actual.
// =====================================================================

import { WaterMission } from './WaterMission.js'
import { FireMission } from './FireMission.js'
import { ReforestationMission } from './ReforestationMission.js'

export class MissionManager {
  constructor(ctx) {
    this.ctx = ctx
    this.missions = [
      new WaterMission(ctx),
      new FireMission(ctx),
      new ReforestationMission(ctx)
    ]
    this.missions.forEach((m) => m.init())
  }

  get currentName() {
    const { ecosystem } = this.ctx
    if (!ecosystem.waterFixed) return 'REPARAR SISTEMA DE AGUA'
    if (!ecosystem.fireFixed) return 'CONTROLAR EL INCENDIO FORESTAL'
    if (!ecosystem.reforestFixed) return 'REFORESTAR LA ZONA DAÑADA'
    return 'ECOSISTEMA RESTAURADO'
  }

  update(dt) {
    // Actualiza solo la misión activa + misiones completadas con efectos vivos
    this.missions.forEach((m) => m.update && m.update(dt))
  }

  reset() {
    this.missions.forEach((m) => m.reset && m.reset())
  }
}
