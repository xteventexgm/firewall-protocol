# Changelog — Firewall Protocol

Historial de cambios relevantes del monorepo. Las fechas agrupan trabajo por sesión de desarrollo.

---

## [Unreleased] — 2026-06-24

### Documentación

- Carpeta [`docs/`](docs/README.md): índice único, [`PROJECT_STATUS.md`](docs/PROJECT_STATUS.md), roadmaps web/móvil/backend.
- [`README.md`](README.md) y [`ROLES.md`](ROLES.md): **44 roles**, jugadores 5–16, Mongo/MinIO/auth, Docker, flujo actualizado.

### UX — fin de partida

- Game over móvil y web: narrativa humana; sin `Condición:` ni IDs técnicos.
- Roadmaps ampliados (P3, preguntas equipo): [`ROADMAP_MOBILE.md`](ROADMAP_MOBILE.md), [`ROADMAP_BACKEND.md`](ROADMAP_BACKEND.md).

### Sesión móvil (complemento)

- Refresh proactivo al abrir/reanudar app; JWT access 24 h, refresh 90 d en `.env`.

---

## [Unreleased] — 2026-06-23

### Persistencia MongoDB y cuentas de usuario

- **Backend:** `MongoDBAdapter`, conexión obligatoria si `MONGO_URI` está definido; fallback JSON sin Mongo.
- **Auth:** JWT, colecciones `users`, `auth_sessions`, `game_participations`; rutas `/api/auth/*`.
- **Scripts:** `npm run db:setup`, `db:seed`, `db:migrate` (JSON → Mongo).
- **Docker:** `backend-server/docker-compose.yml` (Mongo 7 + backend con `db:setup` automático).
- Documentación: [`DATABASE.md`](DATABASE.md).

### Avatares y perfil (móvil)

