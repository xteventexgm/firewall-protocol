# Firewall Protocol — Microservicios (`backend-container/`)

Estructura inicial para dividir el monolito `backend-server/` en tres dominios.
**`identity/`**, **`gateway/`** y **`media/`** están implementados; **`game-realtime/`** migrado desde el monolito.

## Visión general

```
                    ┌─────────────────┐
                    │  Clientes       │
                    │  mobile / web   │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ identity/       │ │ media/          │ │ game-realtime/       │
│ HTTP REST       │ │ HTTP REST       │ │ HTTP + Socket.IO     │
│ /api/auth/*     │ │ /api/media/*    │ │ /game, /dashboard    │
└────────┬────────┘ └────────┬────────┘ └──────────┬───────────┘
         │                   │                    │
         └───────────────────┼────────────────────┘
                             ▼
                    ┌─────────────────┐
                    │ MongoDB Atlas   │
                    │ Object storage  │
                    │ (R2 / S3)       │
                    └─────────────────┘
```

| Servicio | Puerto interno | Puerto público (vía gateway) |
|----------|----------------|------------------------------|
| `gateway` | — | **3000** (Ngrok) |
| `identity` | 3002 | `/api/auth/*` |
| `game-realtime` | 3001 | `/game`, `/dashboard`, REST del juego |
| `media` | 3003 | `/api/media/*`, avatares legacy `/api/auth/avatar` |

Fases futuras (no en esta estructura): **Redis** para pub/sub entre instancias de `game-realtime`, API Gateway / reverse proxy (nginx, Traefik).

---

## `identity/` — Identidad y perfiles

**Qué debe contener**

- Registro, login, refresh de tokens, logout.
- Validación de JWT para que otros servicios confíen en el `userId`.
- Perfil de jugador (username, metadatos públicos).
- Historial de partidas por usuario (`GameParticipation`).
- Políticas de contraseña y hashing.

**Origen en `backend-server/src/`**

| Destino propuesto (`identity/src/`) | Origen actual |
|-------------------------------------|---------------|
| `routes/auth.routes.ts` | `routes/auth.routes.ts` **sin** rutas de avatar (upload/serve/delete) |
| `auth/jwt.ts` | `auth/jwt.ts` |
| `auth/password.ts` | `auth/password.ts` |
| `auth/passwordPolicy.ts` | `auth/passwordPolicy.ts` |
| `services/UserService.ts` | `services/UserService.ts` |
| `services/AuthSessionService.ts` | `services/AuthSessionService.ts` |
| `services/GameParticipationService.ts` | `services/GameParticipationService.ts` |
| `models/PlayerProfile.ts` | `models/PlayerProfile.ts` |
| `types/player-metadata.types.ts` | `types/player-metadata.types.ts` |
| `config/env.ts` | Subconjunto: `MONGO_URI`, `JWT_*`, `REFRESH_TOKEN_*` |
| `services/mongoConnection.ts` | Copia/adaptación (colecciones `users`, `auth_sessions`, `game_participations`) |
| `middleware/verifyJwt.ts` | Extraer de `auth.routes.ts` + `sockets/roomHandler.ts` (validación token) |
| `app.ts` / `server.ts` | Nuevo entrypoint HTTP mínimo |

**API HTTP objetivo**

- `POST /api/auth/register`, `/login`, `/refresh`, `/logout`
- `GET /api/auth/me`, `PATCH /api/auth/profile`, `PATCH /api/auth/password`
- `GET /api/auth/participations`
- `GET /health`

**Dependencias externas**

- MongoDB (usuarios y sesiones).
- No requiere object storage.

---

## `media/` — Archivos y avatares

**Qué debe contener**

- Subida, servicio y borrado de avatares.
- Cliente S3-compatible (Cloudflare R2, MinIO, AWS).
- URLs firmadas o proxy de lectura (`/api/media/avatars/:userId`).
- Migración de avatares legacy (script `avatars:migrate-to-s3`).

**Origen en `backend-server/src/`**

| Destino propuesto (`media/src/`) | Origen actual |
|----------------------------------|---------------|
| `routes/media.routes.ts` | Rutas de avatar extraídas de `routes/auth.routes.ts` (`POST/GET/DELETE /avatar`, `PATCH` con `avatarUrl` externo) |
| `services/AvatarService.ts` | `services/AvatarService.ts` |
| `services/objectStorageClient.ts` | `services/objectStorageClient.ts` |
| `config/env.ts` | `AVATAR_*`, `S3_*`, `R2_*`, `MINIO_*` |
| `middleware/verifyJwt.ts` | Compartido con identity (validar que solo el dueño sube su avatar) |
| `scripts/migrate-avatars.ts` | `backend-server/scripts/` (migración a S3) |
| `app.ts` / `server.ts` | Nuevo entrypoint HTTP |

**API HTTP objetivo**

- `POST /api/media/avatars/:userId` (multipart)
- `GET /api/media/avatars/:userId`
- `DELETE /api/media/avatars/:userId`
- `GET /health` (incluye estado de bucket R2/S3)

**Dependencias externas**

- Object storage (R2 recomendado en producción).
- Opcional: MongoDB solo para actualizar `avatarUrl` en perfil **o** callback a `identity` vía HTTP interno.

