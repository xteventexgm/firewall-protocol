# Documentación — Firewall Protocol

**Punto de entrada único** para el equipo. Los `.md` técnicos de la raíz siguen existiendo como referencia; aquí está el mapa y lo esencial en lenguaje claro.

**Última revisión:** junio 2026

---

## Empieza aquí

| Documento | Para qué |
|-----------|----------|
| [**PROJECT_STATUS.md**](PROJECT_STATUS.md) | Qué cumple el proyecto hoy (backend, móvil, web, BD, microservicios) |
| [**ROADMAP_WEB_DASHBOARD.md**](ROADMAP_WEB_DASHBOARD.md) | Web/TV: estado + ideas (espectador, valor indispensable) |
| [**ROADMAP_MOBILE.md**](ROADMAP_MOBILE.md) | Móvil: estado + ideas (roles en partida, UX) |
| [**ROADMAP_BACKEND.md**](ROADMAP_BACKEND.md) | Backend: estado + ideas (escala, APIs) |
| [**CHANGELOG.md**](../CHANGELOG.md) | Cambios recientes por fecha |

---

## Referencia técnica (raíz del repo)

| Archivo | Contenido | ¿Borrar? |
|---------|-----------|----------|
| [README.md](../README.md) | Visión general, inicio rápido | **No** — portada del repo |
| [ROLES.md](../ROLES.md) | Catálogo de **44 roles** GDD | **No** — diseño de juego |
| [WIN_CONDITIONS.md](../WIN_CONDITIONS.md) | Victorias y evaluación | **No** — reglas |
| [SOCKET_CONTRACT.md](../SOCKET_CONTRACT.md) | Eventos Socket.io | **No** — integración |
| [DATABASE.md](../DATABASE.md) | MongoDB, auth, colecciones | **No** — persistencia |
| [MICROSERVICES.md](../MICROSERVICES.md) | Monolito → Redis → servicios | **No** — arquitectura futura |
| [STORAGE_AND_AVATARS.md](../STORAGE_AND_AVATARS.md) | MinIO, GridFS, avatares | **No** — blobs |
| [TESTING.md](../TESTING.md) | QA manual y bots | **No** — pruebas |
| [SOUND_AI_PROMPTS.md](../SOUND_AI_PROMPTS.md) | Prompts IA para SFX | **Opcional** — solo audio/assets |
| [CHANGELOG.md](../CHANGELOG.md) | Historial | **No** |

**No se eliminaron archivos:** se organizaron. `SOUND_AI_PROMPTS.md` es el único puramente auxiliar (generación de sonidos); el resto lo usa desarrollo activo.

### README por app

- [backend-server/README.md](../backend-server/README.md)
- [mobile-terminal/README.md](../mobile-terminal/README.md)
- [web-dashboard/README.md](../web-dashboard/README.md)

---

## Cambios recientes (resumen junio 2026)

- **MongoDB** + auth JWT + historial `game_participations`
- **Avatares** MinIO o disco; Docker Compose (Mongo + MinIO)
- **Móvil:** perfil, victorias caóticas, historial 10 partidas, sesión persistente (refresh 90 días), rol/habilidad en partida
- **Web:** duración total de partida en HUD; topología lobby
- **Game over:** textos narrativos sin códigos técnicos (`chaotic_stalemate_break`, etc.)
- Detalle completo → [CHANGELOG.md](../CHANGELOG.md) § 2026-06-23

---

## Respuesta rápida: ¿tenemos “todo”?

| Pieza | ¿Existe? | Nota |
|-------|----------|------|
| Backend | ✅ Sí | Monolito Node + Socket.io |
| App móvil | ✅ Sí | Ionic / Capacitor |
| App web (host/TV) | ✅ Sí | Angular + topología |
| Base de datos | ✅ Sí | MongoDB (+ JSON fallback) |
| **Microservicios** | ❌ **No desplegados** | Diseño documentado; hoy es **monolito** + MinIO/Mongo como infra |

Ver detalle en [PROJECT_STATUS.md](PROJECT_STATUS.md).
