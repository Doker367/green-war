// =====================================================================
// GREEN CODE — Misión 3: Reforestación
// Planta las 10 semillas del búnker con animación de crecimiento.
// =====================================================================

export class ReforestationMission {
  constructor(ctx) {
    this.ctx = ctx
    this.name = 'REFORESTAR LA ZONA DAÑADA'
    this.complete = false
    this.planted = 0
    this.growing = []
  }

  init() {
    const { world, interaction } = this.ctx
    this.zone = world.zones.reforest
    this.spots = this.zone.spots
    this.spots.forEach((spot, i) => {
      interaction.register({
        id: `spot-${i}`,
        position: spot.pos,
        radius: 3.8,
        label: 'PLANTAR SEMILLA',
        available: () => !spot.tree,
        onInteract: () => this.openTerminal(spot, i)
      })
    })
  }

  openTerminal(spot, index) {
    const { gc, audio, ecosystem } = this.ctx
    audio.sfx('scan')

    if (!ecosystem.seedsFound) {
      gc.open({
        scanTime: 800,
        scanLabel: 'ANALIZANDO SUELO',
        problem: {
          title: 'ZONA DEGRADADA',
          system: 'REFORESTACIÓN',
          state: 'SIN SEMILLAS',
          rows: [
            { k: 'SEMILLAS', v: '0 DISPONIBLES', ok: false },
            { k: 'REQUIERE', v: 'BÚNKER AGRÍCOLA' }
          ]
        },
        hint: '[BLOQUEADO] CONSIGUE SEMILLAS EN EL BÚNKER',
        onReady: (gcUI) => {
          gcUI.logLine('> No tienes semillas. Encuentra el búnker.', 'warn')
          gcUI.setActions([{ label: 'CERRAR', onClick: () => gcUI.close() }])
        }
      })
      return
    }

    gc.open({
      scanTime: 1000,
      scanLabel: 'ANALIZANDO SUELO',
      problem: {
        title: 'ZONA DEGRADADA',
        system: 'REFORESTACIÓN',
        state: 'EROSIÓN ACTIVA',
        rows: [
          { k: 'HUMEDAD DEL SUELO', v: ecosystem.waterFixed ? 'ÓPTIMA' : '14%', ok: ecosystem.waterFixed },
          { k: 'SEMILLAS DISPONIBLES', v: `${ecosystem.seeds}`, ok: ecosystem.seeds > 0 }
        ]
      },
      hint: '[SISTEMA] PLANTAR',
      onReady: (gcUI) => this.buildActions(gcUI, spot, index)
    })
  }

  buildActions(gc, spot, index) {
    gc.logLine('> Punto de plantado preparado.')
    gc.setActions([
      { label: 'PLANTAR SEMILLA', primary: true, onClick: () => this.plant(gc, spot) }
    ])
  }

  async plant(gc, spot) {
    const { ecosystem, audio, hud, world } = this.ctx
    if (!ecosystem.useSeed()) {
      gc.logLine('✗ Sin semillas disponibles', 'warn')
      return
    }

    // Efecto inmediato (robusto aunque se cierre la terminal)
    const tree = this.ctx.assets.get('tree_alive')
    tree.userData.isShoot = true
    tree.scale.setScalar(0.02)
    tree.position.set(spot.pos.x, spot.pos.y, spot.pos.z)
    tree.rotation.y = Math.random() * Math.PI * 2
    world.groups.reforest.add(tree)
    spot.tree = tree
    spot.ring.visible = false
    spot.marker.visible = false
    this.growing.push({ tree, t: 0, target: 1.2 + Math.random() * 0.6 })

    ecosystem.plantTree()
    this.planted = ecosystem.treesPlanted
    audio.sfx('plant')
    this.ctx.vfx.burst('dust', spot.pos, 26)

    if (ecosystem.reforestFixed) {
      this.complete = true
      hud.toast('ZONA REFORESTADA', 'La vida regresa al valle')
      world.showBeacon('reforest', false)
    } else {
      hud.toast('ÁRBOL PLANTADO', `Restauración ${ecosystem.treesPlanted * 10}% · Semillas: ${ecosystem.seeds}`)
    }

    gc.clearActions()
    await gc.progress('PLANTANDO ', 1200)
    await gc.runSteps([
      { text: '✓ SEMILLA COLOCADA', cls: 'ok', delay: 300 },
      { text: '✓ RIEGO INICIAL APLICADO', cls: 'ok', delay: 300 },
      { text: '✓ ÁRBOL EN CRECIMIENTO', cls: 'ok', delay: 420 }
    ])
    gc.setHint('[COMPLETADO] PULSA ESC')
  }

  update(dt) {
    for (const g of this.growing) {
      if (g.t >= 1) continue
      g.t += dt / 1.6
      const k = Math.min(1, g.t)
      const eased = 1 - Math.pow(1 - k, 3)
      g.tree.scale.setScalar(0.02 + eased * g.target)
      g.tree.position.y = this.ctx.world.getHeight(g.tree.position.x, g.tree.position.z)
    }
  }

  isComplete() { return this.complete }
  reset() { this.complete = false; this.planted = 0; this.growing = [] }
}
