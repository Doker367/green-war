// =====================================================================
// GREEN CODE — SaveSystem
// Persistencia simple en localStorage (progreso y configuración).
// =====================================================================

const SAVE_KEY = 'greencode.save'
const SET_KEY = 'greencode.settings'

export class SaveSystem {
  static saveProgress(eco) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(eco.getState()))
    } catch (e) { /* almacenamiento no disponible */ }
  }

  static loadProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch (e) { return null }
  }

  static clearProgress() {
    try { localStorage.removeItem(SAVE_KEY) } catch (e) {}
  }

  static saveSettings(s) {
    try { localStorage.setItem(SET_KEY, JSON.stringify(s)) } catch (e) {}
  }

  static loadSettings() {
    const defaults = { quality: 'med', volume: 0.7, bloom: true, invertY: false }
    try {
      const raw = localStorage.getItem(SET_KEY)
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
    } catch (e) { return defaults }
  }
}
