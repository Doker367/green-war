// =====================================================================
// GREEN CODE — MutantCharacter
// Personaje original: forajido post-apocalíptico, explorador solitario.
// Rig procedural + materiales PBR + AnimationMixer (clips generados).
// Sin assets externos: todo es geometría y textura generada en runtime.
// =====================================================================

import * as THREE from 'three'
import { makeSkinTextures, makeClothTextures, makeLeatherTextures } from './CharacterTextures.js'

export const ViewMode = { FIRST: 'first', THIRD: 'third', FRONT: 'front' }

const D2R = Math.PI / 180

const BONES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'shoulderR', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR',
  'handL', 'handR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'
]

// Pose de reposo (grados, Euler YXZ). Delgado y encorvado.
const REST = {
  hips: [0, 0, 0],
  spine: [3, 0, 0],
  chest: [5, 0, 0],
  neck: [8, 0, 0],
  head: [-5, 0, 0],
  shoulderL: [0, 0, 7], shoulderR: [0, 0, -7],
  upperArmL: [3, 0, 7], upperArmR: [3, 0, -7],
  forearmL: [14, 0, 0], forearmR: [14, 0, 0],
  handL: [0, 0, 0], handR: [0, 0, 0],
  thighL: [0, 0, 2], thighR: [0, 0, -2],
  shinL: [-3, 0, 0], shinR: [-3, 0, 0],
  footL: [0, 0, 0], footR: [0, 0, 0]
}

function quat(rx, ry, rz) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rx * D2R, ry * D2R, rz * D2R, 'YXZ'))
}

function put(parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], opt = {}) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(pos[0], pos[1], pos[2])
  m.rotation.set(rot[0], rot[1], rot[2])
  m.scale.set(scale[0], scale[1], scale[2])
  m.castShadow = opt.cast !== false
  m.receiveShadow = opt.receive !== false
  parent.add(m)
  return m
}

// Cápsula que cuelga hacia abajo desde el pivote de la articulación.
function limbGeo(parent, mat, radius, length, opt = {}) {
  const geo = new THREE.CapsuleGeometry(radius, length, 5, 12)
  return put(parent, geo, mat, [0, -(length / 2 + radius), 0], opt.rot, opt.scale, opt)
}

function makeSSSMaterial(color, intensity = 0.55, power = 2.4) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uPower: { value: power }
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uIntensity; uniform float uPower;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        gl_FragColor = vec4(uColor * fres * uIntensity, fres);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide
  })
}

export class MutantCharacter {
  constructor() {
    this.root = new THREE.Group()
    this.root.name = 'Mutant'
    this.bones = {}
    this.actions = {}
    this.clips = []
    this.current = 'idle'
    this._lastLoco = 'idle'
    this._oneShot = null
    this._t = 0
    this._blinkTimer = 2
    this._blink = 0
    this.viewMode = ViewMode.THIRD

    this._buildMaterials()
    this._buildRig()
    this._buildClips()

    this.mixer = new THREE.AnimationMixer(this.root)
    for (const clip of this.clips) this.actions[clip.name] = this.mixer.clipAction(clip)
    this.actions.idle.play()
    this.mixer.addEventListener('finished', (e) => this._onFinished(e))

    this._setupRimLight()
  }

  attach(scene) {
    scene.add(this.root)
    scene.add(this.rimLight)
    scene.add(this.rimTarget)
    this.rimLight.target = this.rimTarget
    scene.add(this.fillLight)
    scene.add(this.fillTarget)
    this.fillLight.target = this.fillTarget
  }

  // =====================================================================
  //  MATERIALES PBR
  // =====================================================================
  _buildMaterials() {
    this.skinTex = makeSkinTextures(512)
    this.coatTex = makeClothTextures({ base: '#3d2b1a', seed: 11, wear: 0.75, stain: '8,8,10' })
    this.pantsTex = makeClothTextures({ base: '#3a3224', seed: 29, weave: 2, wear: 0.6, stain: '5,5,6' })
    this.leatherTex = makeLeatherTextures({ base: '#2e2218', seed: 7 })

    this.skinMat = new THREE.MeshPhysicalMaterial({
      color: 0xc4956a,
      map: this.skinTex.map,
      normalMap: this.skinTex.normalMap,
      roughnessMap: this.skinTex.roughnessMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.6,
      metalness: 0.0,
      clearcoat: 0.16,
      clearcoatRoughness: 0.72,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xd9b391),
      sheenRoughness: 0.9
    })

