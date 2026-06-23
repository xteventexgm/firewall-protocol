# Base de datos — Firewall Protocol

Especificación para implementar **MongoDB** como backend de persistencia del juego.  
Sincronizado con el código en `backend-server/` (junio 2026).

**Preparado por:** Steven Zambrano  
**Script de creación:** `backend-server/scripts/setup-mongodb.ts`

**Alcance de este documento**

- Diseño de base de datos, colecciones, campos e índices.
- Migración desde JSON en disco (`data/games/`) vía `DBAdapter`.
- **Fuera de alcance por ahora:** login de usuario en móvil, JWT y cuentas (sección reservada al final).

**Principio operativo:** MongoDB **no es obligatorio** para jugar. Si `MONGO_URI` no está configurado, el servidor sigue usando JSON (`dbSyncService`). El juego actual funciona con `joinRoom(roomId, playerId, name)` sin cuenta.

---

## 1. Identificación de la base de datos

| Concepto | Valor |
|----------|-------|
| **Motor** | MongoDB 6+ |
| **Nombre de la BD** | `firewall_protocol` |
| **URI de ejemplo** | `mongodb://localhost:27017/firewall_protocol` |
| **Variable de entorno** | `MONGO_URI` (ver `backend-server/.env.example`) |
| **Adaptador** | `backend-server/src/config/database.ts` → `DBAdapter` |

En MongoDB las “tablas” son **colecciones**. Este documento usa ambos términos: *colección* = unidad en MongoDB; *tabla* = equivalente relacional.

---

## 2. Mapa de colecciones

| Colección | Propósito | Prioridad | Fuente en código |
|-----------|-----------|-----------|------------------|
| `games` | Estado de partida activa y archivada | **P0 — obligatoria** | `GameStateModel.toPlain()` |
| `roles` | Catálogo de 44 roles, textos y acciones | **P1 — recomendada** | `roles.types.ts`, `roleInfo.ts` |
| `session_logs` | Registro legible post-partida (.log) | **P2 — opcional** | `GameSessionLogService.ts` |
| `users` | Cuentas de jugador | **P3 — futuro** | `auth/jwt.pending.ts` |
| `auth_sessions` | Refresh tokens | **P3 — futuro** | `auth/jwt.pending.ts` |
| `game_participations` | Historial por jugador/cuenta | **P3 — futuro** | Derivado al archivar |

---

## 3. Enumeraciones compartidas

Definidas en `backend-server/src/types/`. Usar **strings** en MongoDB (mismo valor que el backend).

### 3.1 `GamePhase`

```
LOBBY | REPARTO | NOCHE | DIA | VOTACION | VERIFICACION | FIN
```

### 3.2 `Team`

```
system | black_hat | chaotic
```

### 3.3 `GameArchiveCategory`

```
active | finishgame | deletegame
```

Equivalente a carpetas actuales: `data/games/`, `data/finishgame/`, `data/deletegame/`.

### 3.4 `ChatChannel`

```
public | dead | hacker
```

### 3.5 `PublicLogSeverity`

```
info | warn | critical | success
```

### 3.6 Límites de sala

| Constante | Valor | Archivo |
|-----------|-------|---------|
| `MIN_PLAYERS` | 5 | `utils/constants.ts` |
| `MAX_PLAYERS` | 16 | `utils/constants.ts` |
| Formato `roomId` | `FIRE-XXXX` | `utils/socketErrors.ts` |

---

## 4. Colección `games`

Documento principal. **Un documento por sala** (`roomId` único). Reemplaza `<roomId>.json` en disco.

### 4.1 Campos raíz

