# ASSETS — GREEN CODE

Este documento registra **todos los assets** del juego, su autor, fuente, licencia y
uso. El objetivo del MVP es no depender de descargas externas: **todo lo que ves en
pantalla se genera por código** (geometría procedural low-poly). Aun así, el proyecto
está preparado para **sustituir los placeholders por modelos GLB/GLTF reales** sin
tocar la lógica del juego.

---

## 1. Assets actuales (procedurales, código propio)

Generados en `src/core/AssetManager.js` con Three.js (`BoxGeometry`,
`CylinderGeometry`, `IcosahedronGeometry`, `ConeGeometry`, etc.) y materiales
`MeshStandardMaterial` con `flatShading`.

| Asset | Fábrica (`AssetManager`) | Uso en el juego | Autor | Licencia |
|---|---|---|---|---|
| Casa | `makeHouse()` | Reserva (ya no se usa al inicio; disponible para futuros añadidos) | Equipo GREEN CODE | Código propio |
| Árbol vivo | `makeTree('alive')` | Bosque, reforestación, comunidad | Equipo GREEN CODE | Código propio |
| Árbol muerto | `makeTree('dead')` | Estado inicial del mapa | Equipo GREEN CODE | Código propio |
| Árbol quemado | `makeTree('burnt')` | Zona incendiada | Equipo GREEN CODE | Código propio |
| Tanque de agua | `makeWaterTank()` | Misión 1 (Agua) | Equipo GREEN CODE | Código propio |
| Segmento de tubería | `makePipeSegment()` | Puzzle de agua | Equipo GREEN CODE | Código propio |
| Torre de control | `makeTower()` | Misión 2 (Incendio) | Equipo GREEN CODE | Código propio |
| Roca | `makeRock()` | Decoración | Equipo GREEN CODE | Código propio |
| Cactus | `makeCactus()` | Decoración (México) | Equipo GREEN CODE | Código propio |
| Arbusto | `makeBush()` | Decoración | Equipo GREEN CODE | Código propio |
| Barril | `makeBarrel()` | Props de comunidad | Equipo GREEN CODE | Código propio |
| Caja | `makeCrate()` | Props de comunidad / incendio | Equipo GREEN CODE | Código propio |
| Señal | `makeSign()` | Señal GREEN CODE | Equipo GREEN CODE | Código propio |
| Poste | `makePost()` | Comunidad | Equipo GREEN CODE | Código propio |
| Cofre (madera/metal/óxido) | `makeChest(type)` | Refugio (contiene el mapa) | Equipo GREEN CODE | Código propio |
| Refugio | `World._buildRefugio()` | Punto de inicio y cofres | Equipo GREEN CODE | Código propio |
| Búnker agrícola | `World._buildBunker()` | Reserva de semillas | Equipo GREEN CODE | Código propio |
| Río | `World._buildRiver()` | Agua contaminada → limpia | Equipo GREEN CODE | Código propio |
| Venado | `makeDeer()` | Fauna (biodiversidad) | Equipo GREEN CODE | Código propio |
| Ave | `makeBird()` | Fauna (cielo) | Equipo GREEN CODE | Código propio |
| Persona | `makePerson()` | Reserva (NPC) | Equipo GREEN CODE | Código propio |
| Mariposa | `World._buildWildlife()` | Fauna restaurada | Equipo GREEN CODE | Código propio |
| Hierba | `InstancedMesh` en `World._scatterNaturals()` | Vegetación restaurada | Equipo GREEN CODE | Código propio |
| Partículas (fuego, humo, brasas, agua, polvo, hojas) | `VFXManager` (sprites canvas) | Efectos | Equipo GREEN CODE | Código propio |
| Audio (viento, fuego, agua, aves, música, SFX) | `AudioManager` (Web Audio API) | Sonido | Equipo GREEN CODE | Código propio |
| Cielo | Three.js `Sky` (addon) | Fondo | Three.js authors | MIT |

> **No se ha descargado ningún asset de terceros.** No hay riesgo de licencia en el MVP.

---

## 2. Cómo sustituir por modelos reales (GLB/GLTF)

Coloca el archivo en `public/assets/models/` con **exactamente** este nombre. Si existe,
`AssetManager.preload()` lo carga y reemplaza automáticamente al placeholder. Si no
existe, el juego sigue funcionando con el procedural.

| Nombre de archivo | Reemplaza a |
|---|---|
| `house.glb` | Casa |
| `tree_alive.glb` | Árbol vivo |
| `tree_dead.glb` | Árbol muerto |
| `tree_burnt.glb` | Árbol quemado |
| `water_tank.glb` | Tanque de agua |
| `pipe_segment.glb` | Segmento de tubería |
| `tower.glb` | Torre de control |
| `rock.glb` | Roca |
| `cactus.glb` | Cactus |
| `bush.glb` | Arbusto |
| `barrel.glb` | Barril |
| `crate.glb` | Caja |
| `sign.glb` | Señal |
| `post.glb` | Poste |
| `deer.glb` | Venado |
| `bird.glb` | Ave |
| `person.glb` | Persona |
| `chest.glb` | Cofre |

Recomendaciones al importar:

- Escala realista: un árbol ≈ 4–8 unidades, una casa ≈ 4–6, el jugador mide 1.7.
- Que el origen del modelo esté en la **base** (pies/raíz) para que se apoye en el suelo.
- Formato `.glb` (binario). Si usas Draco, añade el decoder en `AssetManager`.
- Sombras: `AssetManager` ya activa `castShadow`/`receiveShadow` en todos los meshes.

---

## 3. Fuentes recomendadas (assets gratuitos / licencia compatible)

Si quieres modelos más detallados, estas fuentes permiten uso en proyectos académicos
y comerciales. **Verifica siempre la licencia del asset concreto antes de usarlo.**

| Fuente | Contenido | Licencia típica |
|---|---|---|
| [Kenney](https://kenney.nl/assets) | Naturaleza, props, personajes, vehículos | CC0 (dominio público) |
| [Quaternius](https://quaternius.com/) | Árboles, animales, naturaleza, low-poly | CC0 |
| [Poly Haven](https://polyhaven.com/) | HDRIs, texturas PBR, algunos modelos | CC0 |
| [ambientCG](https://ambientcg.com/) | Texturas PBR (agua, tierra, madera, metal) | CC0 |
| [OpenGameArt](https://opengameart.org/) | Naturaleza, FX, audio | Varía (CC0 / CC-BY / GPL) |
| [Sketchfab](https://sketchfab.com/) | Modelos GLB/GLTF | Varía (filtrar por CC) |
| [Mixamo](https://www.mixamo.com/) | Personajes + animaciones | Licencia Adobe (gratis para uso en proyectos) |
| [Freesound](https://freesound.org/) | Audio ambiente y FX | Varía (CC0 / CC-BY) |

Si añades un asset externo, **regístralo en la tabla de abajo** (autor, fuente, licencia,
uso) para mantener la trazabilidad legal.

---

## 4. Registro de assets externos añadidos (completar si se usan)

| Asset | Autor | Fuente (URL) | Licencia | Uso en el juego |
|---|---|---|---|---|
| _(vacío)_ | | | | |

---

## 5. Cómo se cargan

`src/core/AssetManager.js`:

```js
const MODELS = ['house', 'tree_alive', /* ... */]
for (const name of MODELS) {
  const url = `${import.meta.env.BASE_URL}assets/models/${name}.glb`
  try { /* carga con GLTFLoader */ } catch { /* usa placeholder procedural */ }
}
```

Los archivos se sirven desde `public/assets/models/` (Vite los copia a `dist/`).
