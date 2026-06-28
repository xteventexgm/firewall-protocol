<p align="center">
  <img src="web-dashboard/public/icon.png" alt="Firewall Protocol" width="96" height="96" />
</p>

<h1 align="center">Firewall Protocol</h1>

<p align="center">
  <strong>Thriller de deducción social multijugador</strong> con temática de ciberseguridad.<br/>
  5–16 jugadores · 44 roles · noche/día · votaciones · victoria en tiempo real.
</p>

<p align="center">
  <a href="#qué-es-el-juego">Qué es</a> ·
  <a href="#arquitectura">Arquitectura</a> ·
  <a href="#inicio-rápido">Inicio rápido</a> ·
  <a href="#documentación">Documentación</a> ·
  <a href="CHANGELOG.md">Cambios recientes</a>
</p>

---

## Qué es el juego

**Firewall Protocol** es un juego de mesa digital inspirado en *Mafia* / *Werewolf*, ambientado en un datacenter bajo ataque. Los jugadores son **nodos de una red**: defensores del Sistema, hackers Black Hat y agentes **caóticos** con victorias solitarias.

| Elemento | Descripción |
|----------|-------------|
| **Equipos** | **System** (defensa), **Black Hat** (ataque) y **Caótico** (agendas independientes) |
| **Ciclo** | **Noche** (acciones secretas en el móvil) → **Día** (debate e incidentes) → **Votación** (expulsión) → **Verificación** |
| **Roles** | **44 roles** en catálogo (16 System · 14 Black Hat · 14 Caótico) |
| **Host** | Pantalla grande (PC/TV): topología, votos, logs SIEM — **sin revelar roles vivos** |
| **Jugadores** | Teléfono como terminal: rol, acciones, chat, votos |
| **Cuentas** | Jugar como **invitado** o registrarse (correo); perfil con estadísticas, historial, avatar y **Logros**. |
| **Espectadores** | Modo espectador web en tiempo real introduciendo el código de sala en el dashboard. |

La partida termina cuando un bando gana o un rol **solitario** cumple su condición. Ver [`WIN_CONDITIONS.md`](WIN_CONDITIONS.md), [`ROLES.md`](ROLES.md) y [`ACHIEVEMENTS.md`](ACHIEVEMENTS.md).

---

## Arquitectura

Monorepo: **tres clientes** + **backend en microservicios Docker** (desde junio 2026).

```
┌─────────────────┐     Socket.io /game      ┌──────────────────────────┐
│  mobile-terminal │ ◄──────────────────────► │                          │
│  (Ionic/Angular) │                          │   gateway  :3000         │
└─────────────────┘                          │   (único puerto público) │
                                             └───────────┬──────────────┘
┌─────────────────┐   Socket.io /dashboard               │
│  web-dashboard  │ ◄────────────────────────────────────┤
│  (Angular)      │                                      │
└─────────────────┘                          ┌─────────┼─────────┬─────────────┐
                                             ▼         ▼         ▼             │
                                    identity:3002  media:3003  game-realtime  │
                                    /api/auth/*    avatares    :3001          │
                                                   R2/disco    sockets + REST │
                                             └─────────┬──────────────────────┘
                                                       ▼
                                             ┌─────────────────────────────┐
                                             │ MongoDB Atlas               │
                                             │ Cloudflare R2 (avatares)    │
                                             └─────────────────────────────┘
```

| Carpeta | Rol |
|---------|-----|
| [`backend-container/`](backend-container/) | **Stack activo:** gateway, identity, media, game-realtime |
| [`backend-server/`](backend-server/) | Monolito legacy (referencia / migración completada) |
| [`mobile-terminal/`](mobile-terminal/) | Terminal del jugador |
| [`web-dashboard/`](web-dashboard/) | Host / TV |

**Estado detallado:** [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)

**Contrato Socket.io:** [`SOCKET_CONTRACT.md`](SOCKET_CONTRACT.md)

---

## Inicio rápido

### Backend — Docker (recomendado)

Desde la **raíz del repositorio**:

```bash
cp backend-container/.env.example backend-container/.env
# Edita: MONGO_URI, JWT_SECRET, SMTP, APP_PUBLIC_URL (ngrok/Cloudflare), R2 si usas avatares en nube

docker compose up -d --build
```

| Servicio | Puerto público | Notas |
|----------|------------------|-------|
| **gateway** | **3000** | Único puerto expuesto al exterior |
| identity | 3002 (interno) | Auth, perfil, correos |
| media | 3003 (interno) | Avatares → R2 o disco |
| game-realtime | 3001 (interno) | Partidas, Socket.IO |

