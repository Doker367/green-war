// =====================================================================
// GREEN CODE — Misión 2: Incendio Forestal
// Activar 3 torres de control para sofocar el fuego.
// =====================================================================

import * as THREE from 'three'

export class FireMission {
  constructor(ctx) {
    this.ctx = ctx
    this.name = 'CONTROLAR EL INCENDIO FORESTAL'
    this.complete = false
    this.towers = []
    this.activated = [false, false, false]
  }

  init() {
    const { world, interaction } = this.ctx
    this.zone = world.zones.fire
    this.towers = this.zone.towers
    this.towers.forEach((tower, i) => {
      interaction.register({
        id: `tower-${i}`,
        position: tower.position,
        radius: 6,
        label: `ACTIVAR TORRE 0${i + 1}`,
        available: () => !this.activated[i],
        onInteract: () => this.openTerminal(i)
      })
    })
  }

  openTerminal(index) {
    const { gc, audio, ecosystem } = this.ctx
    audio.sfx('scan')
    const risk = [90, 72, 48][ecosystem.fireTowers] || 90
    gc.open({
      scanTime: 1300,
      scanLabel: 'ESCANEANDO FOCO DE INCENDIO',
      problem: {
        title: 'INCENDIO FORESTAL DETECTADO',
        system: `TORRE DE CONTROL 0${index + 1}`,
        state: 'FUERA DE LÍNEA',
        rows: [
          { k: 'RIESGO DE PROPAGACIÓN', v: 'ALTO', ok: false },
          { k: 'TEMPERATURA', v: `${Math.round(600 + Math.random() * 200)}°C`, ok: false },
          { k: 'TORRES ACTIVAS', v: `${ecosystem.fireTowers}/3` }
        ]
      },
      hint: '[SISTEMA] ACTIVAR SUPRESIÓN',
      onReady: (gcUI) => this.buildActions(gcUI, index)
    })
  }

  buildActions(gc, index) {
    gc.logLine('> Punto de control listo para supresión.')
    gc.setActions([
      {
        label: `ACTIVAR TORRE 0${index + 1}`,
        primary: true,
        onClick: () => this.activate(gc, index)
      }
    ])
  }

  async activate(gc, index) {
    const { ecosystem, vfx, audio, hud } = this.ctx
    gc.clearActions()

    this.activated[index] = true
    const tower = this.towers[index]
    if (tower.userData.lightMat) {
      tower.userData.lightMat.emissive.setHex(0x35e07a)
      tower.userData.lightMat.emissiveIntensity = 2.4
    }
    ecosystem.activateTower()
    audio.sfx('confirm')
    vfx.burst('water', new THREE.Vector3(tower.position.x, tower.position.y + 5, tower.position.z), 70)

    await gc.progress(`ACTIVANDO TORRE 0${index + 1} `, 1400)
    await gc.runSteps([
      { text: '✓ ENLACE ESTABLECIDO', cls: 'ok', delay: 340 },
      { text: '✓ DESCARGA DE AGUA ACTIVA', cls: 'ok', delay: 340 },
      { text: `✓ FUEGO REDUCIDO A ${Math.round(ecosystem.fire)}%`, cls: 'ok', delay: 420 }
    ])

    if (this.activated.every(Boolean)) {
      this.complete = true
      audio.setFireLevel(0)
      hud.toast('INCENDIO CONTROLADO', 'El humo se disipa')
    } else {
      hud.toast(`TORRE 0${index + 1} ACTIVA`, `Fuego al ${Math.round(ecosystem.fire)}%`)
    }
    gc.setHint('[COMPLETADO] PULSA ESC')
  }

  update(dt) {
    // Las torres activas emiten vapor
    this._t = (this._t || 0) - dt
    if (this.complete && this._t <= 0) {
      this._t = 1.2
      const { vfx } = this.ctx
      this.activated.forEach((a, i) => {
        if (!a) return
        const t = this.towers[i]
        vfx.burst('water', new THREE.Vector3(t.position.x, t.position.y + 5.5, t.position.z), 6)
      })
    }
  }

  isComplete() { return this.complete }
  reset() {
    this.complete = false
    this.activated = [false, false, false]
    this.towers.forEach((t) => {
      if (t.userData.lightMat) {
        t.userData.lightMat.emissive.setHex(0xff2222)
        t.userData.lightMat.emissiveIntensity = 2
      }
    })
  }
}