**Nota de integración**

- Hoy `UserService` y `auth.routes` mezclan perfil + avatar. En microservicios, `identity` guarda la URL canónica; `media` es dueño del blob.

---

## `game-realtime/` — Juego en tiempo real

**Qué debe contener**

- Socket.IO: namespaces `/game` y `/dashboard`.
- Motor de partida (`Room`, `RuleEngine`, fases, votos, noche, minijuegos, bots).
- Creación y ciclo de vida de salas (`RoomManager`, `Matchmaking`).
- Persistencia de partidas (JSON local y/o MongoDB).
- Export replay, session log, status de sala.
- Bridge de eventos socket (`roomBridge`, handlers).

**Origen en `backend-server/src/`**

| Destino propuesto (`game-realtime/src/`) | Origen actual |
|------------------------------------------|---------------|
| `sockets/index.ts` | `sockets/index.ts` |
| `sockets/roomHandler.ts` | `sockets/roomHandler.ts` |
| `sockets/gameHandler.ts` | `sockets/gameHandler.ts` |
| `sockets/dashboardHandler.ts` | `sockets/dashboardHandler.ts` |
| `sockets/roomBridge.ts` | `sockets/roomBridge.ts` |
| `game/*` (todo el directorio) | `game/*` |
| `models/GameState.ts` | `models/GameState.ts` |
| `types/events.types.ts` | `types/events.types.ts` |
| `types/roles.types.ts` | `types/roles.types.ts` |
| `types/index.ts` | `types/index.ts` |
| `services/dbSyncService.ts` | `services/dbSyncService.ts` |
| `services/GameSessionLogService.ts` | `services/GameSessionLogService.ts` |
| `services/MongoDBAdapter.ts` | `services/MongoDBAdapter.ts` |
| `services/JsonAdapter.ts` | `services/JsonAdapter.ts` |
| `config/database.ts` | `config/database.ts` |
| `config/database.types.ts` | `config/database.types.ts` |
| `routes/games.routes.ts` | Rutas de `app.ts`: `/api/games`, `/api/roles`, replay, session-log, status |
| `utils/socketErrors.ts` | `utils/socketErrors.ts` |
| `utils/socketPlayerBinding.ts` | `utils/socketPlayerBinding.ts` |
| `utils/socketLog.ts` | `utils/socketLog.ts` |
| `utils/roomCapacity.ts` | `utils/roomCapacity.ts` |
| `utils/roleCopy.ts` | `utils/roleCopy.ts` |
| `utils/constants.ts` | `utils/constants.ts` |
| `utils/logger.ts` | `utils/logger.ts` |
| `game/playerMetadata.ts` | `game/playerMetadata.ts` |
| `server.ts` | `server.ts` (HTTP + Socket.IO) |
| `app.ts` | Parte REST de `app.ts` + `GET /health` agregado |

**API / tiempo real objetivo**

- Socket.IO `/game`, `/dashboard` (contrato en `SOCKET_CONTRACT.md`).
- `GET /api/games`, `/api/games/:roomId/status`, replay, session-log.
- `GET /api/roles` (catálogo desde Mongo o fallback código).
- `GET /health`

**Dependencias externas**

- MongoDB (archivos `finishgame` / `deletegame`, colección `roles` opcional).
- JSON en disco (`data/games/`) en desarrollo.
- **Llamadas a `identity`**: validar JWT en `joinRoom` (hoy en `roomHandler` + `verifyAccessToken`).
- **Llamadas a `media`**: resolver URL de avatar en estado público (opcional, fase 2).

**Qué NO mover aquí**

- `UserService`, `AuthSessionService` → `identity`
- `AvatarService`, `objectStorageClient` → `media`

---

## Código compartido (fase siguiente)

Crear más adelante `packages/shared/` o `libs/contracts/`:

| Paquete | Contenido |
|---------|-----------|
| `@firewall/contracts` | `events.types.ts`, códigos de error socket, DTOs públicos |
| `@firewall/auth-client` | `verifyAccessToken` vía JWKS o secreto compartido |
| `@firewall/logger` | `utils/logger.ts` unificado |

Hasta entonces, cada servicio puede duplicar tipos mínimos o consumir el paquete monolito como referencia.

---

## Qué permanece en `backend-server/` (por ahora)

- Todo el código actual sigue ejecutándose desde `backend-server/`.
- `docker-compose.yml` y `Dockerfile` actuales no cambian en esta fase.
- Los clientes (`mobile-terminal`, `web-dashboard`) siguen apuntando al mismo host/puerto.

---

## Próximos pasos (pendiente de tu confirmación)

1. Crear `package.json`, `tsconfig` y `Dockerfile` por servicio.
2. Mover código según tablas anteriores (copia primero, luego cableado).
3. Extraer rutas de avatar de `auth.routes.ts` hacia `media`.
4. Añadir variables `IDENTITY_URL`, `MEDIA_URL` en `game-realtime` para validación HTTP interna.
5. Actualizar `docker-compose.yml` raíz con los tres servicios + Mongo + R2.
6. Documentar en `SOCKET_CONTRACT.md` si cambian URLs base (gateway).

**No ejecutar migración de código hasta confirmación explícita.**