- **Avatares:** `AVATAR_STORAGE=disk` (local) o `minio` (S3-compatible); metadato en `users.avatarUrl`; proxy `GET /api/auth/avatars/:userId`.
- **Perfil:** victorias caóticas en stats; historial con última partida + vista de 10 partidas y detalle; refresh token automático (sesión hasta cerrar sesión).
- **En partida:** botón *Ver rol y habilidad*; textos sin markdown crudo (`**` / `` ` ``).
- **Web dashboard:** contador gris de duración usa `gameStartedAt` (duración total de partida).
- **URL backend configurable** en login (ngrok/LAN) vía `localStorage` (`fp_apiUrl`).
- **Sesión:** cierre automático si el usuario ya no existe; limpieza de avisos y avatar del FAB al desloguear.
- Documentación: [`STORAGE_AND_AVATARS.md`](STORAGE_AND_AVATARS.md) (opciones GridFS, S3, microservicios).

### Web dashboard — lobby

- Guías hub→slot vacías: líneas **discontinuas** y más tenues (alineadas con nodos fantasma `?`).
- Oculto indicador de estado MongoDB en UI (solo *Servidor en línea*).

### Documentación y roles

- README y [`ROLES.md`](../ROLES.md) actualizados: **44 roles** (16 System · 14 Black Hat · 14 Caótico), jugadores 5–16, stack Mongo/MinIO.
- [`DATABASE.md`](DATABASE.md) §11 avatares; enlaces en [`README.md`](README.md).

### Archivos principales

| Área | Archivos |
|------|----------|
| Mongo / auth | `MongoDBAdapter.ts`, `UserService.ts`, `auth.routes.ts`, `mongoConnection.ts` |
| Avatares | `AvatarService.ts`, `minioClient.ts`, `data/avatars/` o bucket MinIO |
| Móvil cuenta | `account-panel/`, `auth.service.ts`, `api-base.utils.ts` |
| Docs | `STORAGE_AND_AVATARS.md`, `DATABASE.md` |

---

## [Unreleased] — 2026-06-21

### Bots de QA (Fase 1) — partida solo contra bots

- **Backend:** `BotController` con acciones nocturnas por rol, votos aleatorios (hackers consensúan objetivo) y entradas `[BOT/QA]` en logs públicos.
- **Flag dev:** activo por defecto; desactivar con `DEV_BOTS=false` en producción.
- **Socket dashboard:** `fillBots(roomId, count?)` y `clearBots(roomId)` — solo en fase LOBBY.
- **Web:** botón *Añadir bots hasta 5*, quitar bots, badge **BOT** en lista de jugadores.

### Bots de QA (Fase 2) — IA básica + partida hasta FIN

- **`BotBrain.ts`:** sospecha por infección/votos; hackers atacan system; system vota infectados/sospechosos.
- **Auto-avance QA:** `runBotQaMatch` rellena bots, timers rápidos y avanza hasta `FIN` con logs `[BOT/QA]`.
- **Socket:** `runBotQaMatch(roomId)` · **CLI:** `npm run qa:bot-match` (headless, apto para CI).
- **Web:** botón *Partida QA automática* e indicador *Modo QA* durante la partida.

### Inicio de partida — reparto de roles y briefing de amenaza

- **Web (TV):** overlay *Distribuyendo roles* (~20 s) al pasar de LOBBY → DÍA 1; luego *RED COMPROMETIDA* (briefing SIEM existente, ~20 s).
- **Móvil:** briefing de credencial ampliado a **20 s**; al cerrar → **vibración** + overlay de amenaza con copy **por equipo**:
  - **System:** anomalías / red comprometida (como la TV).
  - **Black Hat:** *Acceso a la red exitoso* — infiltración sin alerta crítica.
  - **Caótico:** *Vector caótico activo* — intruso independiente.
- **Backend:** `sessionThreatBrief` incluido en `roomState` móvil (conteos agregados, sin roles ajenos).
- Utilidades: `session-threat-copy.utils.ts` (web + móvil).

### Archivos principales

| Área | Archivos |
|------|----------|
| Web overlays | `role-distribution-overlay.component.ts`, `threat-briefing.component.ts`, `app.ts` |
| Móvil | `dashboard.page.ts/html/scss` |
| Copy | `*/core/utils/session-threat-copy.utils.ts` |
| Backend | `GameState.toPlainForPlayer` |

---

## [Unreleased] — 2026-06-20

### Web dashboard — topología 2D (lobby)

- **Secuencia de boot de red** al crear sala vacía (~8,3 s): grilla → hub FW → órbitas → cables SVG por capas (hub → primarios → ramas) → wireframe hexagonal de slots fantasma → consola de estado en esquina inferior izquierda.
- **Animación de aparición de jugador** (sin cambios de contrato): cable en canvas → construcción wireframe del nodo → parpadeo de confirmación.
- **Cierre del boot:** destello de fondo **tenue** al completar nodos (`Red operativa`); fade **2,4 s** en líneas, nodos, hub y órbitas hasta el color de reposo (sin corte brusco al quitar clases de boot).
- **Layout de slots** (`layout.utils.ts`):
  - **4–6 jugadores:** estrella clásica (un anillo, ángulos iguales).
  - **7+ jugadores:** estrella extendida simétrica (4 cardinales + hojas en abanico); para conteos impares se calculan posiciones del total simétrico superior (8, 12, 16…) y se recortan slots; escala desde el **hub** (no desde el bounding box) para evitar brazos comprimidos (p. ej. sur demasiado cerca con 7 jugadores).
- **Guías de cable en lobby:** líneas sólidas hub→primario; ramas padre→hoja punteadas (sin cable directo hub→hoja).
- **Estado vacío:** texto *Esperando nodos en la red…* en esquina inferior izquierda (no tapa nodos del sur).
- **Mis salas:** contador `Conectados · X / Y nodos` vía `connectedCount` en status de sala activa (backend + refresh periódico en web).

### Archivos principales

| Área | Archivos |
|------|----------|
| Layout | `web-dashboard/src/app/core/utils/layout.utils.ts` |
| Topología | `web-dashboard/src/app/features/topology/topology.component.ts/html/scss` |
| Lobby / shell | `web-dashboard/src/app/features/lobby/`, `app.ts`, `app.html` |
| Backend status | `backend-server/src/services/dbSyncService.ts` |

### Pruebas sugeridas (manual)

Ver [`TESTING.md`](TESTING.md) §1.1 — animación de boot y layout 7 vs 8–12 jugadores.

---

## [Unreleased] — 2025-06-19

### Victoria y fin de partida

- **Victoria inmediata al eliminar jugadores:** `maybeEndGame()` se invoca al votar fuera a alguien, al arrastre de honeypot y al detectar condición de victoria sin depender de una segunda fase `VERIFICACION`.
- **Corrección crítica en `VERIFICACION`:** avanzar fase ya no saltaba a `NOCHE` sin comprobar victoria; primero evalúa `checkAnyWin` y termina en `FIN` si corresponde.
- **Caso borde caótico:** si no quedan hackers ni jugadores System pero sí caóticos vivos, se resuelve victoria solitaria o desempate caótico (`VictoryChecker.ts`).
- **Móvil — overlay de victoria:** al recibir `gameOver` ya no se limpia la sesión ni hay redirect automático a los 5 s; el jugador pulsa **Volver al login** para salir.
- **Animaciones:** pulso/entrada en overlay de victoria (web y móvil).

### Chat

- **Muertos:** canal `dead` habilitado en `NOCHE` y `VERIFICACION` (backend `ChatManager.ts`).
- **Móvil — pantalla de eliminado:** chat de espectadores integrado dentro del overlay *SISTEMA CAÍDO* (antes quedaba oculto por el overlay).
- **Hackers de noche:** canal hacker forzado en `NOCHE` para `black_hat`; fallback de equipo vía `effectiveTeam` (estado + socket).

### Web dashboard

- **Panel lateral compacto** durante partida activa: oculta QR, guía, timers, lista de jugadores e *Iniciar partida*; muestra código, fase, *Avanzar fase* y *Volver al lobby*.
- **Anti-fuga de roles:** el dashboard recibe `nightResolved` público (sin `privateResults`); logs internos anonimizados en motor de reglas.
- **Briefing *RED COMPROMETIDA*:** duración aumentada a 20 s.
- **Sonido:** servicio de audio para fases, votos, victoria y UI.
- **Topología 3D:** layout spider, nodos ampliados, partículas.
- **Logs públicos nocturnos** y barra de progreso de noche en pantalla principal.

### Mobile terminal

- **Login y dashboard** rediseñados con atmósfera cyber (partículas, grid, glass shell).
- **Minijuegos (skill checks):** objetivo, contexto, consecuencias; validación servidor; feedback visual con sacudida.
- **Pantalla completa nativa:** `StatusBar.hide()` + overlay web en Capacitor (oculta barra de estado en Android).
- **Lobby cerrado / reconexión / salir** con overlays y mensajes claros.

### Backend — arquitectura nocturna

- Nuevos módulos: `NightOrchestrator`, `NightActionProcessManager`, `NightRuntimeContext`, `MinigameChallengeManager`, `PublicLogService`, `SuspicionService`.
- Procesamiento de acciones nocturnas por lotes con progreso emitido a clientes.
- Minijuegos con preguntas más exigentes y resultado `minigameAnswerResult`.

### Salas y ciclo de vida

- `finishgame` / archivado al terminar partida.
- Salir del lobby pre-partida elimina al jugador sin borrar la sala.
- Cerrar sala desde web notifica `lobbyClosed` a móviles.

### Documentación

- README raíz profesional, `CHANGELOG.md`, READMEs de web-dashboard y mobile-terminal.
- Actualización de `TESTING.md` y `WIN_CONDITIONS.md` según comportamiento actual.

---

## Sesión anterior — UI, chat y estabilidad

### Web dashboard

- Lobby con scroll, chat ampliado, icono de aplicación.
- Botón *Volver al lobby* sin destruir la sala en servidor.
- Export de replay JSON tras `FIN`.

### Mobile terminal

- Chat vertical en dashboard; flujo login → reconexión → salir.
- Chat de muertos y hackers (primera iteración).
- Overlay de victoria con revelación de roles y estadísticas.

### Backend

- `leaveRoom` pre-game quita jugador de la sala.
- Rate-limit y canales de chat (`public`, `dead`, `hacker`).
- Tests manuales en `ChatManager.test.ts`.

---

## Convenciones de este changelog

| Tipo | Significado |
|------|-------------|
| **Victoria / reglas** | Cambios en `VictoryChecker`, `Room`, `RuleEngine` |
| **Socket** | Eventos, payloads, `roomBridge` |
| **Cliente** | web-dashboard o mobile-terminal |
| **Docs** | Archivos `.md` del repositorio |
| **Storage / avatares** | `AvatarService`, `data/avatars/`, GridFS, S3 |

Para el detalle línea a línea, consulta el historial de git y el transcript de la sesión de desarrollo.

---

## Próximos pasos sugeridos

- [ ] Tests automatizados para `VictoryChecker` y flujo de votación → `FIN`
- [ ] JWT en conexión socket
- [ ] Documentar variables de `environment.ts` por entorno (dev/staging/prod)
- [ ] Guía de despliegue Docker completa (backend + frontends)
