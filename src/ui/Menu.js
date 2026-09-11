// =====================================================================
// GREEN CODE — Menu
// Menú principal, pausa, configuración, créditos y pantalla final.
// =====================================================================

import { SaveSystem } from '../systems/SaveSystem.js'

export class Menu {
  constructor(callbacks = {}) {
    this.cb = callbacks
    this.screens = {}
    ;['loading', 'menu', 'howto', 'credits', 'settings', 'pause', 'end'].forEach((id) => {
      this.screens[id] = document.getElementById(id)
    })
    this.settings = SaveSystem.loadSettings()
    this._settingsReturn = 'menu'
    this._wire()
    this._applySettingsUI()
  }

  _wire() {
    const $ = (id) => document.getElementById(id)
    $('btn-play').onclick = () => this.cb.onPlay && this.cb.onPlay()
    $('btn-howto').onclick = () => this.show('howto')
    $('btn-credits').onclick = () => this.show('credits')
    $('btn-settings').onclick = () => this.openSettings('menu')
    document.querySelectorAll('[data-back]').forEach((b) => {
      b.onclick = () => this.openSettingsReturn()
    })
    $('btn-resume').onclick = () => this.cb.onResume && this.cb.onResume()
    $('btn-restart').onclick = () => this.cb.onRestart && this.cb.onRestart()
    $('btn-pause-settings').onclick = () => this.openSettings('pause')
    $('btn-pause-menu').onclick = () => this.cb.onMainMenu && this.cb.onMainMenu()
    $('btn-again').onclick = () => this.cb.onRestart && this.cb.onRestart()
    $('btn-end-menu').onclick = () => this.cb.onMainMenu && this.cb.onMainMenu()
    $('btn-start').onclick = () => this.cb.onStartMission && this.cb.onStartMission()
    $('btn-reset-save').onclick = () => {
      SaveSystem.clearProgress()
      if (this.cb.onResetSave) this.cb.onResetSave()
      this._flash($('btn-reset-save'), 'PROGRESO BORRADO')
    }

    // Settings
    const q = document.getElementById('set-quality')
    q.querySelectorAll('button').forEach((b) => {
      b.onclick = () => { q.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); this.settings.quality = b.dataset.q; this._save() }
    })
    const vol = document.getElementById('set-vol')
    vol.oninput = () => {
      this.settings.volume = vol.value / 100
      document.getElementById('vol-val').textContent = `${vol.value}%`
      this._save()
    }
    const bloom = document.getElementById('set-bloom')
    bloom.querySelectorAll('button').forEach((b) => {
      b.onclick = () => { bloom.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); this.settings.bloom = b.dataset.b === 'on'; this._save() }
    })
    const inv = document.getElementById('set-invert')
    inv.querySelectorAll('button').forEach((b) => {
      b.onclick = () => { inv.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); this.settings.invertY = b.dataset.i === 'on'; this._save() }
    })
  }

  _flash(btn, text) {
    const old = btn.textContent
    btn.textContent = text
    setTimeout(() => { btn.textContent = old }, 1200)
  }

  _save() {
    SaveSystem.saveSettings(this.settings)
    if (this.cb.onSettings) this.cb.onSettings(this.settings)
  }

  _applySettingsUI() {
    const s = this.settings
    document.getElementById('set-vol').value = Math.round(s.volume * 100)
    document.getElementById('vol-val').textContent = `${Math.round(s.volume * 100)}%`
    const setOn = (sel, attr, val) => {
      document.querySelectorAll(`${sel} button`).forEach((b) => b.classList.toggle('on', b.dataset[attr] === val))
    }
    setOn('#set-quality', 'q', s.quality)
    setOn('#set-bloom', 'b', s.bloom ? 'on' : 'off')
    setOn('#set-invert', 'i', s.invertY ? 'on' : 'off')
  }

  openSettings(returnTo) {
    this._settingsReturn = returnTo
    this.show('settings')
  }

  openSettingsReturn() {
    this.show(this._settingsReturn || 'menu')
  }

  show(id) {
    Object.values(this.screens).forEach((s) => s && s.classList.remove('active'))
    if (this.screens[id]) this.screens[id].classList.add('active')
  }

  hideAll() { Object.values(this.screens).forEach((s) => s && s.classList.remove('active')) }

  showMenu() { this.show('menu') }
  showPause() { this.show('pause') }
  showEnd() { this.show('end') }
}
