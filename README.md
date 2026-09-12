# GREEN CODE — "Restaura el Futuro"

Videojuego 3D en primera persona para navegador sobre **impacto social y ambiental**.
El jugador encarna al **Sujeto Cero**, un mutante humanoide albino de aspecto
misterioso, que llega a una comunidad mexicana ficticia en colapso y usa la
herramienta tecnológica **GREEN CODE** para diagnosticar y resolver tres problemas:
agua, incendio forestal y deforestación. Puedes alternar entre **primera persona,
tercera persona y cámara frontal** con `V` para ver al personaje.

---

## Personaje: Sujeto Cero

Protagonista original inspirado en la figura de un mutante albino, construido
100 % por código (sin modelos externos) en [`src/player/MutantCharacter.js`](src/player/MutantCharacter.js):

- **Rig humanoide** articulado (19 huesos) delgado, alto y encorvado, con
  deformación craneal angulosa, pómulos marcados, nariz estrecha, orejas
  puntiagudas y ojos grandes con iris claros.
- **Materiales PBR** (`MeshPhysicalMaterial`/`MeshStandardMaterial`) con texturas
  procedurales generadas en canvas (piel pálida con venas, poros e imperfecciones;
  tela desgastada, manchas y arañazos; cuero con grano).
- **Subsurface scattering aproximado** mediante *shells* aditivos con fresnel para
  cráneo y orejas, más luz de contorno y relleno que siguen al personaje.
- **Animaciones** con `AnimationMixer` y clips generados por código: `idle`,
  `breathe`, `walk`, `run`, `crouch`, `look`, `hit`, `attack` y `death`, además de
  parpadeo y microexpresiones faciales procedurales.
- **Vestuario** oscuro y funcional: abrigo desgastado, pantalones tácticos, botas
  robustas, guantes, correas, bolsas y detalles metálicos.

---

## Concepto

El ecosistema de la región está colapsando. Alex llega a un **refugio** solitario: el
único punto seguro. Dentro encuentra cofres; en uno hay un **mapa** que señala un
**búnker agrícola** con semillas nativas. Desde ahí deberá **filtrar el agua de un río
contaminado**, **controlar un incendio forestal** y **reforestar** la zona con esas
semillas. El escenario cambia visualmente en tiempo real: de tierra seca, humo y agua
contaminada a un valle verde con agua limpia, árboles y fauna.

**Mensaje:** *las herramientas tecnológicas pueden ayudar a identificar problemas
ambientales, optimizar recursos y apoyar la toma de decisiones.*

## Objetivo

Progresión para llevar `ecosystemHealth` de **20 a 100**:

| # | Objetivo | Mecánica | Recompensa |
|---|---|---|---|
| 0 | Explorar el refugio y hallar el mapa | Entrar al refugio y abrir los cofres | +5 y baliza al búnker |
| 1 | Conseguir semillas del búnker | Llegar al búnker con el mapa y extraerlas | +5 y 10 semillas |
| 2 | Filtrar el agua del río | Activar los filtros en el orden correcto | +20 y agua 100% |
| 3 | Controlar el incendio | Activar 3 torres de control | +25 y fuego 0% |
| 4 | Reforestar la zona | Plantar las 10 semillas (crecimiento animado) | +25 y bosque 100% |

Al llegar a 100 aparece la pantalla final **ECOSISTEMA RESTAURADO**.

> Las **balizas** de colores en el cielo guían al jugador: verde (refugio y
> reforestación), azul (río), naranja (incendio) y cian (búnker, aparece al hallar el
> mapa). Cada una marca un objetivo sobre el terreno.

## Controles

| Tecla | Acción |
|---|---|
| `W` `A` `S` `D` | Moverse |
| Mouse | Mirar (Pointer Lock) |
| `Shift` | Correr |
| `Space` | Saltar |
| `Ctrl` / `C` | Agacharse |
| `V` | Cambiar vista (1ª / 3ª persona / frontal) |
| `F` · `H` · `K` | Ataque · Recibir daño · Muerte (demo de animaciones) |
| `E` | Interactuar / abrir GREEN CODE |
| `ESC` | Pausa / cerrar terminal |

## Cómo instalar y ejecutar

Requiere Node.js 18+.

```bash
npm install
npm run dev
```

Vite abrirá el navegador en `http://localhost:5173`.

Para compilar la versión de producción:

```bash
npm run build
npm run preview
```

