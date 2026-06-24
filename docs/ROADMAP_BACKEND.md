# Roadmap — Backend

Para analizar en equipo. **Monolito actual** + evolución.

---

## Qué cumple hoy

| Módulo | Estado |
|--------|--------|
| Socket `/game` + `/dashboard` | ✅ |
| RoomManager, StateMachine, RuleEngine, VictoryChecker | ✅ |
| ChatManager, minijuegos, bots QA | ✅ |
| MongoDBAdapter + JsonAdapter | ✅ |
| Auth JWT + refresh + `game_participations` | ✅ |
| Avatares disk / MinIO | ✅ |
| Docker Compose (Mongo, MinIO, backend) | ✅ |
| REST: health, games, replay, auth | ✅ |

---

## Qué NO es (aclaración)

- **No** hay procesos separados por dominio (microservicios).
- **No** hay Redis para salas multi-instancia.
- **No** hay JWT obligatorio en sockets de juego (guest sigue válido).

---

## Ideas priorizadas

### P0 — Soporte a producto

| Idea | Descripción | Esfuerzo |
|------|-------------|----------|
| **Modo espectador dashboard** | `joinDashboard({ spectator: true })` sin permisos host | Medio |
| **API sala pública** | `GET /api/games/:id/public` — fase, conteos, sin roles | Bajo |
| **Setting `casualMode`** | Host activa “mostrar pool de roles” en móvil | Medio |
| **Sliding refresh** | Documentado; ya rota refresh en cada uso | Hecho |
| **Graceful degrade** | Si Mongo cae, opción `FP_USE_JSON=1` sin matar servidor | Medio |

### P1 — Escala y calidad

| Idea | Descripción |
|------|-------------|
| **Redis + sticky sessions** | Varias instancias del mismo backend (Fase 1 MICROSERVICES) |
| **JWT en socket** | Opcional para cuentas; guest sin token |
| **Rate limiting** | Auth, uploads, joinRoom por IP |
| **Webhooks / eventos** | `game.finished` para Discord bot |
| **Admin API** | Ban usuario, listar salas activas |

### P2 — Microservicios (solo si escala lo exige)

Ver [MICROSERVICES.md](../MICROSERVICES.md):

1. Mongo + monolito (hecho)
2. MinIO en monolito (hecho)
3. Redis horizontal
4. Extraer **Auth Service**
5. Media/CDN dedicado

**No extraer** solo por “tener microservicios” en la defensa — extraer cuando un dominio necesite despliegue independiente.

### P3 — Mejoras a futuro (discutir en equipo)

| Idea | Descripción | Esfuerzo |
|------|-------------|----------|
| **Matchmaking automático** | Cola “buscar partida” con N jugadores y crear sala cuando se llena. | Alto |
| **Salas privadas con PIN** | Código FIRE-XXXX + PIN de 4 dígitos para espectadores o join. | Bajo |
| **Host transfer** | Si el dashboard se cae, transferir control a otro socket dashboard. | Medio |
| **Pausa de partida** | Host congela timers (evento presencial, discusión larga). | Medio |
| **Modo torneo** | Varias salas, bracket, puntos — colección `tournaments`. | Alto |
| **ELO / ranking** | Puntuación post-partida según bando y placement; tabla `leaderboard`. | Alto |
| **Roles rotativos ban** | En ranked, no repetir mismo rol en X partidas del usuario. | Medio |
| **Catálogo ampliado** | Más de 16 roles GDD; feature flag por sala. | Alto (balance) |
| **Modo “solo texto”** | Desactivar minijuegos skill-check; solo decisión. | Bajo |
| **Modo blitz** | Fases 20 s fijas; flag en `RoomOptions`. | Bajo |
| **Espectador retrasado** | Buffer 60 s de eventos para stream sin spoil en vivo. | Alto |
| **Export PDF session log** | Además de `.log` y JSON, informe legible para profesor. | Medio |
| **Webhooks** | `POST` a URL del cliente en `gameOver`, `phaseChanged`. | Medio |
| **Discord bot** | `/crear-sala`, anuncio de fase en canal de voz texto. | Medio |
| **Moderación chat** | Palabras bloqueadas, mute por host, reporte. | Medio |
| **Anti-AFK** | Kick automático en LOBBY tras 5 min sin heartbeat. | Bajo |
| **Límite de reconexiones** | Evitar abuse de reconnect en partida competitiva. | Bajo |
| **Sala archivada en caliente** | Snapshot cada fase a S3 además de Mongo. | Medio |

---

## Auth y cuentas (futuro)

| Idea | Descripción |
|------|-------------|
| **OAuth Google / GitHub** | Login social; vincular a `authProvider`. |
| **Verificación de email** | Token en correo al registrarse. |
| **Reset password** | Flujo estándar con token temporal. |
| **2FA opcional** | TOTP para cuentas admin — overkill en grado. |
| **Roles de sistema** | `admin`, `moderator` en colección `users` para panel web. |
| **GDPR / export** | `GET /api/auth/export` — datos del usuario en JSON. |
| **Borrado de cuenta** | Soft-delete + anonimizar participations. |
| **Sesiones activas** | Listar dispositivos y revocar refresh tokens. |
| **Invitaciones** | Código de referido para estadísticas de adopción. |

---

## Datos y operaciones (ampliado)

