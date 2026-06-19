# Firewall Protocol

Thriller de deducción social multijugador (5–15 jugadores) con temática de ciberseguridad.

## Repositorio

| Carpeta | Descripción |
|---------|-------------|
| [`backend-server/`](backend-server/) | Servidor Node.js + Socket.io |
| [`mobile-terminal/`](mobile-terminal/) | App móvil Ionic/Angular (`/game`) |
| [`web-dashboard/`](web-dashboard/) | Dashboard PC/TV Angular (`/dashboard`) |

## Contrato socket

Documento compartido para mobile y dashboard:

**[`SOCKET_CONTRACT.md`](SOCKET_CONTRACT.md)**

Tipos canónicos TypeScript: [`backend-server/src/types/events.types.ts`](backend-server/src/types/events.types.ts)

## Inicio rápido (backend)

```bash
cd backend-server
npm install
npm run dev
```

Detalle completo: [`backend-server/README.md`](backend-server/README.md)
