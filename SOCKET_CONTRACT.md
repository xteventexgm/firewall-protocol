# Firewall Protocol — Contrato Socket.io

Documento de referencia compartido para **mobile-terminal** (`/game`) y **web-dashboard** (`/dashboard`).

- **Índice del proyecto:** [`README.md`](README.md)
- **Fuente canónica de tipos TypeScript:** [`backend-server/src/types/events.types.ts`](backend-server/src/types/events.types.ts)
- **Detalle de reglas y motor:** [`backend-server/README.md`](backend-server/README.md)
- **Historial de cambios:** [`CHANGELOG.md`](CHANGELOG.md)

**URL base:** `http://<IP_SERVIDOR>:3000` (misma red LAN para móviles y PC).

---

## Namespaces

| Namespace | Cliente | Propósito |
|-----------|---------|-----------|
| `/game` | App móvil (Ionic) | Acciones de jugador, estado privado |
| `/dashboard` | PC/TV (Angular) | Vista pública, control de host |

---

## `/game` — App móvil

### Cliente → servidor

| Evento | Parámetros | Cuándo |
|--------|------------|--------|
| `joinRoom` | `roomId`, `playerId`, `name?` | Login / reconexión |
| `leaveRoom` | `roomId`, `playerId` | Salir de partida |
| `startGame` | `roomId` | Iniciar (mín. 5 jugadores) |
| `advancePhase` | `roomId` | Avanzar fase manualmente |
| `playerAction` | `roomId`, `action` | Fase `NOCHE` |
| `submitVote` | `roomId`, `{ voter, target }` | Fase `VOTACION` (`target: null` = voto en blanco) |
| `createRoom` | `roomId` | **Rechazado** — solo dashboard |

### Servidor → cliente

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `roomState` | `roomId`, `PlayerRoomState` | Estado filtrado por jugador (roles ajenos ocultos) |
| `privateResult` | `roomId`, `PrivateResultPayload` | Solo al socket del jugador afectado |
| `phaseChanged` | `roomId`, `phase` | Fase actual |
| `phaseTransition` | `{ roomId, from, to, at }` | Transición con timestamp |
| `incidentReport` | `IncidentReport` | Bajas nocturnas al amanecer |
| `nightResolved` | `roomId`, `PublicNightResolution` | Resolución **reducida** (sin `logs` ni `privateResults`) |
| `voteTrace` | `{ roomId, voter, target, timestamp }` | Voto registrado |
| `voteTied` | `VoteTiedPayload` | Empate o sin votos de eliminación |
| `playerReconnected` | `roomId`, `playerId` | Jugador reconectado |
| `playerDisconnected` | `roomId`, `playerId` | Jugador desconectado (socket) |
| `playerEliminated` | `roomId`, `playerId`, `reason` | Eliminación |
| `gameOver` | `roomId`, `winner`, `soloWinner?` | Fin de partida |
| `actionAccepted` | `actionId` | Acción nocturna aceptada |
| `error` | `message` | Error (acciones: mensaje legible + código entre paréntesis) |

### `playerAction` — payload

```typescript
{
  id: string;           // único, ej. "act_" + Date.now()
  actor: string;        // playerId del jugador local
  role?: string;        // rol asignado (del privateResult)
  type: string;         // ver tabla de roles abajo
  target?: string;      // playerId objetivo
  timestamp: number;    // Date.now()
  meta?: Record<string, any>;  // ej. { swapWith } para BGP, { redirectTo } para Phisher
}
```

### `privateResult` — tipos

```typescript
// Rol asignado al iniciar partida / reconexión
{
  type: 'role_assigned',
  role: string,
  team: string,
  displayName?: string,
  description?: string,
  teamLabel?: string,
  nightAction?: string | null,
  nightActionHint?: string,
}

// Equipo hacker (solo Black Hat al inicio)
{ type: 'hacker_team', members: string[] }

// Escaneo SOC
{ type: 'scan', targetId: string, result: 'safe' | 'suspicious' | 'malicious' }

// Espionaje
{ type: 'spy', targetId: string, visitors: string[], visitorActivities?: { playerId: string; activity: string }[] }

// Gusano infecta (víctima)
{
  type: 'infected',
  targetId: string,
  infectionSource?: string,
  maturesAfterNight?: number,
}

// Infección madura esta noche — el nodo caerá si no fue curado
{
  type: 'infection_warning',
  targetId: string,
  critical: true,
  maturesAfterNight?: number,
}

// Antivirus cura infección
{ type: 'cured', targetId: string }
```