| Idea | Descripción |
|------|-------------|
| **GridFS avatares** | Alternativa a MinIO todo-en-Mongo |
| **Índices TTL** | Limpiar `auth_sessions` expiradas automáticamente |
| **Analytics collection** | Partidas/día, roles más usados, duración media |
| **Backup script** | `npm run db:backup` → mongodump + MinIO mirror |
| **Migraciones versionadas** | `db:migrate:v2` con changelog de esquema |
| **Réplicas Mongo** | Secondary read para `/api/roles` y leaderboards |
| **Partidas programadas** | `scheduledStartAt` en lobby — auto-start |
| **Retención configurable** | Borrar `finishgame` > 90 días salvo flag “guardar” |
| **Agregados materializados** | `user_stats` denormalizado para perfil rápido |
| **Auditoría admin** | Colección `audit_log` para acciones de host |

---

## Gameplay backend (ampliado)

| Idea | Descripción |
|------|-------------|
| **Roles custom por sala** | Subset del catálogo GDD |
| **Timers por host** | Override `NIGHT_DURATION_MS` por socket |
| **Replay server-side** | Stream de eventos para espectador retrasado |
| **Votos secretos vs públicos** | Flag de sala para ocultar trazas en dashboard |
| **Empate configurable** | Mayoría absoluta vs simple vs revote |
| **Jugador fantasma** | Slot reservado con timeout si no conecta en LOBBY |
| **Balance dinámico** | Ajustar hackers/caóticos según skill rating futuro |
| **Eventos aleatorios** | “Auditoría sorpresa”: fase DÍA extra corta |
| **Roles de evento** | Rol temporal por una noche (modo fiesta) |
| **API de reglas** | Exponer `VictoryChecker` outcomes para herramienta externa |

---

## Infraestructura y DevOps (discutir)

| Tema | Propuesta |
|------|-----------|
| **CI/CD** | GitHub Actions: test + build + docker push en tag |
| **Entornos** | `dev` / `staging` / `prod` con `.env` separados |
| **Health profundo** | `/health` incluye Mongo, MinIO, memoria, salas activas |
| **Métricas Prometheus** | Contadores: joins, partidas FIN, errores socket |
| **Logs centralizados** | Loki / CloudWatch; correlación por `roomId` |
| **Tracing OpenTelemetry** | Latencia de `resolveNight` por partida |
| **Kubernetes** | Solo si escala real; Compose basta para grado |
| **CDN estático** | Frontends en Vercel/Netlify; API en VPS |
| **WAF / DDoS** | Cloudflare delante si hay dominio público |
| **Secrets manager** | No commitear JWT; Vault o env del host |
| **Blue-green deploy** | Cero downtime con sticky + Redis (fase 2) |

---

## Calidad y testing (futuro)

| Idea | Descripción |
|------|-------------|
| **Tests integración socket** | Cliente fake que simula partida 5 jugadores |
| **Property-based tests** | VictoryChecker con miles de estados aleatorios |
| **Load test** | k6: 50 salas × 10 jugadores simultáneos |
| **Contrato OpenAPI** | Documentar REST auth + games |
| **Socket contract tests** | Validar payloads contra JSON Schema en CI |
| **Chaos engineering** | Matar Mongo mid-partida; ver degradación |
| **Bot coverage** | Cada rol con al menos 1 acción nocturna en QA |

---

## Seguridad producción (ampliado)

- Rotar `JWT_SECRET`, MinIO keys
- `DEV_BOTS=false`
- CORS / origen en dashboard si hay dominio público
- HTTPS terminación (nginx) delante de Node
- **Helmet** + headers de seguridad en Express
- **Sanitizar chat** (XSS en mensajes reflejados en TV)
- **Límite tamaño payload** socket anti-abuse
- **Validar `roomId`** en todos los handlers (ya parcial)
- **Pen test básico** antes de exposición pública
- **Rotación refresh** en robo de token (ya rota en refresh)

---

## Preguntas abiertas para la reunión de equipo

1. ¿Implementamos **espectador** antes que **OAuth**?
2. ¿Mongo es obligatorio en producción o mantenemos fallback JSON?
3. ¿Los bots deben poder llenar **cualquier** mesa de prueba o solo QA interno?
4. ¿Necesitamos **ranking/ELO** para la defensa o distrae del core social?
5. ¿Quién opera backups: script manual o cron en Docker?
6. ¿Un solo servidor VPS basta para demo facultad (~30 usuarios concurrentes)?
7. ¿Extraemos **Auth** a microservicio en el documento de grado o solo roadmap?

---

## Largo plazo (visión 6–12 meses)

- **Multi-región** con salas por ping (latam / eu) — solo si hay usuarios reales.
- **Motor de reglas plugin** — roles nuevos sin redeploy (JSON + sandbox).
- **Licencia API** para terceros (otra facultad hospeda su instancia).
- **Compliance FERPA/GDPR** si hay datos de menores en campus.
- **IA narrativa** — resúmenes SIEM generados por LLM post-partida (cosmético).

---

## Referencias

- `backend-server/src/`
- [DATABASE.md](../DATABASE.md)
- [STORAGE_AND_AVATARS.md](../STORAGE_AND_AVATARS.md)
- [SOCKET_CONTRACT.md](../SOCKET_CONTRACT.md)