| Campo | Tipo MongoDB | Requerido | Descripción |
|-------|--------------|-----------|-------------|
| `_id` | string | sí | Igual a `roomId` (ej. `FIRE-A1B2`) |
| `roomId` | string | sí | Código de sala |
| `phase` | string (`GamePhase`) | sí | Fase actual |
| `phaseStartedAt` | long / Date | sí | Timestamp inicio de fase |
| `gameStartedAt` | long / Date | no | Timestamp al pasar a REPARTO |
| `phaseEndsAt` | long / Date \| null | no | Fin de timer si `autoAdvance` |
| `maxPlayers` | int | sí | 5–16 |
| `initialPlayerCount` | int | no | Jugadores al `startGame` |
| `dayNumber` | int | sí | Contador de días |
| `nightNumber` | int | sí | Contador de noches |
| `players` | array | sí | Ver §4.2 |
| `actionQueue` | array | sí | Acciones nocturnas pendientes (§4.3) |
| `votes` | object | sí | `Record<voterId, targetId[]>` |
| `logs` | array[string] | sí | Log técnico interno del servidor |
| `publicLogs` | array | no | Feed SIEM público (§4.5) |
| `chatMessages` | array | no | Mensajes multicanal (§4.6) |
| `winner` | string \| null | no | `Team` al terminar |
| `soloWinner` | object \| null | no | `{ playerId, role, reason }` |
| `lastNightKills` | array[string] | sí | IDs eliminados última noche |
| `lastVoteByPlayer` | object | no | `Record<playerId, targetId \| null>` (Keylogger) |
| `phaseConfig` | object | sí | Ver §4.7 |
| `gameStats` | object | sí | Ver §4.8 |
| `lastChatSentAt` | object | no | `Record<playerId, timestamp>` rate-limit |
| `sessionThreatBrief` | object | no | Briefing día 1 (§4.9) |
| `archiveCategory` | string | sí | `active` \| `finishgame` \| `deletegame` |
| `archivedAt` | Date | no | Al mover a archivo |
| `createdAt` | Date | sí | Primera persistencia |
| `updatedAt` | Date | sí | Último `save` |

**Campos de archivo** (hoy en `dbSyncService.archiveGameState`):

```json
{
  "archivedAt": "2026-06-22T12:00:00.000Z",
  "archiveCategory": "finishgame"
}
```

### 4.2 Subdocumento `players[]`

Modelo: `PlayerProfile` (`models/PlayerProfile.ts`).

| Campo | Tipo | Requerido | Persistir | Descripción |
|-------|------|-----------|-----------|-------------|
| `id` | string | sí | sí | UUID del cliente (`myPlayerId` en móvil) |
| `name` | string | sí | sí | Alias en sala |
| `role` | string | no | sí | Valor `RoleName` tras REPARTO |
| `team` | string | no | sí | `Team` |
| `isAlive` | boolean | sí | sí | |
| `isConnected` | boolean | sí | sí* | *Al reiniciar servidor: `false` hasta reconnect |
| `joinedAt` | long | sí | sí | Timestamp |
| `metadata` | object | no | sí | Estado runtime por rol (§4.4) |
| `isBot` | boolean | no | sí | Bot QA (`DEV_BOTS`) |
| `socketId` | string | no | **no** | Solo runtime; omitir en MongoDB |
| `userId` | ObjectId | no | no (futuro) | Vínculo a `users` cuando exista login |

### 4.3 Subdocumento `actionQueue[]`

Modelo: `PlayerAction` (`types/events.types.ts`).

| Campo | Tipo | Requerido |
|-------|------|-----------|
| `id` | string | sí |
| `actor` | string | sí |
| `role` | string | no |
| `type` | string | sí |
| `target` | string \| null | no |
| `timestamp` | long | sí |
| `priority` | int | no |
| `meta` | object | no |

**Tipos de acción nocturna** (`ROLE_NIGHT_ACTIONS` en `player-metadata.types.ts`):

| Bando | Roles (resumen) | Tipos `type` |
|-------|-----------------|--------------|
| System (16) | SOC, Antivirus, Pentester, … | `scan`, `protect`, `cure`, `pentester_kill`, `freeze`, `bgp_swap`, `honeypot_drag`, `ids_watch`, `patch_harden`, `forensic_trace`, `backup_mark`, `threat_hunt`, `incident_clear`, `waf_block`, `intel_pulse`, `ally_verify` |
| Black Hat (14) | DDoS, Rootkit, … | `hacker_vote`, `ransomware`, `spy`, `phisher_redirect`, `brute_force`, `team_probe`, `exploit_strip`, `backdoor_plant`, `lateral_probe`, `vote_trace`, `vuln_scan`, `cred_probe`, `mitm_hijack` |
| Caótico (14) | Troll, Gusano, … | `troll_provoke`, `worm_infect`, `worm_kill`, `zero_day_assume`, `mine_crypto`, `crypto_bribe`, `data_leak`, `shadow_mask`, `logic_bomb`, `dns_spoof`, `ransom_note`, `rigged_payload`, `jam_hacker`, `noise_burst`, `mirage_cloak`, `chaos_route` |

**Acción diurna** (no va en `actionQueue`; evento `submitDayAction`):

| Tipo | Rol | Fase |
|------|-----|------|
| `emergency_patch` | SysAdmin | `VOTACION` (1×/partida) |

