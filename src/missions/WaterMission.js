// =====================================================================
// GREEN CODE — Misión 1: Sistema de Agua
// Detecta la fuga y resuelve un puzzle de 3 segmentos de tubería.
// =====================================================================

import * as THREE from 'three'

export class WaterMission {
  constructor(ctx) {
    this.ctx = ctx
    this.name = 'REPARAR SISTEMA DE AGUA'
    this.complete = false
    this.segments = []
    this._flowTimer = 0
  }

  init() {
    const { world, interaction } = this.ctx
    const zone = world.zones.water
    this.zone = zone
    this.segments = zone.segments
    this.segments.forEach((s) => {
      s.userData.offset = 1 + Math.floor(Math.random() * 3)
      s.rotation.y = s.userData.offset * Math.PI * 0.5
      s.userData.aligned = false
    })

    this.item = interaction.register({
      id: 'water-leak',
      position: zone.tank.position,
      radius: 13,
      label: 'ANALIZAR FUGA DE AGUA',
      available: () => !this.complete,
      onInteract: () => this.openTerminal()
    })
  }

  openTerminal() {
    const { gc, audio } = this.ctx
    audio.sfx('scan')
    gc.open({
      scanTime: 1300,
      scanLabel: 'ESCANEANDO RED HIDRÁULICA',
      problem: {
        title: 'FUGA DE AGUA DETECTADA',
        system: 'SISTEMA DE AGUA',
        state: 'CRÍTICO',
        loss: '67%',
        rows: [{ k: 'PRESIÓN', v: 'BAJA', ok: false }, { k: 'SEGMENTOS', v: '3 DESCONECTADOS', ok: false }]
      },
      hint: '[PUZZLE] CONECTA LAS TUBERÍAS',
      onReady: (gcUI) => this.buildPuzzle(gcUI)
    })
  }

  buildPuzzle(gc) {
    gc.logLine('> Objetivo: alinear los 3 segmentos hasta 0°.')
    gc.logLine('> Pulsa cada segmento para rotarlo 90°.')
    const render = () => {
      const rows = this.segments.map((s, i) => {
        const deg = s.userData.offset * 90
        const aligned = s.userData.offset === 0
        return `<div class="seg-row ${aligned ? 'aligned' : ''}">
          <span>SEG-${String.fromCharCode(65 + i)}</span>
          <span style="color:${aligned ? '#35e07a' : '#ffb03a'}">${aligned ? '✓ ALINEADO' : deg + '°'}</span>
          <button data-seg="${i}">ROTAR ⟳</button>
        </div>`
      }).join('')
      gc.actions.innerHTML = `<div class="puzzle">${rows}</div>`
      gc.actions.querySelectorAll('button[data-seg]').forEach((btn) => {
        btn.onclick = () => this.rotate(parseInt(btn.dataset.seg, 10), gc)
      })
    }
    this._renderPuzzle = render
    render()
  }

  rotate(index, gc) {
    const { audio } = this.ctx
    const seg = this.segments[index]
    seg.userData.offset = (seg.userData.offset + 3) % 4 // -1 (mod 4)
    seg.rotation.y = seg.userData.offset * Math.PI * 0.5
    audio.sfx('interact')
    this._renderPuzzle()

    if (this.segments.every((s) => s.userData.offset === 0)) {
      this.solve(gc)
    }
  }

  async solve(gc) {
    this.complete = true
    gc.clearActions()
    await gc.progress('ANALIZANDO FLUJO ', 1500)
    await gc.runSteps([
      { text: '✓ FUGA LOCALIZADA', cls: 'ok', delay: 380 },
      { text: '✓ SEGMENTOS CONECTADOS', cls: 'ok', delay: 380 },
      { text: '✓ SISTEMA REPARADO', cls: 'ok', delay: 380 },
      { text: '✓ AGUA RESTAURADA', cls: 'ok', delay: 480 }
    ])
    this.applyEffect()
    gc.setHint('[COMPLETADO] PULSA ESC')
  }

  applyEffect() {
    const { ecosystem, vfx, audio, hud } = this.ctx
    ecosystem.repairWater()
    audio.sfx('confirm')
    audio.setWaterLevel(1)
    // Charco visible
    this.zone.pool.material.opacity = 0.78
    this.zone.pool.material.transparent = true
    this.zone.pool.position.y = this.zone.base + 0.1
    // Tubería / tanque con brillo de agua
    this.segments.forEach((s) => {
      s.traverse((o) => {
        if (o.isMesh && o.material && o.material.color) {
          o.material.emissive = new THREE.Color(0x0a3a55)
          o.material.emissiveIntensity = 0.6
        }
      })
    })
    hud.toast('AGUA RESTAURADA', 'El sistema vuelve a circular')
    // Ráfaga inicial
    vfx.burst('water', new THREE.Vector3(this.zone.pos.x, this.zone.base + 1, this.zone.pos.z + 4), 60)
  }

  update(dt) {
    if (!this.complete) return
    // Chorro continuo de agua en la tubería reparada
    this._flowTimer -= dt
    if (this._flowTimer <= 0) {
      this._flowTimer = 0.6
      const { vfx } = this.ctx
      vfx.burst('water', new THREE.Vector3(this.zone.pos.x + 10, this.zone.base + 1.4, this.zone.pos.z + 4), 10)
    }
  }

  isComplete() { return this.complete }
  reset() { this.complete = false; this.init() }
}