Comprobar:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/auth/status
```

Túnel para móvil (ngrok, Cloudflare Tunnel, etc.):

```bash
ngrok http 3000
```

En el móvil: misma URL en login (`environment.prod.ts` o selector en app) **y** en `APP_PUBLIC_URL` del `.env` (enlaces de verificación de correo).

### Dashboard (host)

```bash
cd web-dashboard
npm install
ng serve
```

`http://localhost:4200` → crear sala → QR / código `FIRE-XXXX`.

### Terminal móvil (jugadores)

```bash
cd mobile-terminal
npm install
ionic serve
```

Build nativo: Capacitor (`ionic cap`).

### Monolito legacy (solo desarrollo / referencia)

```bash
cd backend-server
docker compose up
# o: npm run dev
```

No usar en producción si ya tienes el stack `backend-container/` desplegado.

---

## Flujo típico de una partida

1. **Host** crea sala en web-dashboard (5–16 jugadores).
2. **Jugadores** escanean QR o ingresan `FIRE-XXXX` (invitado o con cuenta).
3. **Host** inicia → reparto de roles en TV; briefing en móvil.
4. **Noche / Día / Votación** hasta victoria.
5. **Fin:** overlay, replay, historial en cuenta si estabas logueado.

Bots QA: [`TESTING.md`](TESTING.md).

---

## Cuentas y auth (resumen)

| Función | Comportamiento |
|---------|----------------|
| Invitado | Jugar sin cuenta (alias libre) |
| Registro / login | Correo + usuario; sesión JWT + refresh (90 d) |
| Verificación de correo | Obligatoria para **unirse a salas** con cuenta; login permitido sin verificar |
| Recuperar contraseña | Código por correo |
| Eliminar cuenta | Código por correo + contraseña; borra perfil, historial, sesiones y avatar (R2) |

Detalle API: [`backend-container/identity/README.md`](backend-container/identity/README.md).

---

## Documentación

**Índice:** [`docs/README.md`](docs/README.md)

| Documento | Contenido |
|-----------|-----------|
| [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) | Qué cumple hoy (microservicios, clientes, BD) |
| [`docs/ROADMAP_BACKEND.md`](docs/ROADMAP_BACKEND.md) | Hecho vs. pendiente (Redis, CDN, etc.) |
| [`backend-container/README.md`](backend-container/README.md) | Mapa de servicios y puertos |
| [`ROLES.md`](ROLES.md) | 44 roles y habilidades |
| [`WIN_CONDITIONS.md`](WIN_CONDITIONS.md) | Condiciones de victoria |
| [`ACHIEVEMENTS.md`](ACHIEVEMENTS.md) | Sistema de Logros |
| [`SOCKET_CONTRACT.md`](SOCKET_CONTRACT.md) | Eventos Socket.io |
| [`DATABASE.md`](DATABASE.md) | MongoDB y colecciones |
| [`STORAGE_AND_AVATARS.md`](STORAGE_AND_AVATARS.md) | Avatares: R2, disco, servicio `media` |
| [`TESTING.md`](TESTING.md) | QA y bots |
| [`CHANGELOG.md`](CHANGELOG.md) | Historial de cambios |

README por servicio: [`gateway`](backend-container/gateway/README.md) · [`identity`](backend-container/identity/README.md) · [`media`](backend-container/media/README.md) · [`game-realtime`](backend-container/game-realtime/README.md)

---

## Stack tecnológico

| Capa | Tecnologías |
|------|-------------|
| Gateway | Express, http-proxy-middleware, WebSocket proxy |
| Identity | Express, JWT, nodemailer, MongoDB |
| Media | Express, multer, AWS SDK (S3/R2) |
| Game-realtime | Express, Socket.io, motor de reglas |
| Web dashboard | Angular 20, topología 2D/3D |
| Mobile terminal | Ionic, Angular, Capacitor |
| Datos | MongoDB Atlas; avatares en **Cloudflare R2** o disco |
| Despliegue | **Docker Compose** (4 contenedores + red interna) |

---

## Estado del proyecto

Proyecto de grado — **Programación Móvil**.

**Funcional hoy:** 44 roles, fases completas, minijuegos, chat, victoria, reconexión, MongoDB, cuentas con verificación de correo, avatares en R2, eliminación de cuenta, bots QA, replay.

**Arquitectura:** microservicios en contenedores (`backend-container/`) con gateway único en `:3000`. El monolito `backend-server/` queda como referencia histórica.

---

## Licencia y créditos

Proyecto académico — *Firewall Protocol Master Document (GDD)*.  
Desarrollo colaborativo: backend, dashboard web y terminal móvil.
