# Estado del proyecto — Firewall Protocol

**Última actualización:** junio 2026

---

## Resumen ejecutivo

| Área | Estado |
|------|--------|
| **Backend desplegable** | ✅ Microservicios Docker (`backend-container/`) |
| **Gateway público** | ✅ Puerto 3000 (HTTP + WebSocket) |
| **Motor de juego** | ✅ `game-realtime` (Socket.IO + REST) |
| **Auth y perfiles** | ✅ `identity` (MongoDB Atlas) |
| **Avatares** | ✅ `media` (Cloudflare R2 o disco) |
| **Monolito legacy** | 📦 `backend-server/` (referencia, no stack principal) |
| **Clientes** | ✅ `mobile-terminal`, `web-dashboard` apuntan al gateway |

---

## Microservicios (implementados)

```
Cliente → gateway:3000
            ├── /api/auth/*        → identity:3002
            ├── /api/auth/avatars/* → media:3003 (compat móvil)
            ├── /api/media/*       → media:3003
            ├── /game, /dashboard  → game-realtime:3001 (WS)
            └── /api/games, …      → game-realtime:3001 (HTTP)
```

| Servicio | Responsabilidad | Persistencia |
|----------|-----------------|--------------|
| **gateway** | Enrutamiento, CORS, proxy WS, reenvío JWT | — |
| **identity** | Registro, login, JWT, sesiones, perfil, historial, correos | MongoDB |
| **media** | Upload/serve/delete avatares | R2 / S3 / disco |
| **game-realtime** | Salas, fases, votos, bots, replay, REST de partidas | MongoDB + JSON local |

Orquestación: [`docker-compose.yml`](../docker-compose.yml) en la raíz del repo.  
Variables compartidas: [`backend-container/.env`](../backend-container/.env).

---

## Autenticación y cuentas

| Funcionalidad | Estado |
|---------------|--------|
| Registro con correo único | ✅ |
| Login con correo **o** username | ✅ |
| JWT access + refresh (rotación en Mongo) | ✅ |
| Verificación de correo (SMTP) | ✅ |
| Bloqueo de **join** sin correo verificado (cuentas registradas) | ✅ |
| Invitados sin verificación | ✅ |
| Olvidé contraseña (código por correo) | ✅ |
| Eliminar cuenta (código + contraseña, borra avatar R2) | ✅ |
| Vincular partida invitado → cuenta | ✅ |
| Device label en sesiones (`auth_sessions.deviceId`) | ✅ |

Correos: plantillas HTML estilo terminal; enlaces usan `APP_PUBLIC_URL` (ngrok / Cloudflare Tunnel, no `localhost` en móvil).

---

## Terminal móvil

| Funcionalidad | Estado |
|---------------|--------|
| Unirse por QR / código FIRE-XXXX | ✅ |
| Cuenta, perfil, avatar, historial | ✅ |
| URL backend configurable (LAN / ngrok) | ✅ |
| Panel verificación / eliminar cuenta | ✅ |
| Reconexión a partida en curso | ✅ |

---

## Dashboard web

| Funcionalidad | Estado |
|---------------|--------|
| Crear sala, QR, lobby | ✅ |
| Topología, SIEM, fases | ✅ |
| Bots QA (dev) | ✅ |

---

## Infraestructura

| Componente | Uso actual |
|------------|------------|
| **MongoDB Atlas** | Usuarios, sesiones, participaciones, partidas |
| **Cloudflare R2** | Avatares (`AVATAR_STORAGE=r2` en `media`) |
| **SMTP** (Gmail, etc.) | Verificación, reset, eliminar cuenta |
| **ngrok / Cloudflare Tunnel** | Acceso móvil remoto al gateway :3000 |

---

## Legacy

| Componente | Notas |
|------------|-------|
| `backend-server/` | Monolito original; lógica migrada a `game-realtime` + `identity` + `media` |
| `services/` (si existe) | Carpeta antigua de experimentos; usar `backend-container/` |
| MinIO en monolito | Sustituido por R2 vía servicio `media` en el stack nuevo |

---

## Pendiente / evolución

Ver [ROADMAP_BACKEND.md](./ROADMAP_BACKEND.md): Redis pub/sub entre réplicas de `game-realtime`, CDN delante de avatares, observabilidad, CI por servicio.
