# Servicio game-realtime

Motor de partida, Socket.IO (`/game`, `/dashboard`) y REST de salas, replay y catálogo de roles.

## Puerto

- **3001** (interno)
- Público vía gateway: `http://localhost:3000`

## Responsabilidades

- Creación y ciclo de vida de salas (`FIRE-XXXX`)
- Namespaces Socket.IO: jugadores (`/game`) y host (`/dashboard`)
- Motor de reglas: fases, votos, noche, minijuegos, bots QA
- Persistencia de partidas (MongoDB + JSON en disco)
- Replay y session logs
- Validación JWT en `joinRoom` (paquete `@firewall/identity-service`)
- Bloqueo de join si cuenta registrada sin correo verificado (`REQUIRE_EMAIL_VERIFICATION`)

## Arranque local

```bash
cd backend-container/game-realtime
cp .env.example .env
npm install
PORT=3001 npm start
```

## Docker (stack completo)

```bash
# Desde la raíz del repo
docker compose up -d --build
```

## REST (vía gateway)

| Ruta | Descripción |
|------|-------------|
| `GET /api/games/:roomId/status` | Estado de sala (join/reconnect) |
| `GET /api/games/:roomId/replay` | Replay JSON |
| `GET /api/roles` | Catálogo de roles |
| `GET /health` | Health del servicio de juego |

## Socket.IO

Contrato completo: [`SOCKET_CONTRACT.md`](../../SOCKET_CONTRACT.md).

| Namespace | Cliente |
|-----------|---------|
| `/game` | mobile-terminal |
| `/dashboard` | web-dashboard |

## Dependencias

- **MongoDB** — partidas y roles
- **identity** — validación JWT, `emailVerified` en join
- Código compartido: `@firewall/identity-service`

## Datos locales

En Docker, volúmenes o bind mounts para `data/games/` según configuración del Dockerfile raíz.