### `incidentReport`

```typescript
{
  roomId: string;
  nightNumber: number;
  eliminatedPlayerIds: string[];  // CANÓNICO — kills nocturnos
  disconnected: string[];         // alias legacy del mismo array (no desconexiones socket)
}
```

Usar: `report.eliminatedPlayerIds ?? report.disconnected`

### `voteTied`

```typescript
{
  roomId: string;
  voteCount: number;
  candidates: string[];
  skipVotes: number;              // votos en blanco (target null)
  reason: 'tie' | 'no_votes';
}
```

### `nightResolved` (móvil — payload reducido)

```typescript
type PublicNightResolution = {
  kills: string[];
  prevented: { actionId: string; reason: string }[];
  redirects: { actionId: string; from: string; to: string }[];
  silenced: string[];
  honeypotDrags: { honeypotId: string; draggedId: string }[];
  infections: string[];
  cures: string[];
  infectionKills: string[];
};
```

> No incluye `logs` ni `privateResults`. Los resultados privados llegan por el evento `privateResult`.

### `roomState` — visibilidad

- Roles de **otros jugadores** ocultos durante la partida (incluidos eliminados).
- Metadata ajena sanitizada: oculta `infection`, `phisherRedirects`, `lastProtectedTarget`, `lastCuredTarget`, `assumedFromPlayerId`, `honeypotDragTarget`.
- Siguen visibles en metadata ajena: `shieldCharges`, `pentesterUsesLeft`, `ransomwareCooldown`, `silencedUntilDay`, `isWormImmune`, `actedThisNight`.

### Errores de acción (`error`)

Formato: `Mensaje legible en español (codigo_error)`

Ejemplos:
- `No puedes proteger al mismo jugador dos noches seguidas (antivirus_cooldown)`
- `Debes esperar antes de volver a usar Ransomware (ransomware_cooldown)`

Códigos: `wrong_phase`, `actor_dead`, `actor_silenced`, `actor_frozen`, `already_acted`, `invalid_action_type`, `no_uses_left`, `antivirus_cooldown`, `antivirus_cure_cooldown`, `ransomware_cooldown`, `invalid_target`, `role_mismatch`, `no_shields_left`, `shields_at_max`, `miner_target_cooldown`.

### Errores de join / lobby (`error`)

Mismo formato. Aplica a `joinRoom`, `joinDashboard`, `createRoom` (móvil rechazado).

| Código | Cuándo |
|--------|--------|
| `room_not_found` | Sala no existe en memoria/disco |
| `game_ended` | Sala cerrada tras FIN (`RoomClosedError`) |
| `game_started` | Nuevo jugador intenta entrar fuera de LOBBY |
| `room_full` | Capacidad `maxPlayers` alcanzada |
| `invalid_room_code` | Código distinto de `FIRE-XXXX` |
| `invalid_player_id` | `playerId` vacío en join móvil |
| `dashboard_only` | `createRoom` / `startGame` / `advancePhase` desde móvil |
| `not_enough_players` | `startGame` sin mínimo de jugadores |
| `not_joined` / `identity_mismatch` | Acción sin `joinRoom` previo o actor distinto |

**Reconexión:** tras `connect`, móvil y web re-emiten join si hay sesión guardada. Errores fatales (`game_ended`, `room_not_found`, etc.) limpian sesión y redirigen a login (móvil) o mantienen en lobby (web).

### Fases del backend (usar tal cual)

`LOBBY` · `REPARTO` · `NOCHE` · `DIA` · `VOTACION` · `VERIFICACION` · `FIN`

---

## `/dashboard` — PC / TV

### Cliente → servidor

