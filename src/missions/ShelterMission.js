// =====================================================================
// GREEN CODE — Misión 0: El Refugio
// Entrar al refugio, abrir los cofres, encontrar el MAPA y localizar
// el búnker de semillas.
// =====================================================================

import { damp } from '../core/Utils.js'

const CHEST_INFO = {
  wood: { title: 'COFRE DE MADERA', color: 'MADERA', loot: 'suministros' },
  metal: { title: 'COFRE METÁLICO', color: 'METAL', loot: 'herramientas' },
  rusty: { title: 'COFRE OXIDADO', color: 'ÓXIDO', loot: 'mapa' }
}

export class ShelterMission {
  constructor(ctx) {
    this.ctx = ctx
    this.name = 'EXPLORAR EL REFUGIO'
    this.inside = false
    this.chests = []
  }

  init() {
    const { world, interaction } = this.ctx
    this.zone = world.zones.refugio
    this.chests = this.zone.chests

    this.chests.forEach((chest, i) => {
      interaction.register({
        id: `chest-${i}`,
        position: chest,
        radius: 3.0,
        label: `ABRIR ${CHEST_INFO[chest.userData.kind].title}`,
        available: () => !chest.userData.opened,
        onInteract: () => this.openChest(chest)
      })
    })

    // Búnker
    interaction.register({
      id: 'bunker',
      position: world.zones.bunker.hatch,
      radius: 7,
      label: 'INSPECCIONAR BÚNKER AGRÍCOLA',
      available: () => !this.ctx.ecosystem.seedsFound,
      onInteract: () => this.openBunker()
    })
  }

  // Lógica de entrada/salida del refugio
  update(dt) {
    const p = this.ctx.player.position
    const c = this.zone.inside
    const d = Math.hypot(p.x - c.x, p.z - c.z)
    const nowInside = d < this.zone.insideRadius

    if (nowInside && !this.inside) {
      this.inside = true
      this.ctx.audio.sfx('interact')
      this.ctx.audio.note(220, 0.5, 0.06, 'sine')
      if (this.zone.light) this.zone.light.intensity = 1.8
      if (this.zone.lampMat) this.zone.lampMat.emissiveIntensity = 1.4
      this.ctx.hud.subtitle('Refugio de Alex. Hay cofres: busca algo útil…', 4600)
      // Actualiza objetivo de la misión a "buscar el mapa"
      if (!this.ctx.ecosystem.mapFound) {
        this.ctx.hud.setMission('REGISTRAR EL REFUGIO Y HALLAR EL MAPA')
      }
    } else if (!nowInside && this.inside) {
      this.inside = false
      if (this.zone.light) this.zone.light.intensity = 0
      if (this.zone.lampMat) this.zone.lampMat.emissiveIntensity = 0.2
    }

    // Animación de las tapas de los cofres
    for (const chest of this.chests) {
      const lid = chest.userData.lid
      const target = chest.userData.lidTarget || 0
      lid.rotation.x = damp(lid.rotation.x, target, 8, dt)
    }
  }

  openChest(chest) {
    const { gc, audio, ecosystem, world, hud } = this.ctx
    const info = CHEST_INFO[chest.userData.kind]
    chest.userData.opened = true
    chest.userData.lidTarget = -2.1
    audio.sfx('confirm')

    if (chest.userData.loot === 'mapa') {
      gc.open({
        scanTime: 900,
        scanLabel: 'ABRIENDO COFRE',
        problem: {
          title: info.title,
          system: 'CONTENIDO',
          state: 'ENCONTRADO',
          rows: [
            { k: 'OBJETO', v: 'MAPA TOPOGRÁFICO', ok: true },
            { k: 'MARCADO', v: 'BÚNKER AGRÍCOLA' },
            { k: 'ESTADO', v: 'LEGIBLE', ok: true }
          ]
        },
        hint: '[SISTEMA] ESTUDIAR MAPA',
        onReady: (gcUI) => {
          gcUI.logLine('> La tinta está corrida, pero se lee…')
          gcUI.logLine('> "Búnker 04 — Reserva de semillas nativas."')
          gcUI.setActions([{
            label: 'EXAMINAR MAPA',
            primary: true,
            onClick: () => this.revealMap(gc, world, ecosystem, hud)
          }])
        }
      })
    } else {
      const loot = info.loot === 'suministros'
        ? ['AGUA POTABLE', 'VENDAS', 'LATA DE COMIDA']
        : ['MULTIHERRAMIENTA', 'PALA PLEGABLE', 'CUERDA']
      gc.open({
        scanTime: 800,
        scanLabel: 'ABRIENDO COFRE',
        problem: {
          title: info.title,
          system: 'CONTENIDO',
          state: 'REGISTRADO',
          rows: loot.map((l) => ({ k: 'OBJETO', v: l, ok: true }))
        },
        hint: '[SISTEMA] GUARDAR',
        onReady: (gcUI) => {
          gcUI.logLine('> Suministros añadidos a tu mochila.')
          gcUI.setActions([{ label: 'GUARDAR', onClick: () => gcUI.close() }])
        }
      })
    }
  }

