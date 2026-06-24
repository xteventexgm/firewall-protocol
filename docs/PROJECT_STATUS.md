# Estado del proyecto — qué cumple Firewall Protocol

Documento para el equipo y evaluación académica. **Última revisión:** junio 2026.

---

## Respuesta directa

> ¿Ya tenemos backend, app móvil, app web, base de datos y microservicios?

| Componente | Estado | Comentario |
|------------|--------|------------|
| **Backend** | ✅ Implementado | `backend-server/` — Express, Socket.io, motor de juego |
| **Aplicación móvil** | ✅ Implementado | `mobile-terminal/` — Ionic, jugador |
| **Aplicación web** | ✅ Implementado | `web-dashboard/` — host / TV |
| **Base de datos** | ✅ Implementado | MongoDB (`users`, `games`, `roles`, …) + fallback JSON |
| **Microservicios** | ⚠️ **No** (aún) | Arquitectura **monolítica**; MinIO y Mongo son **infra**, no microservicios de aplicación |

**Conclusión:** el producto jugable está completo en **tres clientes + un servidor + persistencia**. Los microservicios están **planificados** ([MICROSERVICES.md](../MICROSERVICES.md)), no operativos.

---

## Arquitectura actual (real)

```
                    ┌─────────────────────────────────┐
                    │     backend-server (monolito)    │
                    │  HTTP + /game + /dashboard       │
                    │  RoomManager · RuleEngine · Auth │
                    └───────────┬─────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
  mobile-terminal         web-dashboard          MongoDB
  (jugador)               (host/TV)              MinIO (avatares)
```

---

## Backend — qué cumple

| Área | Implementado |
|------|----------------|
| Salas y fases | LOBBY → REPARTO → NOCHE/DÍA/VOTACIÓN/VERIFICACIÓN → FIN |
| 16+ roles, RuleEngine, victoria | Sí |
| Chat multicanal, votación, minijuegos | Sí |
| Bots QA, partida automática | Sí (`DEV_BOTS`, `runBotQaMatch`) |
| Persistencia partidas | MongoDB o `data/games/*.json` |
| Auth usuarios | JWT + refresh, registro/login, perfil |
| Avatares | Disco o **MinIO** (`AVATAR_STORAGE`) |
| Historial por usuario | `game_participations` al archivar |
| Replay / session log | REST `replay`, `.log` en finishgame |
| Docker | `docker-compose` Mongo + MinIO + backend |

**No cumple aún:** microservicios separados, Redis multi-instancia, JWT obligatorio en sockets.

---

## Mobile terminal — qué cumple

| Área | Implementado |
|------|----------------|
| Login invitado + cuenta (correo) | Sí |
| QR / código sala, reconexión | Sí |
| Rol secreto, acciones nocturnas, votos, chat | Sí |
| Briefing rol + amenaza por equipo | Sí |
| Panel cuenta: stats, avatar, historial | Sí |
| Sesión larga (refresh 90 d, proactivo al abrir app) | Sí |
| Ver rol/habilidad durante partida | Sí |
| Game over con narrativa (sin IDs técnicos) | Sí (jun 2026) |

---

## Web dashboard — qué cumple

| Área | Implementado |
|------|----------------|
| Crear sala, QR, código FIRE-XXXX | Sí |
| Topología 2D/3D lobby, host controls | Sí |
| SIEM / logs públicos, votos animados | Sí |
| Overlays reparto roles + amenaza | Sí |
| Bots, partida QA automática | Sí |
| Duración total partida (timer gris) | Sí |
| Export replay | Sí |

**Limitación:** hoy es sobre todo **pantalla de host**; poco valor para quien no crea la sala.

---

## Base de datos — qué cumple

| Colección / dato | Uso |
|------------------|-----|
| `games` | Partidas activas/archivadas |
| `users`, `auth_sessions` | Cuentas y refresh tokens |
| `game_participations` | Historial por jugador |
| `roles` | Catálogo (seed) |
| MinIO `avatars` | Binarios de foto de perfil |

Scripts: `npm run db:setup`, `db:migrate`, `db:seed`.

---

## Microservicios — qué significa “no”

MinIO y MongoDB **no son** microservicios del juego: son almacenamiento. Un microservicio sería, por ejemplo:

- **Auth Service** — solo `/api/auth/*`
- **Game Realtime Service** — solo salas y sockets
- **Media Service** — solo uploads/CDN

Hoy todo vive en **un proceso** `backend-server`. Ver fases en [MICROSERVICES.md](../MICROSERVICES.md).

---

## Para demo / defensa de grado

**Puedes afirmar:**

- Sistema multicliente en tiempo real (móvil + web + servidor).
- Persistencia en BD documentada con migración desde JSON.
- Autenticación, perfiles e historial de partidas.
- Almacenamiento de assets (MinIO) preparado para escala.
- Roadmap de microservicios justificado, no confundido con lo desplegado.

**No afirmar sin matiz:** “está en microservicios” — diría “monolito con persistencia externa y roadmap de división por dominio”.
