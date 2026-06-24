# Roadmap — Web Dashboard (host / TV)

Para analizar en equipo. **Estado actual + ideas.**

---

## Qué tiene hoy

- Crear sala (`FIRE-XXXX`), QR para móviles
- Topología visual (lobby + partida), nodos vivos/muertos
- Control host: iniciar, avanzar fase, timers
- Logs SIEM públicos, trazas de voto, overlays (reparto, amenaza, game over)
- Bots QA, export replay JSON / session log
- Sin login obligatorio (namespace `/dashboard`)

**Rol actual:** pantalla del **anfitrión** en una TV/PC. Funciona bien en sesión presencial; **poco valor** si no eres quien crea la sala.

---

## Problema que plantea el equipo

> El dashboard está “solitario”: solo presenta el juego. ¿Cómo hacerlo **indispensable**?

---

## Ideas priorizadas

### P0 — Alto valor, encaja con el producto

| Idea | Descripción | Restricciones |
|------|-------------|---------------|
| **Espectador por código** | Pantalla “Ver sala”: ingresar `FIRE-XXXX` sin crear partida. Vista read-only: topología, fase, logs, votos. Sin controles de host. | Validar sala existe y fase ≠ FIN; rate-limit; no ver roles vivos |
| **Modo proyector vs operador** | URL `?mode=projector` solo gráficos; `?mode=operator` con botones. Dos pestañas en el mismo host. | Misma sala, dos sockets dashboard |
| **Lobby público en LAN** | Lista de salas activas en la red (`GET /api/games`) para unirse como espectador o copiar código. | Solo dev/LAN o con auth en prod |
| **Replay en navegador** | Subir o abrir `FIRE-XXXX-replay.json` y reproducir fase a fase (sin servidor). | Útil para revisión post-partida |

### P1 — Engagement y “razón de volver”

| Idea | Descripción |
|------|-------------|
| **Panel post-partida en web** | Estadísticas de la sesión: MVP, duración, eliminaciones por noche, gráfico de votos. Export PNG para redes. |
| **Cuenta host (web)** | Login opcional: “mis salas”, historial de hosts, reabrir replay guardado en Mongo. |
| **Integración Discord / OBS** | Browser source con layout limpio para streaming de partidas. |
| **Sonido ambiental configurable** | Mezcla desde dashboard (ya hay SFX); panel de volumen por categoría. |
| **Guía de roles para público** | Durante lobby, carrusel “roles posibles en esta mesa” **sin decir cuáles hay** — educa espectadores. |

### P2 — Diferenciación fuerte

| Idea | Descripción |
|------|-------------|
| **Espectador con chat lento** | Canal `spectator` solo lectura o chat moderado (host aprueba). |
| **Vista “centro de operaciones”** | Mapa de calor de actividad nocturna (anonimizado): “hub con más tráfico”. |
| **Torneos / bracket** | Varias salas, clasificación — requiere backend nuevo. |
| **Personalización de sala** | Logo facultad, nombre evento, duración de fases por slider antes de empezar. |

---

## Idea concreta: “Ver sala” (espectador)

Flujo propuesto:

1. Landing web: **[ Crear sala ]** | **[ Ver sala ]**
2. Ver sala → input `FIRE-XXXX` → `GET /api/games/:id/status` + socket `joinDashboard` en modo `spectator`
3. Backend: flag `spectator: true` — sin `startGame`, `advancePhase`, `fillBots`
4. UI: mismos gráficos, badge “MODO ESPECTADOR”, CTA “Descargar app para jugar”

**Validaciones:** sala no encontrada; partida terminada → mostrar resumen + replay; límite de espectadores (ej. 50).

---

## Qué NO recomendaría (por ahora)

- Login obligatorio para host en LAN/grado — fricción innecesaria.
- Mostrar roles vivos a espectadores — rompe el juego.
- Segundo cliente web que compita con el móvil para jugar — el móvil es el terminal del jugador.

---

## Métricas de éxito

- % de sesiones con al menos 1 espectador conectado
- Tiempo medio en “Ver sala” sin ser host
- Replays abiertos desde web post-partida

---

## Referencias

- Código: `web-dashboard/src/app/`
- Sockets: [SOCKET_CONTRACT.md](../SOCKET_CONTRACT.md)
- Estado global: [PROJECT_STATUS.md](PROJECT_STATUS.md)
