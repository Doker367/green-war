// =====================================================================
// GREEN CODE — Punto de entrada
// =====================================================================

import './style.css'
import { Game } from './core/Game.js'

const container = document.getElementById('app')

window.addEventListener('DOMContentLoaded', () => {
  window.__GREENCODE__ = new Game(container)
})
