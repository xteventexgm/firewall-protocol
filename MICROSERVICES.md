# Arquitectura y microservicios — Firewall Protocol

Recomendación técnica para evolucionar el backend (`backend-server/`) hacia escalabilidad y, opcionalmente, microservicios.

**Relacionado:** [`README.md`](README.md) · [`DATABASE.md`](DATABASE.md) · [`backend-server/README.md`](backend-server/README.md)

**Última revisión:** junio 2026 — alineado con el código y `DATABASE.md`.

---

## 1. Veredicto actual

El backend **no tiene soporte para microservicios**. Es un **monolito en un solo proceso Node.js**:

| Aspecto | Estado |
|---------|--------|
| Despliegue | Un servicio (`docker-compose.yml` → `backend` en puerto 3000) |
| Estado de partida | `RoomManager` singleton con `Map` en memoria |
| Comunicación | Socket.io directo (`/game`, `/dashboard`) + REST mínimo |
| Dependencias | `express`, `socket.io`, `body-parser` — sin colas, Redis ni gRPC |
| Carpeta `services/` | Módulos internos (`dbSyncService`, `GameSessionLogService`), no servicios desplegables |

`DATABASE.md` tampoco define microservicios: describe **persistencia centralizada** en MongoDB (`firewall_protocol`) vía el patrón `DBAdapter`, sin cambiar `Room.ts` ni los handlers socket. Es un monolito con capa de persistencia desacoplada.

---

## 2. Recomendación principal

> **Para el proyecto de grado y el uso previsto (LAN, 5–15 jugadores por sala): no implementar microservicios de entrada.**

El cuello de botella no es la base de datos, sino el **estado en memoria + Socket.io**. La ruta más sensata es evolucionar en fases:

```
Monolito actual
    → MongoDB (DATABASE.md)
    → Redis pub/sub + multi-instancia (roadmap backend)
    → (opcional) 2–3 servicios de dominio
    → microservicios completos solo si la escala lo exige
```

---

## 3. Fases de evolución

### Fase 0 — Mantener monolito (recomendado ahora)

**Objetivo:** jugar, defender el proyecto y reducir deuda técnica sin complejidad operativa.

- [ ] Implementar `MongoDBAdapter` según [`DATABASE.md`](DATABASE.md)
- [ ] Mantener JSON como fallback si `MONGO_URI` no está definido
- [ ] Completar JWT en sockets (`auth/jwt.pending.ts`) dentro del monolito
- [ ] Ampliar tests (`RuleEngine`, `VictoryChecker`, `Matchmaking`)

**Beneficio:** persistencia robusta, reconexión tras reinicio, sin infraestructura extra.

---

### Fase 1 — Escalado horizontal del monolito

**Objetivo:** varias instancias del mismo backend sin dividir dominios.

- [ ] Añadir **Redis** y `@socket.io/redis-adapter` para broadcast entre nodos
- [ ] **Sticky sessions** por `roomId` en el balanceador (nginx, Traefik, etc.)
- [ ] Una instancia “dueña” de cada sala activa

```
                    ┌─────────────────┐
  Clientes ────────►│ Load Balancer   │ (sticky por roomId)
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        backend-1      backend-2      backend-3
              └──────────────┼──────────────┘
                             ▼
                    Redis (pub/sub Socket.io)
                             ▼
                         MongoDB
```

**Beneficio:** más salas simultáneas sin reescribir `Room`, `RuleEngine` ni `ChatManager`.

---

### Fase 2 — Separación por dominio (microservicios ligeros)

**Objetivo:** desacoplar lo que no está en el camino crítico realtime.

Solo dividir por **dominio de negocio**, no por clase TypeScript:

| Servicio | Responsabilidad | Colecciones / datos |
|----------|-----------------|---------------------|
| **Game Realtime** | Salas, fases, reglas, votos, chat, sockets | `games` (activas) |
| **Auth** | Usuarios, JWT, refresh tokens | `users`, `auth_sessions` |
| **Catalog** | Catálogo de roles, textos, hints | `roles` |
| **Analytics / Replay** | Logs, export, estadísticas, MVP | `session_logs`, `game_participations` |

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ API Gateway │────►│ Game Realtime    │────►│ Redis + sticky  │
│ (HTTP/WS)   │     │ Service          │     │ sessions        │
└─────────────┘     └──────────────────┘     └─────────────────┘
       │                     │
       ├──────────┬──────────┴──────────┐
       ▼          ▼                     ▼
  Auth Svc   Catalog Svc          Analytics Svc
       │          │                     │
       └──────────┴─────────────────────┘
                    ▼
              MongoDB (inicio: una BD, colecciones por dominio)