| Evento | Parámetros | Cuándo |
|--------|------------|--------|
| `createRoom` | `roomId`, `maxPlayers` | Crear sala (host; **maxPlayers obligatorio**, 5–15) |
| `joinDashboard` | `roomId` | Al abrir vista de sala |
| `leaveDashboard` | `roomId` | Al cerrar vista |
| `startGame` | `roomId` | Iniciar con ≥5 jugadores |
| `advancePhase` | `roomId` | Avanzar fase manualmente |

> El dashboard **no** debe usar `joinRoom` ni registrarse como jugador.

### Servidor → cliente

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `roomCreated` | `{ roomId, maxPlayers }` | Sala creada (tras `createRoom`) |
| `publicState` | `PublicGameState` | Estado público |
| `incidentReport` | `IncidentReport` | Bajas nocturnas al amanecer |
| `nightResolved` | `roomId`, `NightResolution` | Resolución **completa** (incluye `logs`, `privateResults`) |
| `voteTrace` | `{ roomId, voter, target, timestamp }` | Líneas de voto en tiempo real |
| `voteTied` | `VoteTiedPayload` | Empate o sin votos de eliminación |
| `playerReconnected` | `roomId`, `playerId` | Jugador reconectado |
| `playerDisconnected` | `roomId`, `playerId` | Jugador desconectado (socket) |
| `phaseTransition` | `{ roomId, from, to, at }` | Animaciones noche/día |
| `phaseChanged` | `roomId`, `phase` | Fase actual |
| `playerEliminated` | `roomId`, `playerId`, `reason` | Eliminación |
| `gameOver` | `roomId`, `winner`, `soloWinner?` | Fin de partida |
| `error` | `message` | Error |

### `PublicGameState`

```typescript
{
  roomId: string;
  phase: GamePhase;
  phaseStartedAt: number;
  dayNumber: number;
  nightNumber: number;
  maxPlayers: number;
  playerCount: number;
  players: {
    id: string;
    name: string;
    isAlive: boolean;
    isConnected: boolean;
    silenced?: boolean;
    role?: string;           // visible si !isAlive o phase === FIN
  }[];
  votes: Record<string, string[]>;
  winner: string | null;
  soloWinner: { playerId: string; role: string; reason: string } | null;
}
```

> A diferencia del móvil, el dashboard **revela el rol** de jugadores eliminados (`!isAlive`) aunque la partida siga activa.

### `nightResolved` (dashboard — payload completo)

```typescript
type NightResolution = PublicNightResolution & {
  logs: string[];
  privateResults: { playerId: string; payload: PrivateResultPayload }[];
};
```

---

## Acciones nocturnas por rol

| Rol | `type` | `meta` extra | Notas |
|-----|--------|--------------|-------|
| Analista SOC | `scan` | — | Resultado privado `safe` / `malicious` |
| Antivirus | `protect` **o** `cure` | — | Una acción por noche; cooldown por objetivo |
| Pentester | `pentester_kill` | — | 2 usos; culpa si mata aliado System |
| Deep Freeze | `freeze` | — | Congela objetivo esa noche |
| Enrutador BGP | `bgp_swap` | `{ swapWith: playerId }` | Intercambia destinos nocturnos |
| Honeypot | `honeypot_drag` | — | Arrastra objetivo si muere |
| DDoS Operator / Rootkit | `hacker_vote` | — | Voto conjunto hacker |
| Ransomware | `ransomware` | — | Silencia al día siguiente |
| Spyware | `spy` | — | Revela visitantes (privado) |
| Phisher | `phisher_redirect` | `{ redirectTo: playerId }` | Redirige **voto diurno** de la víctima (no acciones nocturnas ajenas) |
| Gusano | `worm_infect` | — | Infecta objetivo (`worm_kill` es alias). **Inmune a kills mientras vive** |
| Zero-Day | `zero_day_assume` | — | Objetivo debe estar eliminado |
| Troll | `troll_provoke` | `{ messageIndex: number }` | Mensaje anónimo en feed público |
| SysAdmin | — | — | Sin acción nocturna; `emergency_patch` en VOTACION |
| Minero de Cripto | `mine_crypto` **o** `crypto_bribe` | — | Una por noche; bribe requiere ≥1 escudo |

---

## Reglas de sala

