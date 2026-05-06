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
- Host de sala con configuración de partida.
- Número configurable de rondas.
- Modo con o sin puntuación.
- Voto secreto opcional.
- Pregunta visible u oculta para invitados.
- Votación entre jugadores.
- Resultados por ronda.
- Clasificación final.
- Confeti al terminar la partida.
- UI mobile-first con estética oscura.
- Animaciones, efectos glassmorphism y microinteracciones.

---

## Demo mental del producto

Democrazy está pensado para este tipo de uso:

- Una persona abre la web en el móvil.
- Crea sala.
- Enseña el QR.
- La gente entra sin instalar nada.
- Se juega en 2-5 minutos.
- Cada ronda genera conversación, bromas y pique.

El objetivo no es solo votar, sino provocar momentos sociales compartibles.

---

## Stack técnico

| Área | Tecnología |
|---|---|
| UI | HTML5 |
| Lógica | JavaScript ES Modules |
| Estilos | Tailwind CSS vía CDN |
| Tipografía | Google Fonts: Outfit |
| Tiempo real | `itty-sockets` vía `esm.sh` |
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
    ├── game.js
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

### `js/game.js`

Archivo principal de la aplicación.

Incluye:

- estado global,
- navegación entre pantallas,
- gestión de historial/hash routing,
- conexión socket,
- eventos multijugador,
- creación y unión a salas,
- inicio de partida,
- construcción de rondas,
- votaciones,
- cálculo de puntuaciones,
- renderizado de resultados,
- final de partida.

### `js/questions.js`

Banco de preguntas predefinidas.

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
  questionVisible: true
}
```

| Opción | Descripción |
|---|---|
| `rounds` | Número de rondas de la partida |
| `points` | Activa o desactiva puntuación |
| `privateVote` | Oculta quién votó a quién |
| `useQuestions` | Usa preguntas predefinidas |
| `questionVisible` | Permite ocultar la pregunta a los invitados |

---

## Roadmap

### Prioridad alta

- Corregir la gestión de IDs de jugador.
- Escapar nombres de usuario para evitar XSS.
- Añadir temporizador por ronda.
- Reconexión automática al recargar la página.
- Evitar que jugadores inactivos bloqueen la partida.

### Modo fiesta

- Pantalla especial para TV o proyector.
- QR grande de unión.
- Modo rápido de 3-5 minutos.
- Preguntas picantes opcionales.
- Sistema de castigos o retos.
- Efectos sonoros.
- Animaciones más teatrales en resultados.

### Retención

- Estadísticas por jugador.
- Logros.
- Histórico de partidas.
- Ranking local o global.
- Packs de preguntas.

### Escalabilidad

- Backend propio de sincronización.
- Validación autoritativa en servidor.
- Persistencia completa de estado de partida.
- Mejor sistema de sockets/reconexión.

---

## Issues destacados

El proyecto ya tiene issues creadas para mejorar estabilidad y gameplay:

- Unificar IDs reales de usuario y nombres visibles.
- Sanitizar usernames antes de renderizar.
- Mejorar WebSocket con fallback/reconexión.
- Añadir temporizador por ronda.
- Añadir reconexión automática.
- Implementar pantalla fiesta para TV/proyector.
- Añadir modo +18.
- Añadir modo castigos.
- Añadir modo rápido.

---

## Seguridad y limitaciones actuales

Democrazy está en desarrollo y actualmente confía bastante en el cliente.

Antes de abrirlo a un uso público más amplio conviene reforzar:

- sanitización de nombres,
- validación de longitud y caracteres,
- IDs únicos reales por jugador,
- control de duplicados,
- validación de votos,
- autoridad de servidor/host,
- reconexión segura,
- protección frente a manipulación del estado local.

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

1. Revisa los issues abiertos.
2. Escoge una mejora pequeña y acotada.
3. Crea una rama descriptiva:

```bash
git checkout -b feature/round-timer
```

4. Haz cambios pequeños y fáciles de revisar.
5. Abre un pull request contra `main`.

---

## Licencia

Pendiente de definir.

---

<p align="center">
  <strong>Democrazy: vota, ríete y descubre quién es realmente quién.</strong>
</p>
