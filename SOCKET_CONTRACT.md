# Firewall Protocol — Contrato Socket.io

Documento de referencia para **mobile-terminal** (`/game`) y **web-dashboard** (`/dashboard`).
Alineado con `backend-server` v0.1.

**URL base**: `http://<IP_SERVIDOR>:3000` (misma red LAN para móviles y PC).

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
| `playerAction` | `roomId`, `action` | Fase `NOCHE` |
| `submitVote` | `roomId`, `{ voter, target }` | Fase `VOTACION` |

### Servidor → cliente

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `roomState` | `roomId`, `state` | Estado filtrado (roles ajenos ocultos) |
| `privateResult` | `roomId`, `payload` | Rol, equipo hacker, escaneo, espionaje |
| `phaseChanged` | `roomId`, `phase` | Fase actual |
| `phaseTransition` | `{ roomId, from, to, at }` | Transición con timestamp |
| `incidentReport` | `{ roomId, nightNumber, disconnected[] }` | Caídas nocturnas |
| `nightResolved` | `roomId`, `resolution` | Resolución de la noche |
| `voteTrace` | `{ roomId, voter, target, timestamp }` | Voto registrado |
| `playerEliminated` | `roomId`, `playerId`, `reason` | Eliminación |
| `gameOver` | `roomId`, `winner`, `soloWinner?` | Fin de partida |
| `actionAccepted` | `actionId` | Acción nocturna aceptada |
| `error` | `message` | Error |

### `playerAction` — payload

```typescript
{
  id: string;           // único, ej. "act_" + Date.now()
  actor: string;        // playerId del jugador local
  role?: string;        // rol asignado (del privateResult)
  type: string;         // ver tabla de roles en README backend
  target?: string;      // playerId objetivo
  timestamp: number;    // Date.now()
  meta?: Record<string, any>;  // ej. { swapWith } para BGP
}
```

### `privateResult` — tipos

```typescript
// Rol asignado al iniciar partida
{ type: 'role_assigned', role: string, team: string }

// Equipo hacker (solo Black Hat)
{ type: 'hacker_team', members: string[] }

// Escaneo SOC
{ type: 'scan', targetId: string, result: 'safe' | 'malicious' }

// Espionaje
{ type: 'spy', targetId: string, visitors: string[] }
```

### Fases del backend (usar tal cual)

`LOBBY` · `REPARTO` · `NOCHE` · `DIA` · `VOTACION` · `VERIFICACION` · `FIN`

---

## `/dashboard` — PC / TV

### Cliente → servidor

| Evento | Parámetros | Cuándo |
|--------|------------|--------|
| `joinDashboard` | `roomId` | Al abrir vista de sala |
| `leaveDashboard` | `roomId` | Al cerrar vista |
| `createRoom` | `roomId` | Crear sala (host) |
| `startGame` | `roomId` | Iniciar con ≥5 jugadores |
| `advancePhase` | `roomId` | Avanzar fase manualmente |

> El dashboard **no** debe usar `joinRoom` ni registrarse como jugador.

### Servidor → cliente

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `publicState` | `PublicGameState` | Estado público sin roles |
| `incidentReport` | `{ roomId, nightNumber, disconnected[] }` | Nodos caídos al amanecer |
| `voteTrace` | `{ roomId, voter, target, timestamp }` | Líneas de voto en tiempo real |
| `phaseTransition` | `{ roomId, from, to, at }` | Animaciones noche/día |
| `phaseChanged` | `roomId`, `phase` | Fase actual |
| `gameOver` | `roomId`, `winner`, `soloWinner?` | Fin de partida |
| `roomCreated` | `roomId` | Sala creada |
| `error` | `message` | Error |

### `PublicGameState`

```typescript
{
  roomId: string;
  phase: GamePhase;
  phaseStartedAt: number;
  dayNumber: number;
  nightNumber: number;
  players: {
    id: string;
    name: string;
    isAlive: boolean;
    isConnected: boolean;
    silenced?: boolean;
  }[];
  votes: Record<string, string[]>;
  winner: string | null;
  soloWinner: { playerId, role, reason } | null;
}
```

---

## Flujo de integración recomendado

### 1. Host (dashboard)

```
connect → /dashboard
createRoom("FIRE-AB12")
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
// VOTACION:
submitVote(roomId, { voter: playerId, target: targetPlayerId })
```

### 3. Reconexión móvil

```
joinRoom(mismo roomId, mismo playerId, name)  // no crear nuevo playerId
```

---

## Acciones nocturnas por rol

| Rol | `type` |
|-----|--------|
| Analista SOC | `scan` |
| Antivirus | `protect` |
| Pentester | `pentester_kill` |
| Deep Freeze | `freeze` |
| Enrutador BGP | `bgp_swap` (+ `meta.swapWith`) |
| Honeypot | `honeypot_drag` |
| DDoS Operator / Rootkit | `hacker_vote` |
| Ransomware | `ransomware` |
| Spyware | `spy` |
| Phisher | `phisher_redirect` (+ `meta.redirectTo`) |
| Gusano | `worm_kill` |
| Zero-Day | `zero_day_assume` (objetivo muerto) |
| SysAdmin, Troll, Minero | sin acción |

---

## Reglas de sala

- Mínimo **5** jugadores para `startGame`
- Máximo **15** jugadores por sala
- Códigos de sala recomendados: `FIRE-XXXX`

---

## Referencia

Detalle completo del backend: [`backend-server/README.md`](backend-server/README.md)