- Mínimo **5** jugadores para `startGame`
- Máximo **15** jugadores por sala (`maxPlayers` en `createRoom`)
- Códigos de sala recomendados: `FIRE-XXXX`
- Desconexión socket ≠ eliminación: usar `playerDisconnected` / `isConnected` para conexión; `incidentReport.eliminatedPlayerIds` para bajas nocturnas

---

## Flujo de integración recomendado

### 1. Host (dashboard)

```
connect → /dashboard
createRoom("FIRE-AB12", 10)
← roomCreated { roomId, maxPlayers }
joinDashboard("FIRE-AB12")
← publicState, phaseChanged
(esperar ≥5 joinRoom desde móviles)
startGame("FIRE-AB12")
advancePhase("FIRE-AB12")  // repetir según fase
```

### 2. Jugador (móvil)

```
connect → /game
joinRoom("FIRE-AB12", playerId, name)
← roomState, privateResult (role_assigned)
// NOCHE:
playerAction(roomId, { id, actor, role, type, target, timestamp })
← actionAccepted
← nightResolved (payload reducido)
← privateResult (scan, infected, etc. según rol)
// VOTACION:
submitVote(roomId, { voter: playerId, target: targetPlayerId })
← voteTrace
// Empate:
← voteTied { skipVotes, reason }
```

### 3. Reconexión móvil

```
joinRoom(mismo roomId, mismo playerId, name)  // no crear nuevo playerId
← roomState, privateResult (role_assigned)
← playerReconnected (a toda la sala)
```

---

## Victorias (resumen)

| Tipo | Condición |
|------|-----------|
| System | No quedan Black Hat vivos |
| Black Hat | Hackers vivos **>** System vivos (estrictamente mayor) |
| Troll (solo) | Baneado por votación |
| Gusano (solo) | Único jugador vivo |
| Minero (solo) | Único superviviente tras caer hackers |
| Zero-Day | Sin victoria solitaria; si asumió rol System y no quedan hackers → victoria System |

No existe victoria de **equipo caótico** (`Team.CHAOTIC`).

---

## Eventos de engagement (v2)

### Cliente → servidor (nuevos)

| Evento | Parámetros | Cuándo |
|--------|------------|--------|
| `submitChat` | `roomId`, `{ playerId, text, channel? }` | LOBBY, DIA, VOTACION, FIN |
| `submitDayAction` | `roomId`, `{ actor, type, target? }` | SysAdmin `emergency_patch` en VOTACION |
| `requestMinigame` | `roomId`, `playerId` | NOCHE (skill check opcional) |
| `setPhaseConfig` | `roomId`, `Partial<PhaseConfig>` | Solo dashboard (host) |

### Servidor → cliente (nuevos)

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `chatMessage` | `roomId`, `ChatMessage` | Mensaje de chat (filtrado por canal) |
| `publicLog` | `roomId`, `PublicLogEntry` | Entrada narrativa estilo SIEM |
| `publicLogsBatch` | `roomId`, `PublicLogEntry[]` | Lote tras resolver noche |
| `minigameChallenge` | `roomId`, `MinigameChallengePayload` | Desafío de habilidad (solo al jugador) |
| `nightProgress` | `roomId`, `{ acted, total }` | Progreso de acciones nocturnas |
| `phaseConfigChanged` | `roomId`, `PhaseConfig` | Timers / auto-avance |
| `gameStats` | `roomId`, `GameStatsEntry[]` | Estadísticas post-partida |

### Acciones nuevas

| Rol | Tipo | Notas |
|-----|------|-------|
| Troll | `troll_provoke` | `meta.messageIndex` (0–7) |
| SysAdmin | `emergency_patch` (día) | Via `submitDayAction`; 1×/partida |

### Seguridad socket

Tras `joinRoom`, el servidor vincula `socket.data.playerId`. Las acciones/votos/chat deben coincidir con ese ID.

---

## Referencias

| Documento | Contenido |
|-----------|-----------|
| [`backend-server/src/types/events.types.ts`](backend-server/src/types/events.types.ts) | Tipos TypeScript canónicos |
| [`backend-server/README.md`](backend-server/README.md) | Motor de reglas, persistencia, variables de entorno |