## Tecnologías

- **Three.js** (WebGL, PBR, sombras, GLTF/GLB)
- **Vite** (dev server + build)
- **JavaScript ES Modules**
- **Pointer Lock API**
- **Web Audio API** (audio 100% procedural, sin archivos externos)
- **Postprocesado:** EffectComposer + UnrealBloomPass + OutputPass
- **Sky (Three.js addons)** + niebla exponencial dinámica
- **InstancedMesh** para vegetación y montañas

## Estructura del proyecto

```
GreenCodeGame/
├── index.html                 Estructura de UI (menús, HUD, terminal)
├── vite.config.js
├── package.json
├── ASSETS.md                  Fuentes y licencias de assets
├── public/assets/
│   ├── models/                (coloca aquí los .glb externos opcionales)
│   ├── textures/
│   └── audio/
└── src/
    ├── main.js                Punto de entrada
    ├── style.css
    ├── core/
    │   ├── Game.js            Núcleo, estados, loop, postprocesado
    │   ├── AssetManager.js    Fábricas procedurales + carga GLB opcional
    │   ├── AudioManager.js    Audio procedural
    │   └── Utils.js           Matemáticas, ruido y altura del terreno
    ├── player/
    │   ├── Player.js          Movimiento (andar/correr/saltar/agacharse) y vistas 1ª/3ª
    │   ├── CameraController.js Pointer Lock y mirada
    │   ├── MutantCharacter.js  Personaje albino: rig, PBR, SSS y AnimationMixer
    │   └── CharacterTextures.js Texturas procedurales (piel, tela, cuero)
    ├── missions/
    │   ├── MissionManager.js
    │   ├── ShelterMission.js     Refugio, cofres, mapa y búnker
    │   ├── WaterMission.js       Filtración del río contaminado
    │   ├── FireMission.js
    │   └── ReforestationMission.js
    ├── world/
    │   ├── World.js           Mapa, zonas, props, fauna, terreno
    │   └── Environment.js     Cielo, luces, niebla y color grading dinámico
    ├── effects/
    │   └── VFXManager.js      Fuego, humo, brasas, agua, polvo, hojas, fauna
    ├── ui/
    │   ├── HUD.js
    │   ├── Menu.js
    │   └── GreenCodeUI.js     Terminal de campo GREEN CODE
    └── systems/
        ├── InteractionSystem.js
        ├── EcosystemSystem.js
        └── SaveSystem.js
```

## Física y colisiones

- El jugador es sólido contra las **paredes del refugio** y el **búnker**.
  Se usa detección círculo–AABB en XZ (`World.resolveCollisions`) con rango vertical,
  de modo que la **puerta del refugio queda libre** y el resto de muros bloquean.
- Movimiento sobre el terreno con salto, carrera y agacharse.

## Transformación visual

`Environment`, `World` y `VFXManager` escuchan la **restauración** (0→1) derivada de
`ecosystemHealth` y la interpolan suavemente:

- Cielo: turbidez/seguimiento solar → azul limpio.
- Niebla: marrón densa → azul tenue.
- Terreno: colores áridos → verdes, por parches orgánicos.
- **Río: de verde contaminado con lodo a azul limpio** al filtrar el agua, con rizado
  animado (mapa de normales generado en canvas) y espuma en las orillas.
- Montañas de silueta irregular (geometría desplazada por ruido, color por instancia,
  nieve en las cumbres) y colinas cercanas para dar profundidad.
- Árboles con tronco estrechado, raíces, ramas y copa por capas (frondosas y coníferas).
- Vegetación: hierba instanciada y árboles que aparecen por umbrales.
- Fuego/humo/brasas: bajan con el nivel de incendio.
- Fauna: aves, mariposas y venados aparecen al restaurar.

## Impacto social

Se comunica mediante *gameplay*, no con textos largos: el jugador ve el problema
(escaneo GREEN CODE), decide, ejecuta una solución y **observa el cambio en el mundo**.
Basado en los ODS 6 (Agua), 13 (Clima) y 15 (Vida terrestre).

## Assets y licencias

Todos los modelos actuales son **procedurales** (código propio, sin licencia de
terceros). El proyecto admite reemplazarlos por **GLB/GLTF** reales colocándolos en
`public/assets/models/`. Ver **ASSETS.md**.

## Licencia

Proyecto académico / concurso universitario "Videojuegos con impacto social".
