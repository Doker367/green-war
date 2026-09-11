// =====================================================================
// GREEN CODE — GreenCodeUI
// La terminal de campo: escaneo, diagnóstico, acciones y logs.
// =====================================================================

export class GreenCodeUI {
  constructor() {
    this.el = document.getElementById('greencode')
    this.scan = document.getElementById('gc-scan')
    this.problem = document.getElementById('gc-problem')
    this.stats = document.getElementById('gc-stats')
    this.solution = document.getElementById('gc-solution')
    this.actions = document.getElementById('gc-actions')
    this.log = document.getElementById('gc-log')
    this.hint = document.getElementById('gc-hint')
    this.closeBtn = document.getElementById('gc-close')
    this.isOpen = false
    this.onClose = null
    this.closeBtn.onclick = () => this.close()
  }

  open(config = {}) {
    this.isOpen = true
    this.config = config
    this.el.classList.add('active')
    this.problem.classList.add('hidden')
    this.solution.classList.add('hidden')
    this.actions.innerHTML = ''
    this.stats.innerHTML = ''
    this.log.innerHTML = ''
    this.scan.style.display = 'block'
    this.scan.innerHTML = `${config.scanLabel || 'ESCANEANDO ENTORNO'}<span class="dots">...</span>`
    this.setHint('[ANALIZANDO]')

    const dur = config.scanTime ?? 1200
    this._scanTimer = setTimeout(() => {
      this.scan.style.display = 'none'
      this._reveal(config)
    }, dur)
  }

  _reveal(config) {
    if (config.problem) this.setProblem(config.problem)
    if (config.stats) {
      this.stats.innerHTML = config.stats
        .map((r) => `<div class="row"><span>${r.k}</span><b class="${r.ok ? 'ok' : ''}">${r.v}</b></div>`)
        .join('')
    }
    if (config.actions) this.setActions(config.actions)
    this.setHint(config.hint || '[E] SALIR')
    if (config.onReady) config.onReady(this)
  }

  setProblem(p) {
    this.problem.classList.remove('hidden')
    this.problem.innerHTML = `
      <h4>${p.title || 'PROBLEMA DETECTADO'}</h4>
      <div class="row"><span>SISTEMA</span><b>${p.system || '—'}</b></div>
      <div class="row"><span>ESTADO</span><b>${p.state || 'CRÍTICO'}</b></div>
      ${p.loss ? `<div class="row"><span>PÉRDIDA ESTIMADA</span><b>${p.loss}</b></div>` : ''}
      ${p.rows ? p.rows.map((r) => `<div class="row"><span>${r.k}</span><b class="${r.ok ? 'ok' : ''}">${r.v}</b></div>`).join('') : ''}
    `
  }

  setActions(list) {
    this.actions.innerHTML = ''
    list.forEach((a) => {
      const btn = document.createElement('button')
      btn.className = `btn ${a.primary ? 'primary' : ''}`
      btn.textContent = a.label
      btn.onclick = () => a.onClick && a.onClick(this)
      this.actions.appendChild(btn)
    })
  }

  clearActions() { this.actions.innerHTML = '' }

  setSolution(title) {
    this.solution.classList.remove('hidden')
    this.solution.innerHTML = `<h5>${title || 'SOLUCIÓN DISPONIBLE'}</h5>`
  }

  setHint(text) { this.hint.textContent = text }

  logLine(text, cls = '') {
    const div = document.createElement('div')
    div.className = cls
    div.textContent = text
    this.log.appendChild(div)
    this.log.scrollTop = this.log.scrollHeight
    return div
  }

  wait(ms) { return new Promise((r) => setTimeout(r, ms)) }

  async runSteps(steps) {
    for (const s of steps) {
      if (!this.isOpen) return
      this.logLine(s.text, s.cls || '')
      if (s.sound && this.onSound) this.onSound('type')
      await this.wait(s.delay ?? 320)
    }
  }

  progress(label, duration = 1400) {
    return new Promise((resolve) => {
      const line = this.logLine('')
      line.innerHTML = `${label} <span class="pbar" style="display:inline-block;width:0;height:8px;background:linear-gradient(90deg,#0c7a45,#35e07a);vertical-align:middle;box-shadow:0 0 10px #35e07a"></span> <span class="pct">0%</span>`
      const bar = line.querySelector('.pbar')
      const pct = line.querySelector('.pct')
      const start = performance.now()
      const tick = (t) => {
        if (!this.isOpen) return resolve()
        const k = Math.min(1, (t - start) / duration)
        bar.style.width = `${Math.round(k * 100)}px`
        bar.style.maxWidth = '140px'
        pct.textContent = `${Math.round(k * 100)}%`
        if (k < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
  }

  close() {
    if (!this.isOpen) return
    this.isOpen = false
    clearTimeout(this._scanTimer)
    this.el.classList.remove('active')
    if (this.onClose) this.onClose()
  }
}
