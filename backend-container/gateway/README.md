# API Gateway — único punto de entrada (puerto 3000)

Enruta peticiones a los microservicios internos:

| Ruta | Destino |
|------|---------|
| `/api/auth/*` | **identity** `:3002` |
| `/api/auth/avatar`, `/api/auth/avatars/*` | **game-realtime** `:3001` (temporal) |
| `/game`, `/dashboard` (WebSocket) | **game-realtime** `:3001` |
| Resto (`/api/games`, `/health` del backend, etc.) | **game-realtime** `:3001` |
| `/health` (propio) | Respuesta del gateway |

## Desarrollo local (sin Docker)

```bash
# Terminal 1 — identity en 3002
cd backend-container/identity
PORT=3002 npm start

# Terminal 2 — backend (game-realtime) en 3001
cd backend-server
PORT=3001 npm start

# Terminal 3 — gateway en 3000
cd backend-container/gateway
cp .env.example .env
npm install
npm start
```

## Verificar que `/api/auth/status` pasa por identity

```powershell
# 1. Respuesta vía gateway (puerto 3000)
Invoke-RestMethod http://localhost:3000/api/auth/status

# Debe incluir: "service": "identity", "enabled": true
```

```powershell
# 2. Comparar con identity directo (solo red interna / debug)
Invoke-RestMethod http://localhost:3002/api/auth/status
```

Ambas respuestas deben ser equivalentes (mismo JSON). Si el gateway funciona, la primera petición nunca toca el código de identity en el cliente: el gateway la reenvía a `http://identity:3002`.

```powershell
# 3. Health del gateway (confirma rutas configuradas)
Invoke-RestMethod http://localhost:3000/health
```

```powershell
# 4. Logs (Docker)
docker compose logs -f gateway identity
# Al llamar /api/auth/status verás actividad en identity
```

## Docker Compose (raíz del repo)

```bash
docker compose up -d --build
```

Solo **3000** queda expuesto. Ngrok: `ngrok http 3000`.
