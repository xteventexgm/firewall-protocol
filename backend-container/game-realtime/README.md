# Servicio game-realtime

Motor de partida, Socket.IO (`/game`, `/dashboard`) y REST de salas.

## Puerto

- **3001** (interno)
- Público vía gateway: `http://localhost:3000`

## Desarrollo local

```bash
cd backend-container/game-realtime
cp .env.example .env
npm install
npm start
```

## Docker (stack completo)

```bash
# Desde la raíz del repo
docker compose up -d --build
```