SysAdmin no tiene entrada en `ROLE_NIGHT_ACTIONS` (rol pasivo de noche).

### 4.4 Subdocumento `players[].metadata`

Modelo: `PlayerMetadata` (`types/player-metadata.types.ts`). Objeto flexible; campos conocidos:

| Campo | Tipo | Rol / uso |
|-------|------|-----------|
| `actedThisNight` | boolean | Todos |
| `lastProtectedTarget` | string \| null | Antivirus |
| `lastCuredTarget` | string \| null | Antivirus |
| `pentesterUsesLeft` | int | Pentester |
| `bruteForceUsesLeft` | int | Fuerza Bruta |
| `shieldCharges` | int | Minero de Cripto |
| `chaosShieldCharges` | int | Dropper |
| `ransomwareCooldown` | int | Ransomware |
| `silencedUntilDay` | int | Ransomware, Nota de Rescate, DDoS degradado |
| `honeypotDragTarget` | string \| null | Honeypot |
| `phisherRedirects` | object | Phisher — `Record<victimId, forcedTargetId>` |
| `assumedFromPlayerId` | string \| null | Zero-Day |
| `isWormImmune` | boolean | Gusano |
| `infection` | object | Gusano — ver abajo |
| `emergencyPatchUsed` | boolean | SysAdmin |
| `patchedVoterId` | string \| null | SysAdmin |
| `trollProvokeUsedTonight` | boolean | Troll |
| `lastMinedTarget` | string \| null | Minero |
| `consensusBlockedUntilNight` | int | Parcheador |
| `exploitStrippedUntilNight` | int | Kit de Exploits |
| `scanMaskedUntilNight` | int | Sombra |
| `logicBombArmed` | boolean | Bomba Lógica |
| `idsWatchTarget` | string \| null | IDS |
| `backupSaveTonight` | boolean | Nodo de Respaldo |
| `backupMarkUsesLeft` | int | Nodo de Respaldo |
| `intelPulseUsed` | boolean | Intel de Amenazas |
| `backdoorBonusTonight` | boolean | Implante Backdoor |
| `wormBlockedUntilNight` | int | WAF |
| `voteBlockedUntilDay` | int | Saboteador |
| `dnsVoteSpoofUntilDay` | int | Envenenador DNS |
| `riggedPayloadUntilNight` | int | Dropper |
| `lynchSurvivorUntilDay` | int | Saboteador |
| `lynchSurvivorConsumed` | boolean | Saboteador |

**Subdocumento `infection`:**

| Campo | Tipo |
|-------|------|
| `sourcePlayerId` | string |
| `source` | string (ej. `worm`) |
| `appliedOnNight` | int |
| `maturesAfterNight` | int |

Valores iniciales por rol: `game/playerMetadata.ts` → `initRoleMetadata()`.  
Escalado por mesa: `game/balance.ts` (Pentester, Minero, Ransomware, hackers).

### 4.5 Subdocumento `publicLogs[]`

| Campo | Tipo |
|-------|------|
| `id` | string |
| `timestamp` | long |
| `nightNumber` | int (opcional) |
| `dayNumber` | int (opcional) |
| `message` | string |
| `severity` | `PublicLogSeverity` |

### 4.6 Subdocumento `chatMessages[]`

| Campo | Tipo |
|-------|------|
| `id` | string |
| `playerId` | string |
| `playerName` | string |
| `text` | string |
| `channel` | `ChatChannel` |
| `timestamp` | long |
| `phase` | `GamePhase` |

### 4.7 Subdocumento `phaseConfig`

| Campo | Tipo | Default (código) |
|-------|------|------------------|
| `autoAdvance` | boolean | `false` / env `AUTO_ADVANCE` |
| `nightDurationMs` | int | `60000` / `NIGHT_DURATION_MS` |
| `dayDurationMs` | int | `60000` / `DAY_DURATION_MS` |
| `voteDurationMs` | int | `90000` |
| `botQaAutoRun` | boolean | `false` |

### 4.8 Subdocumento `gameStats`

| Campo | Tipo |
|-------|------|
| `scansPerformed` | int |
| `killsPrevented` | int |
| `infectionsApplied` | int |
| `votesCast` | int |
| `honeypotDrags` | int |
| `playerActions` | object — `Record<playerId, count>` |
| `mvpPlayerId` | string \| null |
| `mvpReason` | string \| null |

Cálculo MVP: `game/GameStatsTracker.ts` → `computeMvp()`.

### 4.9 Subdocumento `sessionThreatBrief`

