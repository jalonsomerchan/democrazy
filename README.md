# Democrazy

<p align="center">
  <strong>El party game web donde todos votan, nadie se libra y cada ronda acaba en risas.</strong>
</p>

<p align="center">
  <img alt="Status" src="https://img.shields.io/badge/status-in%20development-7C3AED">
  <img alt="Frontend" src="https://img.shields.io/badge/frontend-HTML%20%2B%20JavaScript-f7df1e">
  <img alt="Styling" src="https://img.shields.io/badge/styling-Tailwind%20CSS-38bdf8">
  <img alt="Game type" src="https://img.shields.io/badge/type-party%20game-ec4899">
  <img alt="Mobile first" src="https://img.shields.io/badge/mobile-first-22c55e">
</p>

---

## Qué es Democrazy

**Democrazy** es un juego social multijugador pensado para móviles, reuniones, fiestas y grupos de amigos.

La mecánica es sencilla:

> Aparece una pregunta, todos votan a quién del grupo le pega más, y al final se revelan los resultados.

Es una mezcla entre party game, votación social y juego de confianza/desconfianza. Está diseñado para que cualquiera pueda entrar en segundos mediante un código de sala o un QR.

---

## Gameplay

1. Un jugador crea una sala.
2. El resto se une con código, enlace o QR.
3. El host configura la partida.
4. Se lanza una pregunta por ronda.
5. Cada jugador vota a otra persona.
6. Se revelan los resultados.
7. Se acumulan puntos si el modo puntuación está activado.
8. Al final se muestra el ganador.

Ejemplos de preguntas:

- ¿Quién sería el primero en morir en un apocalipsis zombie?
- ¿Quién vendería a sus amigos por dinero?
- ¿Quién tiene más probabilidades de hacerse famoso?
- ¿Quién sería el peor jefe?

---

## Características actuales

- Creación de jugador desde el navegador.
- Persistencia del último jugador en `localStorage`.
- Creación de salas multijugador.
- Unión mediante código de sala.
- Enlaces compartibles con `?sala=CODIGO`.
- Generación de QR para invitar jugadores.
- Host de sala identificado por ID real, no por posición en la lista.
- Configuración de partida solo para host.
- Inicio bloqueado hasta tener al menos 2 jugadores.
- Número configurable de rondas.
- Modo con o sin puntuación.
- Voto secreto opcional.
- Pregunta visible u oculta para invitados.
- Temporizador de ronda controlado solo por host.
- Fallback de sincronización por API si falla `itty-sockets`.
- Persistencia de estado de sala para reconectar tras recargar.
- Cambio a nueva sala al pulsar “Nueva partida”, avisando a los invitados de la sala anterior.
- Votación entre jugadores.
- Resultados por ronda.
- Clasificación final.
- Confeti al terminar la partida.
- UI mobile-first con estética oscura.
- Animaciones, efectos glassmorphism y microinteracciones.

---

## Stack técnico

| Área | Tecnología |
|---|---|
| UI | HTML5 |
| Lógica | JavaScript ES Modules |
| Estilos | Tailwind CSS vía CDN |
| Tipografía | Google Fonts: Outfit |
| Tiempo real | `itty-sockets` vía `esm.sh` |
| Fallback realtime | Polling contra `https://alon.one/juegos/api` |
| API | `https://alon.one/juegos/api` |
| QR | `api.qrserver.com` |

El proyecto no usa build step actualmente. Es una app estática que puede desplegarse en GitHub Pages, Cloudflare Pages, Netlify, Vercel o cualquier hosting estático.

---

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

Contiene la interfaz completa:

- login,
- lobby,
- sala de espera,
- configuración del host,
- pantalla de juego,
- pantalla de resultados,
- pantalla final,
- estilos CSS personalizados,
- carga de scripts.

### `js/GameAPI.js`

Cliente HTTP para la API externa de juegos.

Gestiona:

- usuarios,
- juegos,
- salas,
- unión a salas,
- estado de sala,
- puntuaciones.

También expone `window.GameAPI` para poder usarse desde el módulo principal sin errores de ámbito.

### `js/game-enhanced-v2.js`

Archivo principal de la aplicación.

Incluye:

- estado global,
- navegación entre pantallas,
- gestión de historial/hash routing,
- conexión socket,
- fallback por polling de API,
- eventos multijugador,
- creación y unión a salas,
- inicio de partida,
- construcción de rondas,
- temporizador autoritativo del host,
- votaciones,
- cálculo de puntuaciones,
- renderizado de resultados,
- reconexión con restauración de pantalla,
- creación de nueva sala tras terminar partida.

### `js/questions.js`

Banco de preguntas predefinidas. Expone `window.questions` para que el módulo principal lo lea de forma segura.

---

## Ejecutar en local

Clona el repositorio:

```bash
git clone https://github.com/jalonsomerchan/democrazy.git
cd democrazy
```

Sirve la carpeta con un servidor local:

```bash
python3 -m http.server 8080
```

Abre:

```txt
http://localhost:8080
```

> Evita abrir el proyecto directamente con `file://`, porque los módulos ES y algunas APIs del navegador pueden comportarse distinto.

---

## Configuración de partida

Configuración base:

```js
{
  rounds: 5,
  points: true,
  privateVote: false,
  useQuestions: true,
  questionVisible: true,
  roundTimeLimit: 30
}
```

| Opción | Descripción |
|---|---|
| `rounds` | Número de rondas de la partida |
| `points` | Activa o desactiva puntuación |
| `privateVote` | Oculta quién votó a quién |
| `useQuestions` | Usa preguntas predefinidas |
| `questionVisible` | Permite ocultar la pregunta a los invitados |
| `roundTimeLimit` | Límite de tiempo por ronda en segundos; `0` lo desactiva |

---

## Sincronización y reconexión

La partida intenta usar `itty-sockets` para eventos en tiempo real. Si la importación o la conexión fallan, el cliente cambia a polling contra la API de sala. El estado persistido incluye:

- jugadores,
- host,
- configuración,
- ronda actual,
- pregunta actual,
- votos,
- puntuaciones,
- temporizador,
- último evento multijugador.

Esto permite recargar la página y volver a la sala en la pantalla correcta: espera, juego, resultados o final.

---

## Seguridad y limitaciones actuales

Democrazy está en desarrollo y actualmente sigue confiando bastante en el cliente.

Antes de abrirlo a un uso público más amplio conviene reforzar:

- validación autoritativa de votos en servidor,
- control de duplicados y usuarios desconectados,
- protección frente a manipulación del estado local,
- backend propio de sincronización para escenarios de mucha concurrencia.

---

## Ideas de evolución

Democrazy puede crecer hacia un party game más completo con:

- modo Kahoot para pantalla compartida,
- modo TikTok/viral con resultados compartibles,
- preguntas por categorías,
- modo parejas,
- modo amigos íntimos,
- modo empresa/team building,
- modo familiar,
- modo sin puntuación,
- modo anónimo,
- retos físicos,
- comodines,
- eventos especiales por ronda.

---

## Diseño

La identidad visual actual usa:

- fondo oscuro,
- color principal violeta,
- tarjetas glassmorphism,
- tipografía redondeada y moderna,
- animaciones rápidas,
- experiencia mobile-first.

El objetivo visual es que parezca un juego social moderno, no un formulario web.

---

## Contribuir

Ideas recomendadas para contribuir:

1. Revisa `agents.md`.
2. Escoge una mejora pequeña y acotada.
3. Crea una rama descriptiva.
4. Haz cambios pequeños y fáciles de revisar.
5. Abre un pull request contra `main`.

---

## Licencia

Pendiente de definir.

---

<p align="center">
  <strong>Democrazy: vota, ríete y descubre quién es realmente quién.</strong>
</p>