    this.browMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.85 })
    this.socketMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 })
    this.mouthMat = new THREE.MeshStandardMaterial({ color: 0x3a1c1e, roughness: 0.75 })
    this.lidMat = new THREE.MeshStandardMaterial({ color: 0x9b7050, roughness: 0.65 })

    this.eyeMat = new THREE.MeshPhysicalMaterial({
      color: 0xddd5ce, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06
    })
    this.irisMat = new THREE.MeshStandardMaterial({
      color: 0x7fa849, emissive: 0x2d3f18, emissiveIntensity: 0.2, roughness: 0.25
    })
    this.pupilMat = new THREE.MeshStandardMaterial({ color: 0x04060a, roughness: 0.2 })

    this.coatMat = new THREE.MeshStandardMaterial({
      map: this.coatTex.map, normalMap: this.coatTex.normalMap,
      roughnessMap: this.coatTex.roughnessMap, normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.95, metalness: 0.05
    })
    this.coatDarkMat = new THREE.MeshStandardMaterial({
      map: this.coatTex.map, roughness: 0.92, metalness: 0.05, color: 0x2a1e12
    })
    this.pantsMat = new THREE.MeshStandardMaterial({
      map: this.pantsTex.map, normalMap: this.pantsTex.normalMap,
      roughnessMap: this.pantsTex.roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.96, metalness: 0.03
    })
    this.leatherMat = new THREE.MeshStandardMaterial({
      map: this.leatherTex.map, normalMap: this.leatherTex.normalMap,
      roughnessMap: this.leatherTex.roughnessMap, normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.62, metalness: 0.06
    })
    this.metalMat = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.36, metalness: 1 })
    this.metalDarkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.52, metalness: 0.9 })
    this.strapMat = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.8, metalness: 0.1 })

    this.sssHead = makeSSSMaterial(0x8c5230, 0.5, 2.2)
    this.sssEar = makeSSSMaterial(0xa3552a, 0.9, 1.8)
  }

  // =====================================================================
  //  RIG
  // =====================================================================
  _bone(name, parent, pos) {
    const g = new THREE.Group()
    g.name = name
    g.position.set(pos[0], pos[1], pos[2])
    parent.add(g)
    this.bones[name] = g
    return g
  }

  _buildRig() {
    const root = this.root
    this.bob = new THREE.Group(); this.bob.name = 'bob'; root.add(this.bob)

    const hips = this._bone('hips', this.bob, [0, 1.02, 0])
    const spine = this._bone('spine', hips, [0, 0.10, 0])
    const chest = this._bone('chest', spine, [0, 0.27, 0])
    const neck = this._bone('neck', chest, [0, 0.29, 0])
    const head = this._bone('head', neck, [0, 0.13, 0])

    const shL = this._bone('shoulderL', chest, [0.18, 0.24, 0])
    const shR = this._bone('shoulderR', chest, [-0.18, 0.24, 0])
    const uaL = this._bone('upperArmL', shL, [0.05, 0, 0])
    const uaR = this._bone('upperArmR', shR, [-0.05, 0, 0])
    const faL = this._bone('forearmL', uaL, [0, -0.30, 0])
    const faR = this._bone('forearmR', uaR, [0, -0.30, 0])
    const haL = this._bone('handL', faL, [0, -0.27, 0])
    const haR = this._bone('handR', faR, [0, -0.27, 0])

    const thL = this._bone('thighL', hips, [0.10, -0.03, 0])
    const thR = this._bone('thighR', hips, [-0.10, -0.03, 0])
    const snL = this._bone('shinL', thL, [0, -0.48, 0])
    const snR = this._bone('shinR', thR, [0, -0.48, 0])
    const ftL = this._bone('footL', snL, [0, -0.43, 0])
    const ftR = this._bone('footR', snR, [0, -0.43, 0])

    // Aplicar pose de reposo
    for (const name of BONES) {
      const r = REST[name]
      this.bones[name].rotation.set(r[0] * D2R, r[1] * D2R, r[2] * D2R)
    }

    this._buildBody(chest, spine, hips)
    this._buildHead(head, neck)
    this._buildArms(uaL, uaR, faL, faR, haL, haR)
    this._buildLegs(thL, thR, snL, snR, ftL, ftR)
    this._buildGear(chest, hips, thL, thR)
  }

  _buildBody(chest, spine, hips) {
    // Bajo el abrigo: torso delgado de piel
    put(chest, new THREE.SphereGeometry(0.16, 20, 16), this.skinMat, [0, -0.02, 0], [0, 0, 0], [1, 1.15, 0.75])
    put(spine, new THREE.CylinderGeometry(0.11, 0.12, 0.30, 16), this.skinMat, [0, -0.05, 0])
    // Pelvis
    put(hips, new THREE.SphereGeometry(0.17, 20, 14), this.pantsMat, [0, -0.06, 0], [0, 0, 0], [1, 0.8, 0.82])

    // Abrigo: torso
    const coat = new THREE.CylinderGeometry(0.18, 0.215, 0.62, 20, 1, true)
    put(spine, coat, this.coatMat, [0, 0.24, 0], [0, 0, 0], [1, 1, 0.9], { receive: true })
    // Faldón
    put(hips, new THREE.CylinderGeometry(0.205, 0.27, 0.46, 20, 1, true), this.coatMat, [0, -0.16, 0], [0, 0, 0], [1, 1, 0.92])
    // Solapas frontales
    put(chest, new THREE.BoxGeometry(0.11, 0.34, 0.035), this.coatDarkMat, [0.075, 0.02, -0.155], [0.06, 0.42, 0.06])
    put(chest, new THREE.BoxGeometry(0.11, 0.34, 0.035), this.coatDarkMat, [-0.075, 0.02, -0.155], [0.06, -0.42, -0.06])
    // Cuello alto
    put(chest, new THREE.CylinderGeometry(0.115, 0.125, 0.16, 16, 1, true), this.coatDarkMat, [0, 0.30, 0], [0, 0, 0], [1, 1, 0.95])
    // Cremallera/borde central metálico
    put(spine, new THREE.BoxGeometry(0.02, 0.6, 0.02), this.metalDarkMat, [0, 0.22, -0.165])
    // Hombreras
    put(chest, new THREE.SphereGeometry(0.10, 14, 10), this.coatDarkMat, [0.19, 0.22, 0], [0, 0, 0], [1.2, 0.7, 1])
    put(chest, new THREE.SphereGeometry(0.10, 14, 10), this.coatDarkMat, [-0.19, 0.22, 0], [0, 0, 0], [1.2, 0.7, 1])
  }

  _buildHead(head, neck) {
    // Cuello alargado y delgado
    put(neck, new THREE.CapsuleGeometry(0.05, 0.10, 5, 12), this.skinMat, [0, 0.02, 0])

    // Cráneo alargado, anguloso y demacrado
    const geo = new THREE.SphereGeometry(0.13, 40, 30)
    const p = geo.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      v.y *= 1.30
      v.x *= 0.82
      v.z *= 0.93
      if (v.y < 0) {
        const t = Math.min(1, -v.y / 0.16)
        v.x *= 1 - 0.44 * t
        v.z -= 0.022 * t
        v.y *= 1 - 0.08 * t
      }
      const ax = Math.abs(v.x)
      // mejillas hundidas / pómulos marcados
      const cheek = Math.exp(-(((ax - 0.082) ** 2) / 0.0011 + ((v.y + 0.010) ** 2) / 0.0016))
      v.z += 0.022 * cheek
      const bone = Math.exp(-(((ax - 0.092) ** 2) / 0.0009 + ((v.y - 0.040) ** 2) / 0.0010))
      v.z -= 0.016 * bone
      // sienes cóncavas
      const temple = Math.exp(-(((ax - 0.102) ** 2) / 0.0011 + ((v.y - 0.078) ** 2) / 0.0015))
      v.x *= 1 - 0.22 * temple
      // frente
      const brow = Math.exp(-((ax ** 2) / 0.005 + ((v.y - 0.072) ** 2) / 0.0011))
      v.z -= 0.011 * brow
      // cuencas oculares (hundidas)
      const socket = Math.exp(-(((ax - 0.050) ** 2) / 0.0013 + ((v.y - 0.016) ** 2) / 0.0010))
      v.z += 0.017 * socket
      p.setXYZ(i, v.x, v.y, v.z)
    }
    geo.computeVertexNormals()
    this.headGeo = geo
    put(head, geo, this.skinMat, [0, 0.02, 0])

    // Stubble muy corto en la parte alta del cráneo
    const stubble = new THREE.MeshStandardMaterial({ color: 0x4a4340, roughness: 0.9, transparent: true, opacity: 0.35 })
    put(head, new THREE.SphereGeometry(0.132, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
      stubble, [0, 0.03, 0], [0, 0, 0], [0.84, 1.31, 0.94], { cast: false })

    // Cuencas hundidas (oscurecen la mirada)
    put(head, new THREE.TorusGeometry(0.032, 0.008, 8, 18), this.socketMat,
      [0.050, 0.026, -0.096], [0, 0, 0], [1, 0.8, 1])
    put(head, new THREE.TorusGeometry(0.032, 0.008, 8, 18), this.socketMat,
      [-0.050, 0.026, -0.096], [0, 0, 0], [1, 0.8, 1])

    // Ojos grandes y expresivos, iris muy claros
    for (const s of [1, -1]) {
      const eye = new THREE.Group()
      eye.position.set(0.050 * s, 0.026, -0.089)
      head.add(eye)
      put(eye, new THREE.SphereGeometry(0.022, 20, 16), this.eyeMat, [0, 0, 0], [0, 0, 0], [1, 0.95, 0.68])
      const iris = put(eye, new THREE.CircleGeometry(0.0122, 20), this.irisMat, [0, 0, -0.0158], [0, Math.PI, 0])
      iris.renderOrder = 2
      const pupil = put(eye, new THREE.CircleGeometry(0.0056, 16), this.pupilMat, [0, 0, -0.0166], [0, Math.PI, 0])
      pupil.renderOrder = 3
      if (s === 1) { this.eyeL = eye } else { this.eyeR = eye }
    }

    // Párpados superiores (parpadeo / mirada encapotada)
    const lidGeo = new THREE.SphereGeometry(0.0255, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.6)
    this.lidL = put(head, lidGeo, this.lidMat, [0.050, 0.045, -0.089], [0.5, 0, 0], [1, 0.9, 0.85])
    this.lidR = put(head, lidGeo, this.lidMat, [-0.050, 0.045, -0.089], [0.5, 0, 0], [1, 0.9, 0.85])

    // Cejas angulosas
    this.browL = put(head, new THREE.BoxGeometry(0.052, 0.012, 0.020), this.browMat,
      [0.050, 0.068, -0.110], [0.1, 0, -0.24])
    this.browR = put(head, new THREE.BoxGeometry(0.052, 0.012, 0.020), this.browMat,
      [-0.050, 0.068, -0.110], [0.1, 0, 0.24])

    // Nariz estrecha y afilada
    put(head, new THREE.SphereGeometry(0.02, 14, 12), this.skinMat, [0, -0.02, -0.118], [0, 0, 0], [0.85, 1.9, 1.35])
    put(head, new THREE.BoxGeometry(0.016, 0.05, 0.02), this.skinMat, [0, 0.005, -0.110], [0.22, 0, 0])
    put(head, new THREE.SphereGeometry(0.006, 8, 8), this.mouthMat, [0.014, -0.05, -0.128])
    put(head, new THREE.SphereGeometry(0.006, 8, 8), this.mouthMat, [-0.014, -0.05, -0.128])

    // Boca fina
    this.jaw = new THREE.Group()
    this.jaw.position.set(0, -0.072, -0.112)
    head.add(this.jaw)
    this.mouth = put(this.jaw, new THREE.BoxGeometry(0.058, 0.009, 0.014), this.mouthMat, [0, 0, 0], [0.12, 0, 0])
    put(this.jaw, new THREE.BoxGeometry(0.05, 0.02, 0.02), this.browMat, [0, -0.02, -0.004], [0.2, 0, 0])

    // Orejas ligeramente puntiagudas + SSS
    for (const s of [1, -1]) {
      const ear = put(head, new THREE.ConeGeometry(0.03, 0.115, 7), this.skinMat,
        [0.122 * s, 0.03, 0.005], [0.35, 0, -0.28 * s], [1, 1, 0.42])
      const shell = new THREE.Mesh(ear.geometry, this.sssEar)
      shell.position.copy(ear.position)
      shell.rotation.copy(ear.rotation)
      shell.scale.copy(ear.scale).multiplyScalar(1.12)
      shell.renderOrder = 1
      head.add(shell)
    }

    // Shell SSS del cráneo
    const headShell = new THREE.Mesh(geo, this.sssHead)
    headShell.scale.setScalar(1.025)
    headShell.position.set(0, 0.02, 0)
    headShell.renderOrder = 1
    head.add(headShell)
    this.headShell = headShell

    // --- ACCESORIOS DE FORAJIDO ---
    const hatGroup = new THREE.Group()
    hatGroup.position.set(0, 0.16, -0.01)
    put(hatGroup, new THREE.CylinderGeometry(0.09, 0.11, 0.12, 16), this.leatherMat, [0, 0.05, 0])
    put(hatGroup, new THREE.CylinderGeometry(0.24, 0.24, 0.01, 20), this.leatherMat, [0, 0, 0])
    head.add(hatGroup)

    // Cicatriz
    put(head, new THREE.BoxGeometry(0.005, 0.06, 0.01), this.mouthMat, [0.065, 0.04, -0.10], [0, 0, -0.3])
  }

  _buildArms(uaL, uaR, faL, faR, haL, haR) {
    for (const [ua, fa, ha, side] of [[uaL, faL, haL, 1], [uaR, faR, haR, -1]]) {
      // Manga del abrigo
      limbGeo(ua, this.coatMat, 0.072, 0.20)
      limbGeo(fa, this.coatDarkMat, 0.062, 0.18)
      // Puño metálico
      put(fa, new THREE.CylinderGeometry(0.062, 0.058, 0.04, 12), this.metalDarkMat, [0, -0.24, 0])
      // Guante táctico
      put(ha, new THREE.BoxGeometry(0.075, 0.06, 0.09), this.leatherMat, [0, -0.03, -0.01])
      put(ha, new THREE.BoxGeometry(0.07, 0.05, 0.05), this.leatherMat, [0, -0.08, -0.02])
      put(ha, new THREE.BoxGeometry(0.09, 0.018, 0.02), this.metalMat, [0, -0.02, -0.05])
      // Pulgar
      put(ha, new THREE.CapsuleGeometry(0.018, 0.03, 3, 8), this.leatherMat,
        [0.04 * side, -0.03, -0.02], [0, 0, Math.PI / 2.6 * side])
    }
  }

  _buildLegs(thL, thR, snL, snR, ftL, ftR) {
    for (const [th, sn, ft] of [[thL, snL, ftL], [thR, snR, ftR]]) {
      limbGeo(th, this.pantsMat, 0.09, 0.30)
      limbGeo(sn, this.pantsMat, 0.072, 0.26)
      // Rodillera
      put(sn, new THREE.SphereGeometry(0.078, 14, 10), this.leatherMat, [0, 0.0, -0.045], [0, 0, 0], [1, 0.9, 0.7])
      // Bota
      put(ft, new THREE.BoxGeometry(0.115, 0.15, 0.25), this.leatherMat, [0, -0.03, -0.05])
      put(ft, new THREE.BoxGeometry(0.125, 0.045, 0.30), this.leatherMat, [0, -0.085, -0.06])
      put(ft, new THREE.BoxGeometry(0.115, 0.05, 0.10), this.metalDarkMat, [0, -0.08, -0.16])
      put(ft, new THREE.BoxGeometry(0.12, 0.03, 0.31), this.metalDarkMat, [0, -0.11, -0.06])
      // Cordones / tiras
      put(ft, new THREE.BoxGeometry(0.10, 0.012, 0.012), this.strapMat, [0, 0.02, -0.10])
      put(ft, new THREE.BoxGeometry(0.10, 0.012, 0.012), this.strapMat, [0, -0.01, -0.09])
    }
  }

  _buildGear(chest, hips, thL, thR) {
    // Cinturón con hebilla
    put(hips, new THREE.CylinderGeometry(0.215, 0.215, 0.06, 20), this.strapMat, [0, 0.0, 0], [0, 0, 0], [1, 1, 0.9])
    put(hips, new THREE.BoxGeometry(0.06, 0.05, 0.03), this.metalMat, [0, 0.0, -0.20])
    // Bolsas utilitarias
    put(hips, new THREE.BoxGeometry(0.10, 0.12, 0.07), this.leatherMat, [0.15, -0.10, 0.10], [0, -0.3, 0])
    put(hips, new THREE.BoxGeometry(0.09, 0.10, 0.07), this.leatherMat, [-0.16, -0.10, 0.06], [0, 0.3, 0])
    // Correa cruzada con cierre metálico
    put(chest, new THREE.BoxGeometry(0.055, 0.46, 0.03), this.strapMat,
      [0.02, -0.02, -0.17], [0, 0, 0.5])
    put(chest, new THREE.BoxGeometry(0.045, 0.045, 0.03), this.metalMat, [-0.07, -0.12, -0.185], [0, 0, 0.5])
    // Bolsillo de pecho
    put(chest, new THREE.BoxGeometry(0.09, 0.08, 0.02), this.coatDarkMat, [0.11, -0.06, -0.14], [0, 0.25, 0])
    // Correa en muslo
    put(thL, new THREE.CylinderGeometry(0.095, 0.095, 0.04, 12), this.strapMat, [0, -0.22, 0])
    // Funda de pistola
    put(thR, new THREE.BoxGeometry(0.09, 0.22, 0.12), this.leatherMat, [0, -0.24, 0.08], [0, 0.1, -0.1])
  }

  // =====================================================================
  //  CLIPS DE ANIMACIÓN
  // =====================================================================
  _makeClip(name, duration, overrides = {}, posOverrides = {}) {
    const tracks = []
    for (const bone of BONES) {
      const keys = overrides[bone]
      let times, values
      if (keys && keys.length) {
        times = keys.map((k) => k.t)
        values = []
        for (const k of keys) {
          const q = quat(k.r[0], k.r[1], k.r[2])
          values.push(q.x, q.y, q.z, q.w)
        }
      } else {
        const q = quat(REST[bone][0], REST[bone][1], REST[bone][2])
        times = [0, duration]
        values = [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values))
    }
    // Posición del "bob" (respiración, paso, agacharse, caída)
    const pk = posOverrides.bob || [{ t: 0, p: [0, 0, 0] }, { t: duration, p: [0, 0, 0] }]
    const pt = pk.map((k) => k.t)
    const pv = []
    for (const k of pk) pv.push(k.p[0], k.p[1], k.p[2])
    tracks.push(new THREE.VectorKeyframeTrack('bob.position', pt, pv))
    return new THREE.AnimationClip(name, duration, tracks)
  }

  _buildClips() {
    // IDLE — balanceo y respiración sutil
    this.clips.push(this._makeClip('idle', 5, {
      chest: [{ t: 0, r: [5, 0, 0] }, { t: 1.25, r: [6.5, 0.6, 0] }, { t: 2.5, r: [5, 0, 0] }, { t: 3.75, r: [6.5, -0.6, 0] }, { t: 5, r: [5, 0, 0] }],
      spine: [{ t: 0, r: [3, 0, 0] }, { t: 2.5, r: [3.5, 0, 0] }, { t: 5, r: [3, 0, 0] }],
      head: [{ t: 0, r: [-5, 1.5, 0] }, { t: 2.5, r: [-4, -1.5, 0] }, { t: 5, r: [-5, 1.5, 0] }],
      upperArmL: [{ t: 0, r: [3, 0, 7] }, { t: 2.5, r: [5, 0, 8] }, { t: 5, r: [3, 0, 7] }],
      upperArmR: [{ t: 0, r: [3, 0, -7] }, { t: 2.5, r: [5, 0, -8] }, { t: 5, r: [3, 0, -7] }]
    }, { bob: [{ t: 0, p: [0, 0.01, 0] }, { t: 2.5, p: [0, -0.015, 0] }, { t: 5, p: [0, 0.01, 0] }] }))

    // RESPIRACIÓN — pecho y hombros
    this.clips.push(this._makeClip('breathe', 4, {
      chest: [{ t: 0, r: [5, 0, 0] }, { t: 1, r: [8.5, 0, 0] }, { t: 2, r: [5, 0, 0] }, { t: 3, r: [8.5, 0, 0] }, { t: 4, r: [5, 0, 0] }],
      shoulderL: [{ t: 0, r: [0, 0, 7] }, { t: 1, r: [-3, 0, 10] }, { t: 2, r: [0, 0, 7] }, { t: 3, r: [-3, 0, 10] }, { t: 4, r: [0, 0, 7] }],
      shoulderR: [{ t: 0, r: [0, 0, -7] }, { t: 1, r: [-3, 0, -10] }, { t: 2, r: [0, 0, -7] }, { t: 3, r: [-3, 0, -10] }, { t: 4, r: [0, 0, -7] }],
      neck: [{ t: 0, r: [8, 0, 0] }, { t: 1, r: [5, 0, 0] }, { t: 2, r: [8, 0, 0] }, { t: 3, r: [5, 0, 0] }, { t: 4, r: [8, 0, 0] }]
    }))

    // WALK — ciclo de 1 s
    this.clips.push(this._makeClip('walk', 1, {
      thighL: [{ t: 0, r: [24, 0, 2] }, { t: 0.25, r: [2, 0, 2] }, { t: 0.5, r: [-22, 0, 2] }, { t: 0.75, r: [2, 0, 2] }, { t: 1, r: [24, 0, 2] }],
      thighR: [{ t: 0, r: [-22, 0, -2] }, { t: 0.25, r: [2, 0, -2] }, { t: 0.5, r: [24, 0, -2] }, { t: 0.75, r: [2, 0, -2] }, { t: 1, r: [-22, 0, -2] }],
      shinL: [{ t: 0, r: [-8, 0, 0] }, { t: 0.25, r: [-34, 0, 0] }, { t: 0.5, r: [-52, 0, 0] }, { t: 0.75, r: [-14, 0, 0] }, { t: 1, r: [-8, 0, 0] }],
      shinR: [{ t: 0, r: [-52, 0, 0] }, { t: 0.25, r: [-14, 0, 0] }, { t: 0.5, r: [-8, 0, 0] }, { t: 0.75, r: [-34, 0, 0] }, { t: 1, r: [-52, 0, 0] }],
      footL: [{ t: 0, r: [8, 0, 0] }, { t: 0.25, r: [2, 0, 0] }, { t: 0.5, r: [-14, 0, 0] }, { t: 0.75, r: [2, 0, 0] }, { t: 1, r: [8, 0, 0] }],
      footR: [{ t: 0, r: [-14, 0, 0] }, { t: 0.25, r: [2, 0, 0] }, { t: 0.5, r: [8, 0, 0] }, { t: 0.75, r: [2, 0, 0] }, { t: 1, r: [-14, 0, 0] }],
      upperArmL: [{ t: 0, r: [-26, 0, 7] }, { t: 0.25, r: [0, 0, 7] }, { t: 0.5, r: [26, 0, 7] }, { t: 0.75, r: [0, 0, 7] }, { t: 1, r: [-26, 0, 7] }],
      upperArmR: [{ t: 0, r: [26, 0, -7] }, { t: 0.25, r: [0, 0, -7] }, { t: 0.5, r: [-26, 0, -7] }, { t: 0.75, r: [0, 0, -7] }, { t: 1, r: [26, 0, -7] }],
      forearmL: [{ t: 0, r: [18, 0, 0] }, { t: 0.5, r: [24, 0, 0] }, { t: 1, r: [18, 0, 0] }],
      forearmR: [{ t: 0, r: [24, 0, 0] }, { t: 0.5, r: [18, 0, 0] }, { t: 1, r: [24, 0, 0] }],
      hips: [{ t: 0, r: [0, -2, 2] }, { t: 0.5, r: [0, 2, -2] }, { t: 1, r: [0, -2, 2] }],
      chest: [{ t: 0, r: [6, 2, 0] }, { t: 0.5, r: [6, -2, 0] }, { t: 1, r: [6, 2, 0] }],
      head: [{ t: 0, r: [-5, -1, 0] }, { t: 0.5, r: [-5, 1, 0] }, { t: 1, r: [-5, -1, 0] }]
    }, { bob: [{ t: 0, p: [0, -0.02, 0] }, { t: 0.25, p: [0, 0.02, 0] }, { t: 0.5, p: [0, -0.02, 0] }, { t: 0.75, p: [0, 0.02, 0] }, { t: 1, p: [0, -0.02, 0] }] }))

    // RUN — ciclo de 0.62 s, inclinado hacia delante
    this.clips.push(this._makeClip('run', 0.62, {
      thighL: [{ t: 0, r: [46, 0, 2] }, { t: 0.31, r: [-32, 0, 2] }, { t: 0.62, r: [46, 0, 2] }],
      thighR: [{ t: 0, r: [-32, 0, -2] }, { t: 0.31, r: [46, 0, -2] }, { t: 0.62, r: [-32, 0, -2] }],
      shinL: [{ t: 0, r: [-22, 0, 0] }, { t: 0.15, r: [-95, 0, 0] }, { t: 0.31, r: [-30, 0, 0] }, { t: 0.62, r: [-22, 0, 0] }],
      shinR: [{ t: 0, r: [-30, 0, 0] }, { t: 0.31, r: [-22, 0, 0] }, { t: 0.46, r: [-95, 0, 0] }, { t: 0.62, r: [-30, 0, 0] }],
      footL: [{ t: 0, r: [14, 0, 0] }, { t: 0.31, r: [-20, 0, 0] }, { t: 0.62, r: [14, 0, 0] }],
      footR: [{ t: 0, r: [-20, 0, 0] }, { t: 0.31, r: [14, 0, 0] }, { t: 0.62, r: [-20, 0, 0] }],
      upperArmL: [{ t: 0, r: [-48, 0, 9] }, { t: 0.31, r: [48, 0, 9] }, { t: 0.62, r: [-48, 0, 9] }],
      upperArmR: [{ t: 0, r: [48, 0, -9] }, { t: 0.31, r: [-48, 0, -9] }, { t: 0.62, r: [48, 0, -9] }],
      forearmL: [{ t: 0, r: [72, 0, 0] }, { t: 0.31, r: [58, 0, 0] }, { t: 0.62, r: [72, 0, 0] }],
      forearmR: [{ t: 0, r: [58, 0, 0] }, { t: 0.31, r: [72, 0, 0] }, { t: 0.62, r: [58, 0, 0] }],
      spine: [{ t: 0, r: [10, 0, 0] }, { t: 0.62, r: [10, 0, 0] }],
      chest: [{ t: 0, r: [12, 4, 0] }, { t: 0.31, r: [12, -4, 0] }, { t: 0.62, r: [12, 4, 0] }],
      neck: [{ t: 0, r: [6, 0, 0] }, { t: 0.62, r: [6, 0, 0] }],
      head: [{ t: 0, r: [-8, -2, 0] }, { t: 0.31, r: [-8, 2, 0] }, { t: 0.62, r: [-8, -2, 0] }]
    }, { bob: [{ t: 0, p: [0, -0.045, 0] }, { t: 0.155, p: [0, 0.05, 0] }, { t: 0.31, p: [0, -0.045, 0] }, { t: 0.465, p: [0, 0.05, 0] }, { t: 0.62, p: [0, -0.045, 0] }] }))

    // CROUCH — pose estática agachada
    const crouch = {
      spine: [20, 0, 0], chest: [10, 0, 0], neck: [6, 0, 0], head: [-14, 0, 0],
      thighL: [54, 0, 4], thighR: [54, 0, -4],
      shinL: [-66, 0, 0], shinR: [-66, 0, 0],
      footL: [16, 0, 0], footR: [16, 0, 0],
      upperArmL: [30, 0, 12], upperArmR: [30, 0, -12],
      forearmL: [45, 0, 0], forearmR: [45, 0, 0]
    }
    const cOver = {}
    for (const k in crouch) cOver[k] = [{ t: 0, r: crouch[k] }, { t: 1, r: crouch[k] }]
    this.clips.push(this._makeClip('crouch', 1, cOver, { bob: [{ t: 0, p: [0, -0.36, 0] }, { t: 1, p: [0, -0.36, 0] }] }))

    // LOOK — mirar alrededor
    this.clips.push(this._makeClip('look', 6, {
      head: [{ t: 0, r: [-5, 0, 0] }, { t: 1.5, r: [-2, 30, 0] }, { t: 3, r: [-6, -30, 0] }, { t: 4.5, r: [-2, 20, 0] }, { t: 6, r: [-5, 0, 0] }],
      neck: [{ t: 0, r: [8, 0, 0] }, { t: 1.5, r: [6, 12, 0] }, { t: 3, r: [8, -12, 0] }, { t: 4.5, r: [6, 8, 0] }, { t: 6, r: [8, 0, 0] }],
      chest: [{ t: 0, r: [5, 0, 0] }, { t: 1.5, r: [5, 4, 0] }, { t: 3, r: [5, -4, 0] }, { t: 6, r: [5, 0, 0] }]
    }))

    // HIT — recibir daño (una vez)
    this.clips.push(this._makeClip('hit', 0.55, {
      spine: [{ t: 0, r: [3, 0, 0] }, { t: 0.12, r: [-18, 0, 0] }, { t: 0.3, r: [-6, 0, 0] }, { t: 0.55, r: [3, 0, 0] }],
      chest: [{ t: 0, r: [5, 0, 0] }, { t: 0.12, r: [-8, 0, 6] }, { t: 0.55, r: [5, 0, 0] }],
      head: [{ t: 0, r: [-5, 0, 0] }, { t: 0.12, r: [-26, 10, 0] }, { t: 0.3, r: [-10, 4, 0] }, { t: 0.55, r: [-5, 0, 0] }],
      upperArmL: [{ t: 0, r: [3, 0, 7] }, { t: 0.12, r: [-42, 0, 30] }, { t: 0.55, r: [3, 0, 7] }],
      upperArmR: [{ t: 0, r: [3, 0, -7] }, { t: 0.12, r: [-42, 0, -30] }, { t: 0.55, r: [3, 0, -7] }],
      forearmL: [{ t: 0, r: [14, 0, 0] }, { t: 0.12, r: [70, 0, 0] }, { t: 0.55, r: [14, 0, 0] }],
      forearmR: [{ t: 0, r: [14, 0, 0] }, { t: 0.12, r: [70, 0, 0] }, { t: 0.55, r: [14, 0, 0] }]
    }))

    // ATTACK — zarpazo (una vez)
    this.clips.push(this._makeClip('attack', 0.85, {
      spine: [{ t: 0, r: [3, 0, 0] }, { t: 0.15, r: [6, -18, 0] }, { t: 0.4, r: [10, 26, 0] }, { t: 0.85, r: [3, 0, 0] }],
      chest: [{ t: 0, r: [5, 0, 0] }, { t: 0.15, r: [5, -24, 0] }, { t: 0.4, r: [8, 30, 0] }, { t: 0.85, r: [5, 0, 0] }],
      head: [{ t: 0, r: [-5, 0, 0] }, { t: 0.15, r: [-5, -18, 0] }, { t: 0.4, r: [-8, 22, 0] }, { t: 0.85, r: [-5, 0, 0] }],
      upperArmR: [{ t: 0, r: [3, 0, -7] }, { t: 0.15, r: [-72, 0, -34] }, { t: 0.4, r: [66, 0, 8] }, { t: 0.85, r: [3, 0, -7] }],
      forearmR: [{ t: 0, r: [14, 0, 0] }, { t: 0.15, r: [95, 0, 0] }, { t: 0.4, r: [8, 0, 0] }, { t: 0.85, r: [14, 0, 0] }],
      upperArmL: [{ t: 0, r: [3, 0, 7] }, { t: 0.4, r: [24, 0, 20] }, { t: 0.85, r: [3, 0, 7] }],
      thighR: [{ t: 0, r: [0, 0, -2] }, { t: 0.15, r: [12, 0, -2] }, { t: 0.4, r: [-6, 0, -2] }, { t: 0.85, r: [0, 0, -2] }]
    }))

    // DEATH — colapso (una vez, se mantiene)
    this.clips.push(this._makeClip('death', 2.2, {
      hips: [{ t: 0, r: [0, 0, 0] }, { t: 0.9, r: [40, 0, 8] }, { t: 1.6, r: [82, 0, 12] }, { t: 2.2, r: [86, 0, 12] }],
      spine: [{ t: 0, r: [3, 0, 0] }, { t: 0.3, r: [-20, 0, 0] }, { t: 1.2, r: [30, 0, 0] }, { t: 2.2, r: [20, 0, 6] }],
      chest: [{ t: 0, r: [5, 0, 0] }, { t: 0.3, r: [-5, 0, 0] }, { t: 2.2, r: [8, 0, 8] }],
      head: [{ t: 0, r: [-5, 0, 0] }, { t: 0.3, r: [-30, 0, 0] }, { t: 1.4, r: [20, 0, 10] }, { t: 2.2, r: [24, 0, 12] }],
      thighL: [{ t: 0, r: [0, 0, 2] }, { t: 1, r: [58, 0, 10] }, { t: 2.2, r: [40, 0, 20] }],
      thighR: [{ t: 0, r: [0, 0, -2] }, { t: 1, r: [62, 0, -10] }, { t: 2.2, r: [45, 0, -20] }],
      shinL: [{ t: 0, r: [-3, 0, 0] }, { t: 1, r: [-86, 0, 0] }, { t: 2.2, r: [-70, 0, 0] }],
      shinR: [{ t: 0, r: [-3, 0, 0] }, { t: 1, r: [-90, 0, 0] }, { t: 2.2, r: [-74, 0, 0] }],
      upperArmL: [{ t: 0, r: [3, 0, 7] }, { t: 0.3, r: [-30, 0, 45] }, { t: 2.2, r: [-8, 0, 70] }],
      upperArmR: [{ t: 0, r: [3, 0, -7] }, { t: 0.3, r: [-30, 0, -45] }, { t: 2.2, r: [-8, 0, -70] }],
      forearmL: [{ t: 0, r: [14, 0, 0] }, { t: 2.2, r: [30, 0, 0] }],
      forearmR: [{ t: 0, r: [14, 0, 0] }, { t: 2.2, r: [30, 0, 0] }]
    }, { bob: [{ t: 0, p: [0, 0, 0] }, { t: 0.9, p: [0, -0.45, 0] }, { t: 1.6, p: [0, -0.72, -0.15] }, { t: 2.2, p: [0, -0.76, -0.2] }] }))
  }

  // =====================================================================
  //  CONTROL DE ANIMACIÓN
  // =====================================================================
  setLocomotion(name) {
    if (this._oneShot) return
    if (name === this.current) return
    this._crossFade(name, 0.32)
  }

  _crossFade(name, dur) {
    const to = this.actions[name]
    if (!to) return
    to.reset()
    to.setLoop(THREE.LoopRepeat, Infinity)
    to.enabled = true
    to.setEffectiveTimeScale(1)
    to.setEffectiveWeight(1)
    to.play()
    const from = this.actions[this.current]
    if (from && from !== to) from.crossFadeTo(to, dur, false)
    this.current = name
  }

  playOneShot(name) {
    const a = this.actions[name]
    if (!a || this._oneShot === name) return
    this._oneShot = name
    a.reset()
    a.setLoop(THREE.LoopOnce, 1)
    a.clampWhenFinished = true
    a.enabled = true
    a.setEffectiveTimeScale(1)
    a.setEffectiveWeight(1)
    a.play()
    const from = this.actions[this.current]
    if (from && from !== a) from.crossFadeTo(a, 0.12, false)
    this.current = name
  }

  _onFinished(e) {
    if (this._oneShot && e.action === this.actions[this._oneShot]) {
      this._oneShot = null
      this._crossFade(this._lastLoco || 'idle', 0.28)
    }
  }

  setViewMode(mode) {
    this.viewMode = mode
    this.root.visible = mode !== ViewMode.FIRST
  }

  // =====================================================================
  //  ACTUALIZACIÓN
  // =====================================================================
  update(dt, move = {}) {
    this._t += dt
    const speed = move.speed || 0
    const running = !!move.running
    const crouching = !!move.crouching
    const grounded = move.grounded !== false

    this._lastLoco = crouching ? 'crouch'
      : (!grounded ? 'run' : (speed > 6 ? 'run' : speed > 0.6 ? 'walk' : 'idle'))
    this.setLocomotion(this._lastLoco)

    // Multiplicador de tiempo según velocidad real
    const runA = this.actions.run
    if (this.current === 'run' && runA) runA.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 8, 0.7, 1.6))
    const walkA = this.actions.walk
    if (this.current === 'walk' && walkA) walkA.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 4.5, 0.6, 1.5))

    this.mixer.update(dt)

    this._updateFacial(dt)
    this._updateBreathing()
  }

  _updateBreathing() {
    const b = Math.sin(this._t * 1.5) * 0.5 + 0.5
    const chest = this.bones.chest
    chest.rotation.x += b * 0.02
    chest.scale.set(1 + b * 0.012, 1 + b * 0.016, 1 + b * 0.02)
    this.bones.neck.rotation.x += b * 0.008
  }

  _updateFacial(dt) {
    // Parpadeo
    this._blinkTimer -= dt
    if (this._blinkTimer <= 0) {
      this._blink = 1
      this._blinkTimer = 2.4 + Math.random() * 3.5
    }
    if (this._blink > 0) {
      this._blink = Math.max(0, this._blink - dt * 7)
      const k = Math.sin(this._blink * Math.PI)
      if (this.lidL) this.lidL.rotation.x = 0.5 + k * 1.05
      if (this.lidR) this.lidR.rotation.x = 0.5 + k * 1.05
    }
    // Microexpresión de la mandíbula
    const j = Math.sin(this._t * 2.1) * 0.5 + 0.5
    if (this.jaw) this.jaw.rotation.x += j * 0.02
    if (this.browL) this.browL.rotation.z = -0.24 - j * 0.05
    if (this.browR) this.browR.rotation.z = 0.24 + j * 0.05
  }

  _setupRimLight() {
    this.rimLight = new THREE.DirectionalLight(0xbfe0ff, 0.0)
    this.rimLight.castShadow = false
    this.rimTarget = new THREE.Object3D()
    this._rimStrength = 1.6

    this.fillLight = new THREE.DirectionalLight(0xffd8c2, 0.0)
    this.fillLight.castShadow = false
    this.fillTarget = new THREE.Object3D()
    this._fillStrength = 0.65
  }

  // Luces que siguen al personaje: contorno desde atrás y relleno desde la cámara
  updateLighting(camera) {
    const p = this.root.position
    const dir = camera.position.clone().sub(p)
    dir.y = 0
    if (dir.lengthSq() < 0.001) dir.set(0, 0, 1)
    dir.normalize()
    this.rimLight.position.set(p.x - dir.x * 6, p.y + 4.2, p.z - dir.z * 6)
    this.rimTarget.position.set(p.x, p.y + 1.4, p.z)
    this.fillLight.position.set(p.x + dir.x * 5, p.y + 3.0, p.z + dir.z * 5)
    this.fillTarget.position.set(p.x, p.y + 1.3, p.z)
    const on = this.root.visible
    this.rimLight.intensity = on ? this._rimStrength : 0.0
    this.fillLight.intensity = on ? this._fillStrength : 0.0
  }

  dispose() {
    this.mixer.stopAllAction()
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) m.dispose()
      }
    })
  }
}
