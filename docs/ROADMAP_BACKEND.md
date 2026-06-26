# Roadmap backend — Firewall Protocol

Estado respecto al stack **`backend-container/`** (microservicios Docker).

---

## ✅ Completado (jun 2026)

### Infraestructura

- [x] `docker-compose.yml` en raíz con 4 servicios + red interna
- [x] Gateway único en puerto **3000** (HTTP + WebSocket)
- [x] Variables centralizadas en `backend-container/.env`
- [x] Health checks por servicio (`/health`)

### identity

- [x] Migración de auth desde monolito
- [x] JWT + refresh sessions en MongoDB
- [x] Perfil, historial (`game_participations`), link guest
- [x] SMTP: verificación, reset password, eliminar cuenta
- [x] Verificación de correo obligatoria para join (no para login)
- [x] Eliminación de cuenta (tokens + borrado en cascada)
- [x] Cliente HTTP a `media` para borrar avatar en R2

### media

- [x] Upload / serve / delete avatares
- [x] Cloudflare R2 / S3 / disco (`AVATAR_STORAGE`)
- [x] Rutas legacy `/api/auth/avatars/*` vía gateway
- [x] Endpoint interno `DELETE /api/media/internal/avatars/:userId`
- [x] Sincronización `avatarUrl` con identity vía HTTP interno

### game-realtime

- [x] Migración del motor de juego y Socket.IO
- [x] Validación JWT en `joinRoom`
- [x] Comprobación `emailVerified` al unirse con cuenta
- [x] REST: status sala, replay, roles, etc.

### gateway

- [x] Proxy a identity, media, game-realtime
- [x] WebSocket proxy para `/game` y `/dashboard`
- [x] CORS y headers de túnel (ngrok)

---

## 🔄 En curso / mantenimiento

- [ ] Documentación alineada con producción (este archivo + README)
- [ ] Pruebas E2E automatizadas del stack Docker
- [ ] Rotación segura de secretos (`JWT_SECRET`, `INTERNAL_SERVICE_KEY`)

---

## 📋 Backlog (fases futuras)

### Escalabilidad

- [ ] **Redis** — pub/sub entre instancias de `game-realtime` (salas multi-nodo)
- [ ] Réplicas de `game-realtime` detrás del gateway con sticky sessions
- [ ] Rate limiting en gateway

### Media y CDN

- [ ] CDN delante de R2 para `GET /api/auth/avatars/:id`
- [ ] Límites de cuota y antivirus en upload
- [ ] Thumbnails automáticos

### Identity

- [ ] OAuth (Google) si se requiere
- [ ] Rate limit en envío de correos
- [ ] Auditoría de eliminación de cuenta (log retention)

### Observabilidad

- [ ] Logs centralizados (JSON estructurado)
- [ ] Métricas Prometheus por servicio
- [ ] Trazas entre gateway → servicios internos

### DevOps

- [ ] CI: build + test por carpeta (`identity`, `media`, …)
- [ ] Imágenes versionadas en registry
- [ ] Compose override para desarrollo local sin Atlas

---

## ❌ Fuera de alcance inmediato

- Reescribir clientes (móvil/dashboard ya consumen gateway)
- Separar MongoDB por servicio (comparten Atlas por simplicidad académica)
- Kubernetes (Docker Compose es suficiente para el proyecto de grado)

---

## Referencia histórica

El monolito [`backend-server/`](../backend-server/) fue la fuente de verdad hasta la migración a `backend-container/`. No añadir funcionalidad nueva allí salvo hotfixes temporales.