| Campo | Tipo |
|-------|------|
| `hackerCount` | int |
| `intruderCount` | int | Caóticos (etiqueta diegética) |
| `systemCount` | int |
| `nodeCount` | int |

### 4.10 Subdocumento `soloWinner`

| Campo | Tipo |
|-------|------|
| `playerId` | string |
| `role` | string (`RoleName`) |
| `reason` | string |

### 4.11 Consulta `getStatus` (login móvil sin cuenta)

Equivalente a `dbSyncService.getActiveRoomStatus()`. No requiere colección aparte:

| Campo respuesta | Lógica |
|-----------------|--------|
| `exists` | Documento con `archiveCategory: 'active'` |
| `phase` | `games.phase` |
| `playerCount` | `players.length` |
| `connectedCount` | jugadores con `isConnected !== false` |
| `canJoin` | `phase === 'LOBBY'` |
| `canReconnect` | fase en curso y `playerId` en `players[]` |

---

## 5. Colección `roles`

Catálogo estático de **44 roles** (16 System + 14 Black Hat + 14 Caótico).  
Fuente: `ROLE_CATALOG` en `types/roles.types.ts` + hints en `game/roleInfo.ts`.

Hoy el juego lee el catálogo desde código TypeScript. La colección MongoDB permite editar textos sin redeploy y alimentar futuros paneles admin.

### 5.1 Campos

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `_id` | string | sí | Valor `RoleName` (ej. `"Analista SOC"`) |
| `team` | string (`Team`) | sí | |
| `displayName` | string | sí | |
| `description` | string | no | Resumen corto (1 línea) |
| `playerGuide` | string | no | Texto largo para móvil |
| `priority` | int | no | Orden en resolución nocturna |
| `nightActions` | array[string] | no | De `ROLE_NIGHT_ACTIONS` |
| `nightActionVariants` | array | no | `{ value, label }` — Antivirus, Minero |
| `nightActionHint` | string | no | De `NIGHT_ACTION_HINTS` en `roleInfo.ts` |
| `victoryHint` | string | no | Condición de victoria |
| `teamLabel` | string | no | Ej. `Equipo Sistema (Blue Team)` |
| `needsSecondaryTarget` | boolean | no | BGP, Phisher, MitM, Router del Caos |
| `isPassiveNight` | boolean | no | `true` para SysAdmin |
| `locale` | string | no | Default `es` |
| `version` | int | no | Versionado de contenido |

### 5.2 Listado de roles por equipo

**System (`system`) — 16**

| `_id` | `nightActions` |
|-------|----------------|
| SysAdmin | — (pasivo; día: `emergency_patch`) |
| Analista SOC | `scan` |
| Antivirus | `protect`, `cure` |
| Pentester | `pentester_kill` |
| Honeypot | `honeypot_drag` |
| Deep Freeze | `freeze` |
| Enrutador BGP | `bgp_swap` |
| Detector IDS | `ids_watch` |
| Parcheador | `patch_harden` |
| Analista Forense | `forensic_trace` |
| Nodo de Respaldo | `backup_mark` |
| Cazador de Amenazas | `threat_hunt` |
| Respondedor de Incidentes | `incident_clear` |
| Cortafuegos WAF | `waf_block` |
| Intel de Amenazas | `intel_pulse` |
| Monitor de Integridad | `ally_verify` |

**Black Hat (`black_hat`) — 14**

| `_id` | `nightActions` |
|-------|----------------|
| DDoS Operator | `hacker_vote` |
| Rootkit | `hacker_vote` |
| Ransomware | `ransomware` |
| Spyware | `spy` |
| Phisher | `phisher_redirect` |
| Fuerza Bruta | `brute_force` |
| Sniffer | `team_probe` |
| Kit de Exploits | `exploit_strip` |
| Implante Backdoor | `backdoor_plant` |
| Movimiento Lateral | `lateral_probe` |
| Keylogger | `vote_trace` |
| Escáner de Vulnerabilidades | `vuln_scan` |
| Robador de Credenciales | `cred_probe` |
| Proxy MitM | `mitm_hijack` |

**Caótico (`chaotic`) — 14**

| `_id` | `nightActions` |
|-------|----------------|
| Troll | `troll_provoke` |
| Gusano | `worm_infect`, `worm_kill` |
| Minero de Cripto | `mine_crypto`, `crypto_bribe` |
| Zero-Day | `zero_day_assume` |
| Filtrador | `data_leak` |
| Sombra | `shadow_mask` |
| Bomba Lógica | `logic_bomb` |
| Envenenador DNS | `dns_spoof` |
| Nota de Rescate | `ransom_note` |
| Dropper | `rigged_payload` |
| Saboteador | `jam_hacker` |
| Ruido Blanco | `noise_burst` |
| Espejismo | `mirage_cloak` |
| Router del Caos | `chaos_route` |

