# Democrazy

Party game web multijugador donde aparece una pregunta, todos votan a qué jugador le pega más y se revelan resultados por ronda. La partida usa preguntas infinitas y solo termina cuando el administrador pulsa **Fin del juego**.

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
- modo de preguntas infinitas,
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
  rounds: 0,
  infiniteMode: true,
  points: true,
  privateVote: false,
  useQuestions: true,
  questionVisible: true,
  roundTimeLimit: 30,
  questionCategories: ['fiesta', 'amistad', 'redes']
}
```

| Opción | Descripción |
|---|---|
| `rounds` | `0` en modo infinito; se mantiene por compatibilidad |
| `infiniteMode` | La partida no termina sola; el admin debe pulsar **Fin del juego** |
| `points` | Activa/desactiva puntuación |
| `privateVote` | Oculta quién votó a quién |
| `useQuestions` | Usa preguntas predefinidas |
| `questionVisible` | Permite ocultar la pregunta a invitados |
| `roundTimeLimit` | Tiempo máximo por ronda en segundos; `0` desactiva el límite |
| `questionCategories` | Categorías de preguntas incluidas en la partida; por defecto se marcan todas |

## Correcciones de estabilidad incluidas

- `GameAPI` y `questions` quedan disponibles explícitamente para el módulo principal.
- El temporizador solo finaliza ronda desde el host.
- La nueva partida notifica primero a la sala anterior y luego migra a la nueva sala.
- El botón de comenzar se bloquea con menos de 2 jugadores.
- Si falla `itty-sockets`, se usa polling real contra la API en lugar de `BroadcastChannel` local.
- La reconexión restaura jugadores, settings, ronda, pregunta, votos y puntuaciones desde `game_state`.
- Las preguntas están agrupadas por categorías seleccionables por el host antes de empezar.
- La partida avanza indefinidamente hasta que el administrador cierra la sala.
- Al pulsar **Fin del juego**, todos los jugadores salen de la sala y se borra la sesión activa.
- La etiqueta de host usa `hostId`, no la posición del jugador en el array.
- El cliente API soporta respuestas vacías o no JSON sin romper el flujo de error.
