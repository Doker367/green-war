// =====================================================================
// GREEN CODE — CharacterTextures
// Texturas PBR procedurales para el mutante albino (piel, tela, cuero).
// Todo se genera en canvas: sin assets externos ni licencias.
// =====================================================================

import * as THREE from 'three'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return c
}

function tex(cnv, { repeat = 1, srgb = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(cnv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = aniso
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Convierte un canvas de altura (escala de grises) en un normal map.
function heightToNormal(heightCanvas, strength = 2.2) {
  const size = heightCanvas.width
  const sctx = heightCanvas.getContext('2d')
  const src = sctx.getImageData(0, 0, size, size).data
  const out = canvas(size)
  const octx = out.getContext('2d')
  const img = octx.createImageData(size, size)
  const at = (x, y) => {
    const xi = (x + size) % size
    const yi = (y + size) % size
    return src[(yi * size + xi) * 4] / 255
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      let nx = -dx, ny = -dy, nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len; ny /= len; nz /= len
      const i = (y * size + x) * 4
      img.data[i] = (nx * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  octx.putImageData(img, 0, 0)
  return out
}

// ---------------------------------------------------------------------
// PIEL: pálida, traslúcida, con venas sutiles, poros e imperfecciones.
// ---------------------------------------------------------------------
export function makeSkinTextures(size = 512) {
  const rnd = mulberry32(2024)
  const base = canvas(size)
  const ctx = base.getContext('2d')

  ctx.fillStyle = '#c4a078'
  ctx.fillRect(0, 0, size, size)

  // Variaciones orgánicas de tono
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size, y = rnd() * size
    const r = 24 + rnd() * 90
    const warm = rnd() > 0.5
    const col = warm ? '158,98,64' : '173,122,86'
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${col},${0.05 + rnd() * 0.05})`)
    g.addColorStop(1, `rgba(${col},0)`)
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }

  // Manchas de pigmentación / imperfecciones
  for (let i = 0; i < 42; i++) {
    const x = rnd() * size, y = rnd() * size
    const r = 1.5 + rnd() * 4.5
    ctx.fillStyle = `rgba(102,68,54,${0.06 + rnd() * 0.09})`
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.6 + rnd() * 0.8), rnd() * Math.PI, 0, Math.PI * 2); ctx.fill()
  }

  // Venas: ramas sinuosas sutiles tonos marrones
  ctx.lineCap = 'round'
  for (let i = 0; i < 30; i++) {
    let x = rnd() * size, y = rnd() * size
    let a = rnd() * Math.PI * 2
    const w = 0.6 + rnd() * 1.1
    ctx.strokeStyle = `rgba(120,80,60,${0.05 + rnd() * 0.08})`
    ctx.lineWidth = w
    ctx.beginPath(); ctx.moveTo(x, y)
    const steps = 5 + Math.floor(rnd() * 6)
    for (let s = 0; s < steps; s++) {
      a += (rnd() - 0.5) * 1.1
      const len = 8 + rnd() * 26
      x += Math.cos(a) * len; y += Math.sin(a) * len
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Poros (leve oscurecimiento puntual)
  const pores = canvas(size)
  const pctx = pores.getContext('2d')
  pctx.fillStyle = '#808080'
  pctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * size, y = rnd() * size
    const r = 0.4 + rnd() * 1.1
    const v = 74 + Math.floor(rnd() * 60)
    pctx.fillStyle = `rgb(${v},${v},${v})`
    pctx.beginPath(); pctx.arc(x, y, r, 0, Math.PI * 2); pctx.fill()
  }

  // Roughness: la piel pálida brilla algo más en pómulos/nariz
  const rough = canvas(size)
  const rctx = rough.getContext('2d')
  rctx.fillStyle = '#9a9a9a'
  rctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 1600; i++) {
    const x = rnd() * size, y = rnd() * size, r = 0.5 + rnd() * 2
    const v = 120 + Math.floor(rnd() * 90)
    rctx.fillStyle = `rgba(${v},${v},${v},0.35)`
    rctx.beginPath(); rctx.arc(x, y, r, 0, Math.PI * 2); rctx.fill()
  }

  return {
    map: tex(base, { repeat: 2, srgb: true }),
    normalMap: tex(heightToNormal(pores, 1.8), { repeat: 2 }),
    roughnessMap: tex(rough, { repeat: 2 })
  }
}

// ---------------------------------------------------------------------
// TELA: tejido oscuro, desgaste, manchas y arañazos.
// ---------------------------------------------------------------------
export function makeClothTextures({
  size = 256, base = '#23262b', stain = '10,10,12',
  wear = 0.5, seed = 11, weave = 3, repeat = 2
} = {}) {
  const rnd = mulberry32(seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  // Trama del tejido
  ctx.globalAlpha = 0.16
  for (let i = 0; i < size; i += weave) {
    ctx.fillStyle = i % (weave * 2) === 0 ? '#ffffff' : '#000000'
    ctx.fillRect(i, 0, 1, size)
    ctx.fillRect(0, i, size, 1)
  }
  ctx.globalAlpha = 1

  // Ruido fino
  for (let i = 0; i < 4200; i++) {
    const x = rnd() * size, y = rnd() * size
    const a = rnd() * 0.12
    ctx.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
    ctx.fillRect(x, y, 1, 1)
  }

  // Manchas de suciedad
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size, y = rnd() * size, r = 10 + rnd() * 42
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${stain},${0.18 * wear})`)
    g.addColorStop(1, `rgba(${stain},0)`)
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }

  // Arañazos / hilos (desgaste)
  for (let i = 0; i < 40 * wear; i++) {
    const x = rnd() * size, y = rnd() * size
    const a = rnd() * Math.PI * 2, len = 4 + rnd() * 20
    ctx.strokeStyle = `rgba(190,190,190,${0.05 + rnd() * 0.14})`
    ctx.lineWidth = 0.6 + rnd() * 0.8
    ctx.beginPath(); ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke()
  }

  // Normal suave a partir de la trama
  const h = canvas(size)
  const hc = h.getContext('2d')
  hc.fillStyle = '#808080'; hc.fillRect(0, 0, size, size)
  for (let i = 0; i < 5000; i++) {
    const x = rnd() * size, y = rnd() * size
    const v = 96 + Math.floor(rnd() * 64)
    hc.fillStyle = `rgb(${v},${v},${v})`
    hc.fillRect(x, y, weave, weave)
  }

  // Roughness con variación de desgaste
  const r = canvas(size)
  const rc = r.getContext('2d')
  rc.fillStyle = '#b8b8b8'; rc.fillRect(0, 0, size, size)
  for (let i = 0; i < 2000; i++) {
    const x = rnd() * size, y = rnd() * size, rad = 1 + rnd() * 6
    const v = 120 + Math.floor(rnd() * 110)
    rc.fillStyle = `rgba(${v},${v},${v},0.4)`
    rc.beginPath(); rc.arc(x, y, rad, 0, Math.PI * 2); rc.fill()
  }

  return {
    map: tex(c, { repeat, srgb: true }),
    normalMap: tex(heightToNormal(h, 1.2), { repeat }),
    roughnessMap: tex(r, { repeat })
  }
}

// ---------------------------------------------------------------------
// CUERO: botas y guantes, con grano y brillo irregular.
// ---------------------------------------------------------------------
export function makeLeatherTextures({ size = 256, base = '#1b1a19', seed = 5, repeat = 2 } = {}) {
  const rnd = mulberry32(seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  // Grano de cuero (celdas irregulares)
  for (let i = 0; i < 900; i++) {
    const x = rnd() * size, y = rnd() * size, r = 1 + rnd() * 4
    ctx.strokeStyle = `rgba(0,0,0,${0.12 + rnd() * 0.22})`
    ctx.lineWidth = 0.7
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
  }
  for (let i = 0; i < 2200; i++) {
    const x = rnd() * size, y = rnd() * size
    const a = rnd() * 0.14
    ctx.fillStyle = rnd() > 0.4 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
    ctx.fillRect(x, y, 1, 1)
  }
  // Rozaduras claras
  for (let i = 0; i < 34; i++) {
    const x = rnd() * size, y = rnd() * size, r = 3 + rnd() * 14
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(120,112,104,${0.14 + rnd() * 0.14})`)
    g.addColorStop(1, 'rgba(120,112,104,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }

  const h = canvas(size)
  const hc = h.getContext('2d')
  hc.fillStyle = '#808080'; hc.fillRect(0, 0, size, size)
  for (let i = 0; i < 3000; i++) {
    const x = rnd() * size, y = rnd() * size
    const v = 92 + Math.floor(rnd() * 72)
    hc.fillStyle = `rgb(${v},${v},${v})`
    hc.beginPath(); hc.arc(x, y, 0.6 + rnd() * 1.8, 0, Math.PI * 2); hc.fill()
  }

  return {
    map: tex(c, { repeat, srgb: true }),
    normalMap: tex(heightToNormal(h, 1.4), { repeat }),
    roughnessMap: tex(h, { repeat })
  }
}