Documentación extendida de mecánicas: [`ROLES.md`](./ROLES.md), [`WIN_CONDITIONS.md`](./WIN_CONDITIONS.md).

---

## 6. Colección `session_logs` (opcional)

Complementa el JSON archivado. Equivalente a `data/finishgame/<roomId>.log`.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `_id` | ObjectId | |
| `roomId` | string | Índice único |
| `text` | string | Salida de `buildSessionLogText()` |
| `archivedAt` | Date | |
| `winner` | string \| null | |
| `soloWinner` | object \| null | |

Generación: `services/GameSessionLogService.ts` al archivar con categoría `finishgame`.

---

## 7. Índices recomendados

```javascript
// games
db.games.createIndex({ roomId: 1 }, { unique: true })
db.games.createIndex({ archiveCategory: 1, updatedAt: -1 })
db.games.createIndex({ phase: 1, archiveCategory: 1 })
db.games.createIndex({ "players.id": 1 }, { sparse: true })

// roles
db.roles.createIndex({ team: 1 })
db.roles.createIndex({ locale: 1, version: 1 })

// session_logs
db.session_logs.createIndex({ roomId: 1 }, { unique: true })
db.session_logs.createIndex({ archivedAt: -1 })
```

---

## 8. Contrato `DBAdapter` (implementación requerida)

El adaptador MongoDB debe cumplir la interfaz en `config/database.ts` sin cambiar `Room.ts` ni handlers socket:

```typescript
interface DBAdapter {
  save(roomId: string, state: any): boolean;
  load(roomId: string): any | null;
  loadOrArchive(roomId: string): any | null;
  readSessionLog(roomId: string): string | null;
  delete(roomId: string): boolean;
  archive(roomId: string, category: 'finishgame' | 'deletegame', extra?: Record<string, unknown>): boolean;
  list(): string[];
  getStatus(roomId: string, playerId?: string): ActiveRoomStatus;
}
```

### 8.1 Comportamiento por método

| Método | MongoDB |
|--------|---------|
| `save` | `upsert` en `games` con `archiveCategory: 'active'`, `updatedAt: now` |
| `load` | `findOne({ roomId, archiveCategory: 'active' })` |
| `loadOrArchive` | activo, o `archiveCategory: 'finishgame'` |
| `archive` | `updateOne` → `archiveCategory`, `archivedAt`; si `finishgame`, escribir `session_logs` |
| `delete` | `archiveCategory: 'deletegame'` o borrado físico |
| `list` | `distinct('roomId', { archiveCategory: 'active' })` |
| `getStatus` | proyección ligera del documento activo |

### 8.2 Hidratación al reiniciar servidor

`GameStateModel.fromObject()` (`models/GameState.ts`):

- Todos los jugadores cargan con `isConnected: false` (excepto `isBot: true`).
- Reconexión vía socket `joinRoom` con el mismo `playerId`.

### 8.3 Feature flag

```
MONGO_URI definido  → MongoDBAdapter
MONGO_URI vacío     → JsonAdapter (actual, dbSyncService)
DATA_DIRECTORY      → sigue siendo fallback JSON
```

---

## 9. Flujo de datos actual (sin MongoDB)

```
Dashboard createRoom → Room en memoria
Mobile joinRoom      → Player en memoria + database.save()
Cada evento crítico  → database.save(state.toPlain())
gameOver / delete    → database.archive() → finishgame/ | deletegame/
```

**Clientes**

| Cliente | Identificación | Persistencia local |
|---------|----------------|-------------------|
| mobile-terminal | `roomCode`, `myPlayerId` (UUID), `playerName` | `localStorage` |
| web-dashboard | solo `roomId` | sin sesión de jugador |

No hay colección de usuarios ni validación JWT en el flujo actual.

---

## 10. Colecciones futuras (login — no implementar aún)

Reservadas para cuando se active `auth/jwt.pending.ts`. **No bloquean el juego.**

### 10.1 `users`