  async revealMap(gc, world, ecosystem, hud) {
    // El efecto se aplica de inmediato (robusto aunque se cierre la terminal)
    world.showBeacon('bunker', true)
    ecosystem.findMap()
    hud.toast('MAPA OBTENIDO', 'Baliza cian: Búnker Agrícola')
    hud.subtitle('Un búnker guarda semillas nativas. Sigue la baliza cian.', 6000)
    gc.clearActions()
    await gc.progress('DESCIFRANDO COORDENADAS ', 1400)
    await gc.runSteps([
      { text: '✓ MAPA PUESTO EN EL HUD', cls: 'ok', delay: 360 },
      { text: '✓ COORDENADAS DEL BÚNKER MARCADAS', cls: 'ok', delay: 420 }
    ])
    gc.setHint('[OBJETIVO] VE AL BÚNKER')
  }

  openBunker() {
    const { gc, audio, ecosystem, hud, world } = this.ctx
    audio.sfx('scan')

    // Faltan las coordenadas
    if (!ecosystem.mapFound) {
      gc.open({
        scanTime: 800,
        scanLabel: 'IDENTIFICANDO ESTRUCTURA',
        problem: {
          title: 'BÚNKER AGRÍCOLA',
          system: 'ACCESO',
          state: 'BLOQUEADO',
          rows: [
            { k: 'CODIFICACIÓN', v: 'DESCONOCIDA', ok: false },
            { k: 'REQUIERE', v: 'MAPA / COORDENADAS' }
          ]
        },
        hint: '[BLOQUEADO] BUSCA EL MAPA EN EL REFUGIO',
        onReady: (gcUI) => {
          gcUI.logLine('> Acceso denegado. Necesitas las coordenadas.', 'warn')
          gcUI.setActions([{ label: 'CERRAR', onClick: () => gcUI.close() }])
        }
      })
      return
    }

    gc.open({
      scanTime: 900,
      scanLabel: 'ESCANEANDO BÚNKER',
      problem: {
        title: 'BÚNKER AGRÍCOLA 04',
        system: 'RESERVA DE SEMILLAS',
        state: 'DISPONIBLE',
        rows: [
          { k: 'SEMILLAS', v: '10 UNIDADES', ok: true },
          { k: 'VIABILIDAD', v: '92%', ok: true },
          { k: 'TEMPERATURA', v: 'ESTABLE', ok: true }
        ]
      },
      hint: '[SISTEMA] EXTRAER SEMILLAS',
      onReady: (gcUI) => {
        gcUI.logLine('> Cámara criogénica en línea.')
        gcUI.setActions([{
          label: 'EXTRAER SEMILLAS',
          primary: true,
          onClick: () => this.takeSeeds(gc, ecosystem, hud, world)
        }])
      }
    })
  }

  async takeSeeds(gc, ecosystem, hud, world) {
    ecosystem.findSeeds()
    world.showBeacon('bunker', false)
    world.showBeacon('reforest', true)
    hud.toast('SEMILLAS OBTENIDAS', 'Busca la zona de reforestación')
    hud.subtitle('Ahora planta las semillas en la zona dañada (baliza verde).', 6000)
    gc.clearActions()
    await gc.progress('EXTRAYENDO SEMILLAS ', 1500)
    await gc.runSteps([
      { text: '✓ 10 SEMILLAS NATIVAS OBTENIDAS', cls: 'ok', delay: 380 },
      { text: '✓ INVENTARIO ACTUALIZADO', cls: 'ok', delay: 380 }
    ])
    gc.setHint('[OBJETIVO] REFORESTAR')
  }

  isComplete() { return this.ctx.ecosystem.seedsFound }
  reset() { this.inside = false }
}
