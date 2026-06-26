# Documentación — Firewall Protocol

Índice de documentación del equipo. Actualizado para el stack de **microservicios en Docker** (`backend-container/`).

---

## Estado y planificación

| Documento | Descripción |
|-----------|-------------|
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | Qué está implementado hoy (servicios, auth, clientes) |
| [ROADMAP_BACKEND.md](./ROADMAP_BACKEND.md) | Backend: completado vs. evolución futura |

Roadmaps de clientes (si existen en el repo): `ROADMAP_MOBILE.md`, `ROADMAP_WEB_DASHBOARD.md` en raíz o carpeta `docs/`.

---

## Arquitectura y contratos

| Documento | Descripción |
|-----------|-------------|
| [../backend-container/README.md](../backend-container/README.md) | Visión de microservicios, puertos, responsabilidades |
| [../SOCKET_CONTRACT.md](../SOCKET_CONTRACT.md) | Eventos Socket.io (`/game`, `/dashboard`) |
| [../DATABASE.md](../DATABASE.md) | MongoDB, colecciones, scripts |
| [../STORAGE_AND_AVATARS.md](../STORAGE_AND_AVATARS.md) | Avatares: servicio `media`, R2, disco |

---

## Por servicio (backend-container)

| Servicio | README |
|----------|--------|
| Gateway | [../backend-container/gateway/README.md](../backend-container/gateway/README.md) |
| Identity | [../backend-container/identity/README.md](../backend-container/identity/README.md) |
| Media | [../backend-container/media/README.md](../backend-container/media/README.md) |
| Game-realtime | [../backend-container/game-realtime/README.md](../backend-container/game-realtime/README.md) |

---

## Clientes

| App | README |
|-----|--------|
| Terminal móvil | [../mobile-terminal/README.md](../mobile-terminal/README.md) |
| Dashboard web | [../web-dashboard/README.md](../web-dashboard/README.md) |

---

## Juego y QA

| Documento | Descripción |
|-----------|-------------|
| [../ROLES.md](../ROLES.md) | Catálogo de 44 roles |
| [../WIN_CONDITIONS.md](../WIN_CONDITIONS.md) | Victorias por bando y solitarias |
| [../TESTING.md](../TESTING.md) | Pruebas manuales y bots |
| [../CHANGELOG.md](../CHANGELOG.md) | Historial de cambios |

---

## Arranque rápido (recordatorio)

```bash
# Raíz del repo
cp backend-container/.env.example backend-container/.env
docker compose up -d --build
```

API pública: `http://localhost:3000` (gateway).
