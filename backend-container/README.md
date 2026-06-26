# Firewall Protocol — Microservicios (`backend-container/`)

Stack **activo** del backend: cuatro servicios en Docker, orquestados desde el [`docker-compose.yml`](../docker-compose.yml) en la raíz del repositorio.

> El monolito [`backend-server/`](../backend-server/) queda como referencia histórica. Toda funcionalidad nueva va aquí.

---

## Arquitectura

```
                    ┌─────────────────┐
                    │  Clientes       │
                    │  mobile / web   │
                    └────────┬────────┘
                             │  :3000
                    ┌────────▼────────┐
                    │  gateway        │
                    └────────┬────────┘
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ identity        │ │ media           │ │ game-realtime        │
│ :3002           │ │ :3003           │ │ :3001                │
│ /api/auth/*     │ │ /api/media/*    │ │ Socket.IO + REST     │
└────────┬────────┘ └────────┬────────┘ └──────────┬───────────┘
         │                   │                    │
         └───────────────────┼────────────────────┘
                             ▼
                    ┌─────────────────┐
                    │ MongoDB Atlas   │
                    │ Cloudflare R2   │
                    └─────────────────┘
```

| Servicio | Puerto interno | Expuesto vía gateway |
|----------|----------------|----------------------|
| **gateway** | 3000 | Sí (único puerto público) |
| **identity** | 3002 | `/api/auth/*` |
| **media** | 3003 | `/api/media/*`, `/api/auth/avatar(s)/*` |
| **game-realtime** | 3001 | `/game`, `/dashboard`, `/api/games`, … |

---

## Arranque

```bash
# Desde la raíz del repo
cp backend-container/.env.example backend-container/.env
# Editar MONGO_URI, JWT_SECRET, SMTP, R2, APP_PUBLIC_URL

docker compose up -d --build
docker compose logs -f gateway identity media game-realtime
```

Comprobar:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/auth/status
```

Túnel móvil: `ngrok http 3000` o Cloudflare Tunnel → actualizar `APP_PUBLIC_URL` y `environment.prod.ts` del móvil.

---

## Servicios

| Carpeta | README | Responsabilidad |
|---------|--------|-----------------|
| [`gateway/`](gateway/) | [README](gateway/README.md) | Proxy HTTP/WS, CORS |
| [`identity/`](identity/) | [README](identity/README.md) | Auth, perfil, correos, eliminación de cuenta |
| [`media/`](media/) | [README](media/README.md) | Avatares (R2 / disco) |
| [`game-realtime/`](game-realtime/) | [README](game-realtime/README.md) | Partidas, Socket.IO, motor de reglas |

---

## Variables de entorno

Archivo único: [`backend-container/.env`](.env) (ver [`.env.example`](.env.example)).

| Variable | Servicios | Uso |
|----------|-----------|-----|
| `MONGO_URI` | identity, game-realtime | MongoDB Atlas |
| `JWT_SECRET` | identity, game-realtime | Tokens JWT |
| `INTERNAL_SERVICE_KEY` | identity, media | Llamadas internas (avatar, delete) |
| `APP_PUBLIC_URL` | identity | Enlaces en correos (ngrok / dominio) |
| `SMTP_*` | identity | Correos transaccionales |
| `REQUIRE_EMAIL_VERIFICATION` | identity, game-realtime | Bloqueo join sin verificar |
| `AVATAR_STORAGE`, `S3_*`, `R2_*` | media | Almacenamiento de avatares |
| `IDENTITY_URL`, `MEDIA_URL` | gateway, media, game-realtime | URLs internas Docker |

---

## Paquete compartido

`identity` exporta `@firewall/identity-service` (JWT, UserService, mongo) consumido por `game-realtime` vía dependencia local `file:../identity`.

---

## Documentación relacionada

- [Estado del proyecto](../docs/PROJECT_STATUS.md)
- [Roadmap backend](../docs/ROADMAP_BACKEND.md)
- [Avatares y almacenamiento](../STORAGE_AND_AVATARS.md)
- [Contrato Socket.io](../SOCKET_CONTRACT.md)

---

## Evolución futura

Redis para pub/sub entre réplicas de `game-realtime`, CDN en avatares, observabilidad. Ver [ROADMAP_BACKEND.md](../docs/ROADMAP_BACKEND.md).