| Campo | Tipo |
|-------|------|
| `_id` | ObjectId |
| `email` | string (único, sparse) |
| `username` | string |
| `passwordHash` | string |
| `authProvider` | `local` \| `google` \| `guest_linked` |
| `avatarUrl` | string |
| `preferredLocale` | string |
| `stats` | `{ gamesPlayed, winsByTeam, mvpCount, favoriteRoles[] }` |
| `linkedGuestIds` | string[] |
| `createdAt` / `lastLoginAt` | Date |
| `isActive` | boolean |

### 10.2 `auth_sessions`

| Campo | Tipo |
|-------|------|
| `userId` | ObjectId |
| `refreshTokenHash` | string |
| `deviceId` | string |
| `expiresAt` | Date (TTL index) |
| `createdAt` | Date |

### 10.3 `game_participations`

| Campo | Tipo |
|-------|------|
| `userId` | ObjectId (nullable) |
| `guestPlayerId` | string |
| `roomId` | string |
| `playerName` | string |
| `role` / `team` | string |
| `won` | boolean |
| `isMvp` | boolean |
| `eliminatedOnDay` | int |
| `finishedAt` | Date |

Variables previstas: `JWT_SECRET`, `SESSION_SECRET` en `.env`.

---

## 11. Scripts de creación y migración

El script principal para crear la estructura de MongoDB es:

```bash
cd backend-server
npm run db:setup
```

Ese comando ejecuta `scripts/setup-mongodb.ts` y realiza:

1. Crea las colecciones `games`, `roles` y `session_logs` si aún no existen.
2. Crea los índices recomendados de cada colección.
3. Puebla `roles` con los 44 roles desde el código fuente (`ROLE_CATALOG`, `ROLE_NIGHT_ACTIONS` y `roleInfo.ts`).

Requisitos antes de correrlo:

```env
MONGO_URI=mongodb://localhost:27017/firewall_protocol
MONGO_DB_NAME=firewall_protocol
```

Scripts auxiliares:

| Comando | Script | Uso |
|---------|--------|-----|
| `npm run db:setup` | `scripts/setup-mongodb.ts` | Crear colecciones, índices y seed de roles |
| `npm run db:seed` | `scripts/seed-roles.ts` | Re-sembrar solo la colección `roles` |
| `npm run db:migrate` | `scripts/migrate-json-to-mongodb.ts` | Migrar partidas JSON existentes hacia MongoDB |

El gameplay **no depende** del seed de `roles` mientras el backend siga importando `roles.types.ts`; la colección queda lista para paneles/admin o consumo futuro.

---

## 12. Estado de implementación

- [x] Driver nativo `mongodb` agregado en `backend-server`
- [x] `MongoDBAdapter` implementa `DBAdapter`
- [x] Selección automática de adaptador en `config/database.ts` según `MONGO_URI`
- [x] Script `db:setup` para crear colecciones, índices y seed de roles
- [x] Script `db:migrate` para migrar documentos desde `data/games/*.json`
- [x] Colección `session_logs` al archivar partidas terminadas
- [x] Fallback JSON cuando `MONGO_URI` no está definido
- [ ] Validación manual pendiente: crear sala, unir móvil, reconectar, consultar `getStatus` y archivar `finishgame`

---

## 13. Referencias en el repositorio

| Archivo | Contenido |
|---------|-----------|
| `backend-server/src/models/GameState.ts` | Esquema persistido (`toPlain` / `fromObject`) |
| `backend-server/src/models/PlayerProfile.ts` | Jugador en partida |
| `backend-server/src/types/player-metadata.types.ts` | Metadata y acciones por rol |
| `backend-server/src/types/roles.types.ts` | Catálogo de 44 roles |
| `backend-server/src/types/events.types.ts` | Fases, chat, stats, acciones |
| `backend-server/src/config/database.ts` | Contrato de persistencia |
| `backend-server/src/services/dbSyncService.ts` | Implementación JSON actual |
| `backend-server/src/services/MongoDBAdapter.ts` | Implementación MongoDB |
| `backend-server/scripts/setup-mongodb.ts` | Script de creación de BD, colecciones, índices y roles |
| `backend-server/scripts/seed-roles.ts` | Seed reutilizable de `roles` |
| `backend-server/scripts/migrate-json-to-mongodb.ts` | Migración desde JSON a MongoDB |
| `backend-server/.env.example` | `MONGO_URI`, `JWT_SECRET` |
| `SOCKET_CONTRACT.md` | Eventos socket (no persistidos como colección) |
| `ROLES.md` | Guía de roles para humanos |

---

*Última revisión: Steven Zambrano — código en `backend-server`, 44 roles, fases `GamePhase`, persistencia MongoDB con fallback JSON vía `DBAdapter`.*
