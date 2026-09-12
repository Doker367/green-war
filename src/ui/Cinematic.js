// =====================================================================
// GREEN CODE — Cinematic
// Cinemática introductoria narrativa.
// =====================================================================

const SCENES = [
  {
    text: 'Año 2076. El Amazonas, el último pulmón de la Tierra, ha sido casi erradicado.',
    theme: 'ash',
    duration: 5000
  },
  {
    text: 'Los gobiernos del mundo entendieron demasiado tarde el impacto del calentamiento global.',
    theme: 'fire',
    duration: 5000
  },
  {
    text: 'Ante el inminente colapso, los ricos y poderosos abandonaron el planeta en naves estelares...',
    theme: 'ships',
    duration: 6500
  },
  {
    text: 'Dejando al resto de la humanidad a su suerte en un mundo marchito y en ruinas.',
    theme: 'dust',
    duration: 5200
  },
  {
    text: 'Pero no todo está perdido. Rumores de un proyecto llamado GREEN CODE circulan entre los sobrevivientes.',
    theme: 'hope',
    duration: 5500
  }
]

export class Cinematic {
  constructor(callbacks = {}) {
    this.cb = callbacks
    this.el = document.getElementById('cinematic')
    this.textEl = document.getElementById('cinematic-text')
    this.sceneEl = document.getElementById('cinematic-scene')
    this.skipBtn = document.getElementById('cinematic-skip')
    this.counterEl = document.getElementById('cinematic-counter')
    this.bottomBar = document.querySelector('.cinematic-bottom')
    this.finalEl = document.getElementById('cinematic-final')
    this.finalBtn = document.getElementById('cinematic-final-btn')

    this._current = 0
    this._timer = null
    this._running = false

    if (this.skipBtn) {
      this.skipBtn.onclick = () => this._finish()
    }
    if (this.finalBtn) {
      this.finalBtn.onclick = () => this._finish()
    }
  }

  start() {
    if (!this.el) return
    this._current = 0
    this._running = true
    this.el.classList.add('active')
    this.el.classList.remove('cinematic-final-theme')
    if (this.finalEl) this.finalEl.classList.remove('show')
    if (this.sceneEl) this.sceneEl.style.display = ''
    if (this.bottomBar) this.bottomBar.style.display = ''
    this._showScene(0)
  }

  _showScene(index) {
    if (!this._running) return

    if (index >= SCENES.length) {
      this._showFinal()
      return
    }

    this._current = index
    const scene = SCENES[index]

    if (this.counterEl) {
      this.counterEl.textContent = `${index + 1} / ${SCENES.length}`
    }

    this.el.className = 'screen active cinematic-' + scene.theme

    this.textEl.classList.remove('show')
    this.sceneEl.classList.remove('show')

    setTimeout(() => {
      this.textEl.textContent = scene.text
      this.textEl.classList.add('show')
      this.sceneEl.classList.add('show')
    }, 300)

    if (scene.duration > 0) {
      clearTimeout(this._timer)
      this._timer = setTimeout(() => {
        this._showScene(index + 1)
      }, scene.duration)
    }
  }

  _showFinal() {
    this.el.className = 'screen active cinematic-final-theme'

    if (this.sceneEl) this.sceneEl.style.display = 'none'
    if (this.bottomBar) this.bottomBar.style.display = 'none'
    if (this.finalEl) this.finalEl.classList.add('show')
  }

  _finish() {
    clearTimeout(this._timer)
    this._running = false
    this.el.classList.remove('active')
    if (this.finalEl) this.finalEl.classList.remove('show')
    if (this.cb.onFinish) this.cb.onFinish()
  }
}
