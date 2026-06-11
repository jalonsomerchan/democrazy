# Democrazy

Party game web multijugador donde aparece una pregunta, todos votan a qué jugador le pega más y se revelan resultados por ronda. Por defecto la partida tiene un número definido de preguntas, y el administrador puede activar el modo de preguntas infinitas si quiere jugar hasta cerrar la sala manualmente.

## Stack técnico

| Área | Tecnología |
|---|---|
| UI | HTML5 |
| Lógica | JavaScript ES Modules + scripts globales compatibles |
| Estilos | Tailwind CSS vía CDN |
| Tiempo real | `itty-sockets` con fallback por polling contra la API |
| API | `https://alon.one/juegos/api` |
| QR | `api.qrserver.com` |

No usa build step. Puede servirse como app estática.

## Estructura del proyecto

```txt
.
├── index.html
└── js/
    ├── GameAPI.js
    ├── game-enhanced-v2.js
    └── questions.js
```

### `index.html`

Contiene la interfaz completa: login, lobby, sala de espera, configuración del host, juego, resultados, final, estilos y carga de scripts.

### `js/GameAPI.js`

Cliente HTTP para la API externa de juegos. Expone `window.GameAPI` para que pueda usarse desde el módulo principal.

Incluye manejo robusto de respuestas vacías, errores no JSON y estados HTTP fallidos.

### `js/game-enhanced-v2.js`

Archivo principal de la aplicación.

Incluye:

- estado global del juego,
- host real por `hostId`,
- creación/unión/reconexión de salas,
- sincronización por socket,
- fallback por polling contra la API,
- persistencia de `game_state`,
- temporizador controlado solo por host,
- validación de mínimo 2 jugadores,
- cambio de sala al iniciar nueva partida,
- renderizado de preguntas, categorías, votos y resultados,
- opciones avanzadas de resultados: ganador único, ocultar empates, rojo/verde y ocultación de recuentos,
- modo opcional de preguntas infinitas,
- cierre de sala para todos al pulsar **Fin del juego**.

### `js/questions.js`

Banco de preguntas predefinidas agrupadas por categorías. Expone `window.questionCategories` y mantiene `window.questions` como lista plana compatible.

## Ejecutar en local

```bash
python3 -m http.server 8080
```

Abrir:

```txt
http://localhost:8080
```

Evita abrir con `file://`.

## Configuración de partida

```js
{
  rounds: 5,
  infiniteMode: false,
  points: true,
  privateVote: false,
  adminCountsForVotes: true,
  showAllResults: true,
  redGreenMode: false,
  showVoteCounts: true,
  hideTies: false,
  useQuestions: true,
  questionVisible: true,
  roundTimeLimit: 30,
  questionCategories: ['fiesta', 'amistad', 'redes']
}
```

| Opción | Descripción |
|---|---|
| `rounds` | Número de preguntas si `infiniteMode` está desactivado |
| `infiniteMode` | Si está activo, la partida no termina sola; el admin debe pulsar **Fin del juego** |
| `points` | Activa/desactiva puntuación |
| `privateVote` | Oculta quién votó a quién |
| `adminCountsForVotes` | Si está activo el admin puede votar y recibir votos; si no, queda fuera de la votación |
| `showAllResults` | Si está activo se muestran todos los resultados; si no, solo el jugador más votado |
| `redGreenMode` | Solo disponible con `showAllResults: false`; muestra pantalla roja al más votado y verde al resto |
| `showVoteCounts` | Solo configurable con voto secreto; permite ocultar el número de votos |
| `hideTies` | Si hay empate entre los más votados, el host elige uno al azar y oculta el empate |
| `useQuestions` | Usa preguntas predefinidas |
| `questionVisible` | Permite ocultar la pregunta a invitados |
| `roundTimeLimit` | Tiempo máximo por ronda en segundos; `0` desactiva el límite |
| `questionCategories` | Categorías de preguntas incluidas en la partida; por defecto se marcan todas |

## Correcciones de estabilidad incluidas

- `GameAPI` y `questions` quedan disponibles explícitamente para el módulo principal.
- El temporizador solo finaliza ronda desde el host.
- La nueva partida notifica primero a la sala anterior y luego migra a la nueva sala.
- El botón de comenzar se bloquea con menos de 2 jugadores participantes.
- Si falla `itty-sockets`, se usa polling real contra la API en lugar de `BroadcastChannel` local.
- La reconexión restaura jugadores, settings, ronda, pregunta, votos y puntuaciones desde `game_state`.
- Las preguntas están agrupadas por categorías seleccionables por el host antes de empezar.
- El host puede elegir si se muestran todos los resultados, solo el ganador, ocultar empates con ganador aleatorio, modo rojo/verde, recuento de votos y si el admin participa en la votación.
- Por defecto se juega con un número de preguntas configurable; si se activa **Preguntas infinitas**, la partida avanza indefinidamente.
- Al pulsar **Fin del juego**, todos los jugadores salen de la sala y se borra la sesión activa.
- La etiqueta de host usa `hostId`, no la posición del jugador en el array.
- El cliente API soporta respuestas vacías o no JSON sin romper el flujo de error.
