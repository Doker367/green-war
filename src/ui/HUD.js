// =====================================================================
// GREEN CODE — HUD
// Interfaz de juego: estado del ecosistema, objetivos, prompts, toasts.
// =====================================================================

export class HUD {
  constructor() {
    this.el = document.getElementById('hud')
    this.missionName = document.getElementById('hud-mission-name')
    this.bars = {
      water: document.getElementById('bar-water'),
      forest: document.getElementById('bar-forest'),
      fire: document.getElementById('bar-fire'),
      bio: document.getElementById('bar-bio')
    }
    this.vals = {
      water: document.getElementById('val-water'),
      forest: document.getElementById('val-forest'),
      fire: document.getElementById('val-fire'),
      bio: document.getElementById('val-bio')
    }
    this.health = document.getElementById('val-health')
    this.ring = document.querySelector('.health-ring')
    this.prompt = document.getElementById('prompt')
    this.crosshair = document.getElementById('crosshair')
    this.toastEl = document.getElementById('toast')
    this.subtitleEl = document.getElementById('subtitle')
    this.objectives = {
      water: document.querySelector('[data-obj="water"]'),
      fire: document.querySelector('[data-obj="fire"]'),
      trees: document.querySelector('[data-obj="trees"]')
    }
    this._toastTimer = null
    this._subTimer = null
    this._display = { ...this.vals, }
  }

  show() { this.el.classList.add('active') }
  hide() { this.el.classList.remove('active') }

  setMission(text) { this.missionName.textContent = text }

  update(s, instant = false) {
    const set = (key, value) => {
      const v = Math.round(value)
      this.bars[key].style.width = `${Math.min(100, value)}%`
      this.vals[key].textContent = `${v}%`
    }
    set('water', s.water)
    set('forest', s.forest)
    set('fire', s.fire)
    set('bio', s.biodiversity)

    const h = Math.round(s.health)
    this.health.textContent = `${h}%`
    if (this.ring) {
      this.ring.style.background =
        `conic-gradient(var(--green) ${h}%, rgba(255,255,255,0.08) ${h}%)`
    }

    // Objetivos
    this._setObjective(this.objectives.water, s.waterFixed, '1/1')
    this._setObjective(this.objectives.fire, s.fireFixed, `${s.fireTowers}/3`)
    this._setObjective(this.objectives.trees, s.reforestFixed, `${s.treesPlanted}/10`)
  }

  _setObjective(li, done, count) {
    if (!li) return
    li.classList.toggle('done', done)
    const em = li.querySelector('em')
    if (em) em.textContent = done ? '✓' : count
  }

  setPrompt(text) {
    if (text) {
      this.prompt.innerHTML = `<b>[E]</b>${text}`
      this.prompt.classList.add('show')
    } else {
      this.prompt.classList.remove('show')
    }
  }

  setCrosshairHot(hot) {
    this.crosshair.classList.toggle('hot', hot)
  }

  toast(main, sub = '') {
    this.toastEl.innerHTML = `<span class="big">${main}</span>${sub}`
    this.toastEl.classList.add('show')
    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 3600)
  }

  subtitle(text, duration = 4000) {
    if (!text) { this.subtitleEl.classList.remove('show'); return }
    this.subtitleEl.textContent = text
    this.subtitleEl.classList.add('show')
    clearTimeout(this._subTimer)
    this._subTimer = setTimeout(() => this.subtitleEl.classList.remove('show'), duration)
  }
}
