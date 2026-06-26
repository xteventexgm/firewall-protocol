# API Gateway — único punto de entrada (puerto 3000)

Enruta HTTP y WebSocket a los microservicios internos. Los clientes (**móvil**, **dashboard**) solo conocen el host del gateway.

## Rutas

| Ruta pública | Destino interno |
|--------------|-----------------|
| `/api/auth/*` | **identity** `:3002` |
| `/api/auth/avatar`, `/api/auth/avatars/*` | **media** `:3003` (compatibilidad móvil) |
| `/api/media/*` | **media** `:3003` |
| `/game`, `/dashboard`, `/socket.io/*` | **game-realtime** `:3001` (WebSocket) |
| `/api/games`, `/api/roles`, `/health` del juego, etc. | **game-realtime** `:3001` |
| `/health` | Respuesta del propio gateway |

## Docker (recomendado)

Desde la **raíz del repo**:

```bash
docker compose up -d --build gateway
# o todo el stack:
docker compose up -d --build
```

Solo el puerto **3000** se publica. Túnel: `ngrok http 3000`.

## Desarrollo local (sin Docker)

```bash
# Terminal 1 — identity
cd backend-container/identity
PORT=3002 npm start

# Terminal 2 — media
cd backend-container/media
PORT=3003 npm start

# Terminal 3 — game-realtime
cd backend-container/game-realtime
PORT=3001 npm start

# Terminal 4 — gateway
cd backend-container/gateway
cp .env.example .env
npm install
npm start
```

## Verificación

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/api/auth/status
# Debe incluir: "service": "identity"
```

```powershell
docker compose logs -f gateway identity
```

## Comportamiento JWT

Para rutas que no son Socket.IO ni `GET /api/auth/avatars/*`, el gateway puede validar el Bearer contra identity y reenviar `X-User-Id` a servicios internos.
