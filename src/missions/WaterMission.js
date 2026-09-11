// =====================================================================
// GREEN CODE — Misión de Agua: Río contaminado
// Inspecciona el río y activa las etapas del sistema de filtración
// en el orden correcto para devolver el agua limpia.
// =====================================================================

import * as THREE from 'three'

const STAGES = [
  { id: 'sedimentos', label: 'FILTRO DE SEDIMENTOS' },
  { id: 'carbon', label: 'CARBÓN ACTIVADO' },
  { id: 'uv', label: 'DESINFECCIÓN UV' }
]

export class WaterMission {
  constructor(ctx) {
    this.ctx = ctx
    this.name = 'FILTRAR EL AGUA DEL RÍO'
    this.complete = false
    this.progress = 0
  }

  init() {
    const { world, interaction } = this.ctx
    this.zone = world.zones.water
    interaction.register({
      id: 'river-filter',
      position: this.zone.panel,
      radius: 12,
      label: 'INSPECCIONAR RÍO / FILTRO',
      available: () => !this.complete,
      onInteract: () => this.openTerminal()
    })
  }

  openTerminal() {
    const { gc, audio } = this.ctx
    audio.sfx('scan')
    gc.open({
      scanTime: 1300,
      scanLabel: 'ANALIZANDO CALIDAD DEL AGUA',
      problem: {
        title: 'RÍO CONTAMINADO',
        system: 'SISTEMA DE AGUA',
        state: 'CRÍTICO',
        loss: '67%',
        rows: [
          { k: 'TURBIDEZ', v: 'ALTA', ok: false },
          { k: 'METALES PESADOS', v: 'DETECTADOS', ok: false },
          { k: 'pH', v: '8.9 (ANÓMALO)', ok: false }
        ]
      },
      hint: '[SISTEMA] ACTIVA LOS FILTROS EN ORDEN',
      onReady: (gcUI) => this.buildPuzzle(gcUI)
    })
  }

  buildPuzzle(gc) {
    const { audio } = this.ctx
    this.progress = 0
    const orderIds = STAGES.map((s) => s.id)
    const shuffled = [...STAGES].sort(() => Math.random() - 0.5)

    gc.logLine('> Secuencia correcta: SEDIMENTOS → CARBÓN → UV.')
    gc.logLine('> Activa cada etapa en ese orden.')

    const render = () => {
      gc.actions.innerHTML = `<div class="puzzle">
        ${STAGES.map((s, i) => {
          const done = i < this.progress
          return `<div class="seg-row ${done ? 'aligned' : ''}">
            <span>${i + 1}. ${s.label}</span>
            <span style="color:${done ? '#35e07a' : '#ffb03a'}">${done ? '✓' : 'PENDIENTE'}</span>
          </div>`
        }).join('')}
        ${shuffled.map((s) => `<button data-f="${s.id}">ACTIVAR ${s.label}</button>`).join('')}
      </div>`
      gc.actions.querySelectorAll('button[data-f]').forEach((btn) => {
        btn.onclick = () => this.activate(btn.dataset.f, gc)
      })
    }
    this._render = render
    render()
    this._orderIds = orderIds
    void audio
  }

  activate(id, gc) {
    const { audio } = this.ctx
    if (id === this._orderIds[this.progress]) {
      this.progress++
      audio.sfx('interact')
      this._render()
      if (this.progress >= STAGES.length) this.solve(gc)
    } else {
      this.progress = 0
      audio.sfx('error')
      gc.logLine('✗ ORDEN INCORRECTO — reiniciando filtros', 'warn')
      this._render()
    }
  }

  async solve(gc) {
    this.complete = true
    this.applyEffect()
    gc.clearActions()
    await gc.progress('FILTRANDO AGUA ', 1800)
    await gc.runSteps([
      { text: '✓ SEDIMENTOS RETIRADOS', cls: 'ok', delay: 360 },
      { text: '✓ CONTAMINANTES NEUTRALIZADOS', cls: 'ok', delay: 360 },
      { text: '✓ AGUA POTABLE RESTAURADA', cls: 'ok', delay: 480 }
    ])
    gc.setHint('[COMPLETADO] PULSA ESC')
  }

  applyEffect() {
    const { ecosystem, vfx, audio, hud, world } = this.ctx
    ecosystem.repairWater()
    world.setWaterClean(1)
    audio.sfx('confirm')
    audio.setWaterLevel(1)
    if (this.zone.screenMat) this.zone.screenMat.emissive.setHex(0x45e0ff)
    hud.toast('AGUA FILTRADA', 'El río vuelve a estar limpio')
  }

  update(dt) {
    if (!this.complete) return
    this._t = (this._t || 0) - dt
    if (this._t <= 0) {
      this._t = 1.4
      const { vfx, world } = this.ctx
      // Pequeños destellos de agua limpia a lo largo del río
      const z = world.zones.river.z
      const x = (Math.random() - 0.5) * 180
      vfx.burst('water', new THREE.Vector3(x, world._riverBaseY + 0.5, z), 6)
    }
  }

  isComplete() { return this.complete }
  reset() { this.complete = false; this.progress = 0 }
}