```

**No separar** en servicios distintos: `RuleEngine`, `VictoryChecker`, `ActionValidator`, `ChatManager`. Comparten el mismo estado de sala; dividirlos añade latencia y consistencia distribuida sin beneficio claro.

---

### Fase 3 — Microservicios completos (solo si hace falta)

Considerar solo con:

- Cientos de salas simultáneas
- Equipo de varios desarrolladores con ownership por dominio
- Necesidad de desplegar auth o analytics sin tocar el motor de juego
- Infraestructura madura (K8s, observabilidad, CI por servicio)

Cada servicio con **su propia base de datos** (o al menos esquema aislado):

| BD | Servicio |
|----|----------|
| `auth_db` | Auth |
| `game_db` | Game Realtime |
| `analytics_db` | Replay, participaciones |

Comunicación:

| Caso | Patrón |
|------|--------|
| Validar JWT antes de `joinRoom` | HTTP/gRPC síncrono en gateway |
| Partida termina → guardar stats | Cola asíncrona (Redis Streams, RabbitMQ) |
| Catálogo de roles | HTTP + caché en memoria |

---

## 4. Estado de partida: decisiones críticas

Hoy el estado vive en `RoomManager` (memoria). Al escalar:

| Opción | Descripción | Cuándo usarla |
|--------|-------------|---------------|
| **A — Sticky + memoria** | Una instancia dueña por sala; Redis solo para sockets | **Recomendada** para 5–15 jugadores/sala |
| **B — Estado en Redis/Mongo** | Cada acción lee/escribe estado compartido con locks | Solo si necesitas mover salas entre nodos en caliente |

Para Firewall Protocol, la **opción A** suele ser suficiente.

### Socket.io multi-nodo (concepto)

```typescript
import { createAdapter } from '@socket.io/redis-adapter';

// Tras crear el servidor Socket.io:
io.adapter(createAdapter(pubClient, subClient));
```

Sin adaptador Redis, un jugador en el nodo A no recibe eventos emitidos desde el nodo B.

---

## 5. Orden de migración desde el código actual

Menor riesgo → mayor complejidad:

1. **MongoDB** vía `DBAdapter` ([`DATABASE.md` §8](DATABASE.md))
2. **Redis adapter** para Socket.io multi-instancia
3. **Extraer Auth** cuando se active `jwt.pending.ts`
4. **Extraer Catalog** (`roles`) — el Game Service puede seguir leyendo `roles.types.ts` como fallback
5. **Extraer Analytics** — endpoints REST actuales en `app.ts`:
   - `GET /api/games`
   - `GET /api/games/:roomId/replay`
   - `GET /api/games/:roomId/session-log`
6. **Evaluar** si algo más merece servicio propio (probablemente no)

---

## 6. Errores comunes a evitar

| Error | Por qué duele aquí |
|-------|-------------------|
| Microservicio por cada módulo (`RuleEngine`, `ChatManager`…) | Chat y votos comparten estado de sala |
| Microservicios antes de MongoDB y tests | Complejidad operativa sin beneficio |
| BD compartida con escrituras cruzadas entre servicios | Acoplamiento; se pierden ventajas de microservicios |
| Llamadas síncronas entre servicios en acciones nocturnas | Latencia en el camino crítico |
| Ignorar sticky sessions con Socket.io | Jugadores desincronizados entre nodos |
| Dividir el monolito “por capas” (servicio de BD, servicio de reglas…) | No coincide con los límites del dominio del juego |

---

## 7. Cuándo sí y cuándo no

### Sí tiene sentido microservicios si…

- Hay muchas salas concurrentes y un solo proceso no alcanza
- Varios equipos despliegan en ciclos independientes
- Auth, replay o catálogo deben escalar o actualizarse sin tocar partidas en curso
- Existe presupuesto para gateway, colas, monitoreo y CI por servicio

### No tiene sentido (aún) si…

- El objetivo es terminar el proyecto de grado con partidas LAN
- El equipo es pequeño (1–3 personas)
- No hay problema de rendimiento ni de despliegue
- MongoDB y tests del monolito siguen pendientes

---

## 8. Stack sugerido por fase

| Fase | Componentes |
|------|-------------|
| 0 | Node monolito, MongoDB, JSON fallback |
| 1 | + Redis, `@socket.io/redis-adapter`, nginx/Traefik sticky |
| 2 | + API Gateway, Auth (Express/Fastify), servicios HTTP internos |
| 3 | + RabbitMQ o Redis Streams, K8s, BD por servicio, OpenTelemetry |

---

## 9. Checklist rápido

### Ahora (proyecto de grado)

- [ ] Leer e implementar [`DATABASE.md`](DATABASE.md)
- [ ] Documentar en memoria que la arquitectura es monolito modular
- [ ] No añadir microservicios “por requisito académico” sin necesidad real

### Si el profesor pide “arquitectura distribuida”

- [ ] Presentar **Fase 1** (monolito + MongoDB + Redis multi-instancia) como diseño defendible
- [ ] Incluir diagrama de **Fase 2** como evolución futura (este documento)
- [ ] Explicar por qué el motor de juego permanece unificado (latencia, consistencia)

### Si se implementa Fase 2

- [ ] API Gateway con proxy WebSocket y sticky por `roomId`
- [ ] Auth Service con `users` + `auth_sessions`
- [ ] Game Service conserva `Room`, sockets y motor de reglas
- [ ] Analytics Service absorbe replay y `session_logs`
- [ ] Contrato socket sin cambios ([`SOCKET_CONTRACT.md`](SOCKET_CONTRACT.md))

---

## 10. Referencias en el repositorio

| Archivo | Contenido |
|---------|-----------|
| `backend-server/src/server.ts` | Punto de entrada monolítico |
| `backend-server/src/game/RoomManager.ts` | Estado en memoria |
| `backend-server/src/config/database.ts` | `DBAdapter` (JSON → MongoDB) |
| `backend-server/docker-compose.yml` | Un solo servicio `backend` |
| `DATABASE.md` | Esquema MongoDB, no microservicios |
| `backend-server/README.md` | Roadmap Redis multi-instancia |

---

## Resumen en una frase

**Implementa MongoDB y escalado horizontal del monolito primero; divide en microservicios solo por dominio (Auth, Catalog, Analytics) y deja el motor realtime unificado en un Game Service.**
