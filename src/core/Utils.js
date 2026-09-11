// =====================================================================
// GREEN CODE — Utilidades matemáticas y de terreno
// =====================================================================

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));

// Pseudo-random determinista (para colocar objetos de forma estable)
export function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// Río: banda este-oeste que se excava en el terreno
export const RIVER_Z = -60
export const RIVER_HALF = 11
export const RIVER_BED = -2.6

// Altura del terreno. Suave, con el refugio aplanado en el centro.
export function terrainHeight(x, z) {
  let h = 0
  h += Math.sin(x * 0.028) * Math.cos(z * 0.024) * 2.4
  h += Math.sin(x * 0.085 + 1.3) * 0.55
  h += Math.cos(z * 0.07 - 0.7) * 0.5
  h += Math.sin((x + z) * 0.045) * 0.8
  const d = Math.hypot(x, z)
  const flat = smoothstep(0, 34, d); // 0 en el centro, 1 lejos
  h *= lerp(0.18, 1, flat)

  // Excavar el cauce del río
  const dz = Math.abs(z - RIVER_Z)
  if (dz < RIVER_HALF) {
    const t = smoothstep(RIVER_HALF - 5, RIVER_HALF, dz) // 0 centro -> 1 orilla
    h = lerp(RIVER_BED, h, t)
  }
  return h
}

export function makeRandom(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
