// =====================================================================
// GREEN CODE — Game
// Núcleo: render, postprocesado, estados, loop y orquestación.
// =====================================================================

import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

import { AssetManager } from './AssetManager.js'
import { AudioManager } from './AudioManager.js'
import { Environment } from '../world/Environment.js'
import { World } from '../world/World.js'
import { VFXManager } from '../effects/VFXManager.js'
import { Player } from '../player/Player.js'
import { CameraController } from '../player/CameraController.js'
import { MutantCharacter, ViewMode } from '../player/MutantCharacter.js'
import { InteractionSystem } from '../systems/InteractionSystem.js'
import { EcosystemSystem } from '../systems/EcosystemSystem.js'
import { SaveSystem } from '../systems/SaveSystem.js'
import { MissionManager } from '../missions/MissionManager.js'
import { HUD } from '../ui/HUD.js'
import { Menu } from '../ui/Menu.js'
import { GreenCodeUI } from '../ui/GreenCodeUI.js'

const State = { LOADING: 'loading', MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', ENDING: 'ending', END: 'end' }

export class Game {
  constructor(container) {
    this.container = container
    this.state = State.LOADING
    this.clock = new THREE.Clock()
    this.settings = SaveSystem.loadSettings()
    this._menuAngle = 0
    this._endT = 0

    this._initRenderer()
    this._initScene()
    this._initManagers()
    this._initInput()
    this._initLoadingUI()

    this._load()
    this._loop = this._loop.bind(this)
    requestAnimationFrame(this._loop)
  }

  // =====================================================================
  //  RENDER
  // =====================================================================
  _initRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer = renderer
    this.qualityPreset(this.settings.quality, true)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.9
    renderer.outputColorSpace = THREE.SRGBColorSpace
    this.container.appendChild(renderer.domElement)
  }

  qualityPreset(q, silent = false) {
    const map = { low: 1, med: 1.4, high: 2 }
    const ratio = Math.min(window.devicePixelRatio || 1, map[q] || 1.4)
    this.renderer.setPixelRatio(ratio)
    if (this.renderer.domElement) {
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    }
    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = q !== 'low'
    }
  }

  _initScene() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1200)
    this.camera.position.set(0, 16, 46)
    this.environment = new Environment(this.scene, this.renderer)

    this.composer = new EffectComposer(this.renderer)
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.settings.bloom ? 0.34 : 0.0, 0.6, 1.0
    )
    this.outputPass = new OutputPass()
    this.composer.addPass(this.renderPass)
    this.composer.addPass(this.bloom)
    this.composer.addPass(this.outputPass)
    this.composer.setSize(window.innerWidth, window.innerHeight)

    window.addEventListener('resize', () => this._onResize())
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this._updatePixelRatio()
  }

  _updatePixelRatio() {
    const map = { low: 1, med: 1.4, high: 2 }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, map[this.settings.quality] || 1.4))
  }

  // =====================================================================
  //  MANAGERS
  // =====================================================================
  _initManagers() {
    this.assets = new AssetManager()
    this.audio = new AudioManager()
    this.vfx = new VFXManager(this.scene, this.settings.quality)
    this.ecosystem = new EcosystemSystem()
    this.hud = new HUD()
    this.gc = new GreenCodeUI()
    this.interaction = new InteractionSystem()
    this.player = new Player(this.camera, null)
    this.character = new MutantCharacter()
    this.character.attach(this.scene)
    this.player.character = this.character
    this.viewMode = ViewMode.FIRST
    this.player.setViewMode(this.viewMode)
    this.cameraController = new CameraController(this.camera, this.renderer.domElement)
    this.cameraController.invertY = this.settings.invertY
    this.cameraController.onLockChange = (locked) => this._onLockChange(locked)

    this.menu = new Menu({
      onPlay: () => this.startMission(),
      onStartMission: () => this.startMission(),
      onResume: () => this.resume(),
      onRestart: () => this.restart(),
      onMainMenu: () => this.toMainMenu(),
      onSettings: (s) => this.applySettings(s),
      onResetSave: () => this.hud.toast('SISTEMA', 'Progreso eliminado')
    })

    this.gc.onSound = (n) => this.audio.sfx(n)
    this.gc.onClose = () => this._onGCClosed()

    this.audio.setVolume(this.settings.volume)

    // Reacciones al ecosistema
    this.ecosystem.on('change', (s) => this._onEcosystemChange(s))
    this.ecosystem.on('event', (e) => this._onEcosystemEvent(e))
  }

  _onEcosystemChange(s) {
    this.hud.update(s)
    this.environment.setRestoration(this.ecosystem.restoration)
    this.vfx.setRestoration(this.ecosystem.restoration)
    this.audio.setBiodiversity(s.biodiversity / 100)
    this.audio.setWaterLevel(s.water / 100)
    this.audio.setFireLevel(s.fire / 100)
    SaveSystem.saveProgress(this.ecosystem)

    if (s.waterFixed && s.fireFixed && s.reforestFixed) this.audio.setMood('restored')
    else if (s.fire > 55) this.audio.setMood('fire')
    else this.audio.setMood('calm')

    if (this.missionManager) this.hud.setMission(this.missionManager.currentName)

    if (this.ecosystem.done && this.state === State.PLAYING) {
      this._startFinish()
    }
  }

  _onEcosystemEvent(e) {
    if (e.type === 'map') this.hud.subtitle('Un mapa marca un búnker de semillas. Sigue la baliza cian.', 5200)
    if (e.type === 'seeds') this.hud.subtitle('Semillas nativas a salvo. Ahora hay que plantarlas.', 5200)
    if (e.type === 'water') this.hud.subtitle('El río vuelve a estar limpio y la vida regresa.', 5200)
    if (e.type === 'fire') this.hud.subtitle('El humo se disipa. El bosque respira de nuevo.', 5200)
    if (e.type === 'reforest') this.hud.subtitle('Los árboles crecen. La vida regresa al valle.', 5200)
  }

  applySettings(s) {
    this.settings = s
    this.audio.setVolume(s.volume)
    this.cameraController.invertY = s.invertY
    this.bloom.strength = s.bloom ? 0.34 : 0.0
    this.qualityPreset(s.quality)
    this.environment._apply(this.environment.restoration)
  }

  // =====================================================================
  //  INPUT
  // =====================================================================
  _initInput() {
    this.input = { forward: false, back: false, left: false, right: false, run: false, jump: false, crouch: false }
    const map = {
      KeyW: 'forward', ArrowUp: 'forward',
      KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump',
      ControlLeft: 'crouch', ControlRight: 'crouch', KeyC: 'crouch'
    }
    window.addEventListener('keydown', (e) => {
      if (map[e.code] !== undefined) { this.input[map[e.code]] = true; if (e.code === 'Space') e.preventDefault() }
      if (e.code === 'KeyE') this._onInteractKey()
      if (e.code === 'KeyV') this._toggleView()
      if (e.code === 'Escape') this._onEscape()
      if (this.state === State.PLAYING && !this.gc.isOpen && this.character) {
        if (e.code === 'KeyF') this.character.playOneShot('attack')
        if (e.code === 'KeyH') this.character.playOneShot('hit')
        if (e.code === 'KeyK') this.character.playOneShot('death')
      }
    })
    window.addEventListener('keyup', (e) => {
      if (map[e.code] !== undefined) this.input[map[e.code]] = false
    })
    // Pointer lock: pedir al hacer click en el canvas durante el juego
    this.renderer.domElement.addEventListener('click', () => {
      if (this.state === State.PLAYING && !this.gc.isOpen) this.cameraController.requestLock()
    })
  }

  _onInteractKey() {
    if (this.state !== State.PLAYING || this.gc.isOpen) return
    if (this.interaction.trigger()) {
      this.audio.sfx('interact')
      if (this.gc.isOpen) this.cameraController.exitLock()
    }
  }

  _onEscape() {
    if (this.gc.isOpen) { this.gc.close(); return }
    if (this.state === State.PLAYING) this.pause()
  }

  _toggleView() {
    if (this.state !== State.PLAYING && this.state !== State.PAUSED) return
    if (this.gc.isOpen) return
    const order = [ViewMode.FIRST, ViewMode.THIRD, ViewMode.FRONT]
    const i = order.indexOf(this.viewMode)
    this.viewMode = order[(i + 1) % order.length]
    this.player.setViewMode(this.viewMode)
    this.cameraController.bindCamera = this.viewMode === ViewMode.FIRST
    this.hud.setCrosshairVisible(this.viewMode === ViewMode.FIRST)
    const labels = {
      [ViewMode.FIRST]: 'PRIMERA PERSONA',
      [ViewMode.THIRD]: 'TERCERA PERSONA',
      [ViewMode.FRONT]: 'CÁMARA FRONTAL'
    }
    this.hud.toast('VISTA', labels[this.viewMode])
  }

  _onLockChange(locked) {
    if (!locked && this.state === State.PLAYING && !this.gc.isOpen) {
      this.pause()
    }
  }

  // =====================================================================
  //  CARGA
  // =====================================================================
  _initLoadingUI() {
    this.loadBar = document.getElementById('load-bar')
    this.loadPct = document.getElementById('load-pct')
    this.loadSteps = Array.from(document.querySelectorAll('#load-steps li'))
    this.btnStart = document.getElementById('btn-start')
    this.fadeEl = document.getElementById('fade')
  }

  setProgress(p) {
    p = Math.round(p)
    if (this.loadBar) this.loadBar.style.width = `${p}%`
    if (this.loadPct) this.loadPct.textContent = `${p}%`
  }

  setStep(i) {
    this.loadSteps.forEach((li, idx) => li.classList.toggle('done', idx <= i))
  }

  async _load() {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    try {
      this.setStep(0); this.setProgress(8); await wait(350)
      this.environment.setRestoration(0)

      // Precarga opcional de GLB (si no existen, se usan placeholders)
      this.setProgress(20)
      await this.assets.preload((name) => {
        // Modelo real encontrado
      })
      this.setStep(1); this.setProgress(38); await wait(250)

      // Mundo
      this.world = new World(this.scene, this.assets, this.vfx)
      this.player.world = this.world
      this.setStep(2); this.setProgress(58); await wait(220)

      // Misiones
      this.missionManager = new MissionManager({
        world: this.world,
        assets: this.assets,
        ecosystem: this.ecosystem,
        vfx: this.vfx,
        hud: this.hud,
        gc: this.gc,
        audio: this.audio,
        player: this.player,
        interaction: this.interaction,
        game: this
      })
      this.setStep(3); this.setProgress(72); await wait(220)

      this.ecosystem._emitChange()
      this.setStep(4); this.setProgress(86); await wait(220)

      this.setStep(5); this.setProgress(100); await wait(300)

      this.btnStart.classList.remove('hidden')
      this.state = State.LOADING // espera pulsación
    } catch (err) {
      console.error('Error durante la carga:', err)
      this.setProgress(100)
      this.btnStart.classList.remove('hidden')
    }
  }

  // =====================================================================
  //  ESTADOS
  // =====================================================================
  _fade(to, ms = 600) {
    if (!this.fadeEl) return
    this.fadeEl.style.transition = `opacity ${ms}ms ease`
    this.fadeEl.classList.toggle('show', to)
  }

  startMission() {
    this.audio.start()
    this._fade(true, 500)
    setTimeout(() => {
      this.menu.hideAll()
      this.hud.show()
      this.state = State.PLAYING
      this.cameraController.enabled = true
      this.gc.isOpen = false
      this._fade(false, 700)
      this.cameraController.requestLock()
      this.hud.setMission(this.missionManager.currentName)
      this.hud.setCrosshairVisible(this.viewMode === ViewMode.FIRST)
      this.hud.subtitle('El Sujeto Cero despierta en el refugio. Registra la zona con GREEN CODE.', 6500)
    }, 520)
  }

  pause() {
    if (this.state !== State.PLAYING) return
    this.state = State.PAUSED
    this.cameraController.enabled = false
    this.cameraController.exitLock()
    this.menu.showPause()
  }

  resume() {
    if (this.state !== State.PAUSED) return
    this.menu.hideAll()
    this.state = State.PLAYING
    this.cameraController.enabled = true
    this.cameraController.requestLock()
  }

  restart() {
    this._fade(true, 400)
    setTimeout(() => {
      this.scene.remove(this.vfx ? this.vfx.wildlife : new THREE.Group())
      // Reconstruir mundo y misiones limpiamente
      if (this.world) {
        this.scene.remove(this.world.terrain)
        ;[this.world.groups.community, this.world.groups.water, this.world.groups.fire,
          this.world.groups.reforest, this.world.groups.paths, this.world.aliveGroup, this.world.grass]
          .forEach((g) => g && this.scene.remove(g))
      }
      if (this.vfx) {
        this.vfx.fields.forEach((f) => this.scene.remove(f.points))
        this.vfx.fireLights.forEach((l) => this.scene.remove(l))
      }
      // Nota: para el MVP se recarga la página como reinicio robusto.
      SaveSystem.clearProgress()
      window.location.reload()
    }, 420)
  }

  toMainMenu() {
    this.state = State.MENU
    this.hud.hide()
    this.cameraController.enabled = false
    this.cameraController.exitLock()
    this.menu.showMenu()
  }

  _onGCClosed() {
    if (this.state === State.PLAYING) {
      this.cameraController.enabled = true
      this.cameraController.requestLock()
    }
  }

  _startFinish() {
    this.state = State.ENDING
    this.cameraController.enabled = false
    this.cameraController.exitLock()
    this._endT = 0
    this.hud.subtitle('¡Ecosistema restaurado! Cada decisión cuenta.', 6000)
    this.audio.setMood('restored')
    this.audio.sfx('confirm')
    setTimeout(() => {
      this.state = State.END
      this.hud.hide()
      this.menu.showEnd()
    }, 4200)
  }

  // =====================================================================
  //  LOOP
  // =====================================================================
  _loop() {
    requestAnimationFrame(this._loop)
    const dt = Math.min(0.05, this.clock.getDelta())
    const t = this.clock.elapsedTime

    if (this.state === State.PLAYING || this.state === State.PAUSED || this.state === State.ENDING || this.state === State.END) {
      if (this.state === State.PLAYING && !this.gc.isOpen) {
        this.player.update(dt, this.input, this.cameraController.yaw, this.cameraController.pitch)
        this.cameraController.update()
        this.character.updateLighting(this.camera)
        const near = this.interaction.check(this.player.eyePosition)
        this.hud.setPrompt(near ? near.label : '')
        this.hud.setCrosshairHot(!!near)
      } else if (this.gc.isOpen) {
        this.hud.setPrompt('')
        this.hud.setCrosshairHot(false)
      } else if (this.state === State.ENDING) {
        this._updateEndingCamera(dt)
      }
      if (this.missionManager) this.missionManager.update(dt)
    } else {
      this._menuCamera(t, dt)
    }

    this.environment.update(dt)
    if (this.world) this.world.update(dt, this.ecosystem.restoration)
    this.vfx.update(dt, this.ecosystem)

    this.composer.render()
  }

  _menuCamera(t, dt) {
    this._menuAngle += dt * 0.06
    const r = 48 + Math.sin(this._menuAngle * 0.5) * 4
    this.camera.position.set(Math.cos(this._menuAngle) * r, 16 + Math.sin(t * 0.3) * 2, Math.sin(this._menuAngle) * r)
    this.camera.lookAt(0, 5, 0)
  }

  _updateEndingCamera(dt) {
    this._endT += dt
    const k = Math.min(1, this._endT / 4)
    const e = 1 - Math.pow(1 - k, 2)
    const px = this.camera.position.x
    const pz = this.camera.position.z
    this.camera.position.lerpVectors(
      new THREE.Vector3(px, this.camera.position.y, pz),
      new THREE.Vector3(0, 40, 78),
      e * 0.06
    )
    this.camera.lookAt(0, 4, 0)
  }
}
