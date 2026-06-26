# backend-server — Monolito legacy

> **No es el stack de despliegue actual.** Usa [`backend-container/`](../backend-container/) + [`docker-compose.yml`](../docker-compose.yml) en la raíz del repo.

Este directorio contiene el **backend monolítico original** (Express + Socket.IO en un solo proceso). La lógica fue migrada a microservicios:

| Antes (monolito) | Ahora (microservicio) |
|------------------|------------------------|
| Auth, usuarios, sesiones | `backend-container/identity` |
| Avatares | `backend-container/media` |
| Partidas, sockets | `backend-container/game-realtime` |
| Puerto 3000 directo | `backend-container/gateway` |

## Cuándo usarlo

- Referencia de código histórico
- Scripts de migración (`scripts/`)
- Desarrollo local rápido sin Docker (opcional)

## Arranque legacy (referencia)

```bash
cd backend-server
cp .env.example .env
npm install
npm run dev
```

Para el proyecto de grado y despliegue con contenedores, seguir [`README.md`](../README.md) sección **Docker**.
