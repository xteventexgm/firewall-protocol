> **Contrato socket compartido (clientes):** [`../SOCKET_CONTRACT.md`](../SOCKET_CONTRACT.md) en la raíz del monorepo.  
> **Tipos canónicos:** [`src/types/events.types.ts`](src/types/events.types.ts)

# Firewall Protocol — Backend

Servidor realtime del juego **Firewall Protocol**: thriller de deducción social multijugador (5–15 jugadores) con temática de ciberseguridad. Coordina salas, fases, roles, acciones nocturnas, votación diurna y victoria en tiempo real vía WebSockets.

**Stack**: TypeScript 5.9 · Node.js · Express 4.18 · Socket.io 4.7 · ts-node

**Estado actual**: Backend funcional con máquina de estados completa, matchmaking, motor de reglas por rol, reconexión, persistencia JSON, namespaces `/game` (móvil) y `/dashboard` (PC/TV). JWT pendiente.

---

## Rol en el proyecto

Este repositorio corresponde al **Integrante 3 (Backend & WebSocket Architect)** del documento maestro del proyecto. Los clientes esperados son:

| Cliente | Namespace | Descripción |
|---------|-----------|-------------|
| App móvil (Ionic/Angular) | `/game` | Terminal secreta del jugador |
| Dashboard PC/TV (Angular) | `/dashboard` | Vista pública del datacenter |

---

## Características implementadas

### Arquitectura de salas
- `RoomManager` — CRUD de salas aisladas en memoria
- `Room` — orquestación de partida, persistencia y eventos internos
- Reconexión sin duplicar jugadores (`reconnectPlayer`)
- Desconexión suave (`markPlayerDisconnected`) vs abandono voluntario (`leaveRoom`)
- Límite de **5–15 jugadores** por sala

### Máquina de estados
```
LOBBY → REPARTO → DÍA → VOTACIÓN → VERIFICACIÓN → NOCHE → DÍA → … → FIN
(VOTACIÓN también puede ir directo a NOCHE si hay empate en votos)
```
- Restauración de fase al cargar partida desde disco (`StateMachine.restorePhase`)
- Timers opcionales de auto-avance (`nightDurationMs`, `dayDurationMs`)
- Fase `FIN` al terminar la partida

### Matchmaking
- Black Hat: **1 cada 3 jugadores** (`PLAYERS_PER_BLACK_HAT` en `constants.ts`)
- Caóticos: **1 cada 5 jugadores** (`PLAYERS_PER_CHAOTIC_ROLE` en `constants.ts`); el resto es System
- Roles sin repetir dentro de cada equipo hasta agotar el catálogo
- 16 roles del catálogo GDD en `src/types/roles.types.ts`
- RNG inyectable para pruebas deterministas

### Motor de reglas (`RuleEngine`)
- Resolución nocturna por prioridad de rol
- Consenso hacker (`hacker_vote`) — mayoría de Black Hat para kill nocturno
- Protección Antivirus con cooldown de objetivo
- Deep Freeze, BGP swap, Pentester con culpa y usos limitados
- Ransomware (silencio diurno), Spyware, Phisher, Honeypot drag
- Gusano inmune mientras vive (no consumible) + infección propia, Minero con 3 escudos, Zero-Day asume rol eliminado
- Escaneo SOC privado (`safe` / `malicious`), Rootkit devuelve falso positivo

### Validación de acciones (`ActionValidator`)
- Solo en fase `NOCHE`
- Actor vivo, no silenciado, no congelado
- Una acción por jugador por noche
- Tipo de acción acorde al rol
- Límites de usos y cooldowns (Pentester, Ransomware, Antivirus)

### Votación y victoria
- Votación solo en `VOTACION`; silenciados no votan
- Un voto por jugador; resolución por mayoría simple entre objetivos votados
- **Empate o sin votos de eliminación** → nadie eliminado, evento `voteTied` (`skipVotes`, `reason: 'tie' | 'no_votes'`), salto directo a `NOCHE`
- Voto en blanco (`target: null`) se registra bajo clave `skip` (no cuenta para eliminar)
- Phisher redirige **votos diurnos** en secreto (no acciones nocturnas ajenas)
- **Victoria por bando**: System elimina hackers / Black Hat iguala o supera en número
- **Victoria solitaria**: Troll (baneado), Gusano (último en pie), Minero (único superviviente)

### Información pública vs privada
- `toPlainForPlayer(viewerId)` — estado móvil con roles ajenos ocultos durante la partida
- `toPublicState()` — estado dashboard; **revela el rol de jugadores eliminados** (`!isAlive`) aunque la partida siga activa
- `privateResult` — rol propio, equipo hacker, escaneos, espionaje, infección (`infected`, `infection_warning`, `cured`)
- `incidentReport` — bajas nocturnas (`eliminatedPlayerIds`; alias `disconnected`) sin revelar atacante
- `voteTrace` — trazado de votos para animaciones del dashboard
- `nightResolved` — resolución completa en `/dashboard`; payload reducido (sin `logs` ni `privateResults`) en `/game`

### Metadata en `roomState`
En fases con roles ocultos, la metadata de **otros jugadores** se sanitiza: se ocultan `infection`, `phisherRedirects`, `lastProtectedTarget`, `lastCuredTarget`, `assumedFromPlayerId`, `honeypotDragTarget`. Siguen visibles contadores como `shieldCharges`, `pentesterUsesLeft`, `ransomwareCooldown`, `silencedUntilDay`, `isWormImmune`, `actedThisNight`.

### Persistencia
- JSON en disco vía `dbSyncService` (`data/games/<roomId>.json`)
- Adapter en `config/database.ts` preparado para migrar a MongoDB (Integrante 4)
- `DATA_DIRECTORY` configurable desde `.env`

### Pendiente
- Autenticación JWT (`src/auth/jwt.pending.ts`)
- Migración a MongoDB (coordinación con Integrante 4)
- Tests unitarios automatizados

---

## Estructura de carpetas

```
src/
├── auth/
│   └── jwt.pending.ts       # Placeholder — JWT en última fase
├── types/
│   ├── events.types.ts      # Fases, acciones, contratos socket
│   ├── roles.types.ts       # Catálogo de 16 roles y equipos
│   ├── player-metadata.types.ts
│   └── index.ts
├── models/
│   ├── PlayerProfile.ts     # Clase Player (isAlive, isConnected, metadata)
│   └── GameState.ts         # GameStateModel, toPlainForPlayer, toPublicState
├── game/
│   ├── StateMachine.ts      # Transiciones de fase
│   ├── Matchmaking.ts       # Reparto de roles
│   ├── RuleEngine.ts        # Resolución nocturna por rol
│   ├── ActionValidator.ts   # Validación de acciones
│   ├── VictoryChecker.ts    # Condiciones de victoria
│   ├── playerMetadata.ts    # Metadata y flags por jugador
│   ├── Room.ts              # Orquestación de partida
│   └── RoomManager.ts       # CRUD de salas
├── sockets/
│   ├── index.ts             # Namespaces /game y /dashboard
│   ├── roomHandler.ts       # joinRoom, leaveRoom, createRoom
│   ├── gameHandler.ts       # playerAction, startGame, advancePhase, submitVote
│   ├── dashboardHandler.ts  # joinDashboard, leaveDashboard
│   └── roomBridge.ts        # Puente Room → eventos socket
├── services/
│   └── dbSyncService.ts     # Persistencia JSON
├── config/
│   ├── database.ts          # Adapter de persistencia
│   └── env.ts               # Variables de entorno
├── utils/
│   ├── logger.ts
│   └── constants.ts         # MIN_PLAYERS, MAX_PLAYERS, rutas de datos
├── app.ts                   # Express (health, raíz)
└── server.ts                # HTTP + Socket.io
data/
└── games/                   # JSON de partidas (generados en runtime)
```

---

## Cómo ejecutar

### 1. Instalar dependencias

```bash
cd backend-server
npm install
```

### 2. Configurar entorno (opcional)

Copia `.env.example` a `.env`:

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
DATA_DIRECTORY=./data
JWT_SECRET=your-secret-key-here   # pendiente de uso
NIGHT_DURATION_MS=60000
DAY_DURATION_MS=60000
AUTO_ADVANCE=false
```

Si no existe `.env`, se usan valores por defecto desde `src/config/env.ts` (incluye `NIGHT_DURATION_MS`, `DAY_DURATION_MS`, `AUTO_ADVANCE`).

### 3. Modo desarrollo

```bash
npm run dev
```

Servidor en `http://localhost:3000` (o el `PORT` configurado).

### 4. Verificar salud

```bash
curl http://localhost:3000/health
# { "status": "ok", "ts": "..." }
```

---

## API REST

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Estado del servidor |
| `/` | GET | Mensaje de confirmación |

---

## Socket.io — Namespace `/game` (móvil)

Conexión: `io('http://<host>:<port>/game')`

### Cliente → servidor

| Evento | Parámetros | Descripción |
|--------|------------|-------------|
| `createRoom` | `roomId` | Rechazado — solo dashboard |
| `joinRoom` | `roomId`, `playerId`, `name?` | Unirse o reconectar |
| `leaveRoom` | `roomId`, `playerId` | Salir y eliminar jugador |
| `startGame` | `roomId` | Inicia partida (mín. 5 jugadores) |
| `advancePhase` | `roomId` | Avanza a la siguiente fase |
| `playerAction` | `roomId`, `action` | Acción nocturna (ver tabla de roles) |
| `submitVote` | `roomId`, `{ voter, target }` | Voto en fase VOTACIÓN |

### Servidor → cliente

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `roomState` | `roomId`, `state` | Estado filtrado por jugador (`maxPlayers`, `playerCount`, `players`) |
| `privateResult` | `roomId`, `payload` | Solo al socket del jugador afectado. Ver tabla de tipos abajo |
| `phaseChanged` | `roomId`, `phase` | Cambio de fase |
| `phaseTransition` | `{ roomId, from, to, at }` | Transición con timestamp |
| `incidentReport` | `{ roomId, nightNumber, eliminatedPlayerIds[], disconnected[] }` | Bajas nocturnas al amanecer. `disconnected` es alias de `eliminatedPlayerIds` (no desconexiones socket) |
| `nightResolved` | `roomId`, `resolution` | Payload **reducido** (sin `logs` ni `privateResults`). Ver tipos en `events.types.ts` |
| `voteTrace` | `{ roomId, voter, target, timestamp }` | Voto registrado |
| `voteTied` | `{ roomId, voteCount, candidates[], skipVotes, reason }` | Empate (`reason: 'tie'`) o sin votos de eliminación (`'no_votes'`) — nadie eliminado |
| `playerReconnected` | `roomId`, `playerId` | Jugador reconectado |
| `playerDisconnected` | `roomId`, `playerId` | Jugador desconectado |
| `playerEliminated` | `roomId`, `playerId`, `reason` | Jugador eliminado |
| `gameOver` | `roomId`, `winner`, `soloWinner?` | Fin de partida |
| `actionAccepted` | `actionId` | Acción aceptada |
| `error` | `message` | Error (acciones: mensaje legible + código entre paréntesis) |

#### Tipos de `privateResult.payload`

| `type` | Campos relevantes | Cuándo |
|--------|-------------------|--------|
| `role_assigned` | `role`, `team`, `displayName`, `nightAction`, `nightActionHint` | Inicio de partida / reconexión |
| `hacker_team` | `members[]` | Inicio de partida (roles Black Hat) |
| `scan` | `targetId`, `result: 'safe' \| 'malicious'` | Analista SOC |
| `spy` | `targetId`, `visitors[]` | Spyware |
| `infected` | `targetId`, `infectionSource`, `maturesAfterNight` | Gusano infecta (víctima) |
| `infection_warning` | `targetId`, `critical: true`, `maturesAfterNight` | Infección madura esta noche |
| `cured` | `targetId` | Antivirus cura infección |

#### `nightResolved` — tipos por namespace

**Móvil (`/game`)** — `PublicNightResolution` (sin `logs` ni `privateResults`):

```typescript
{
  kills: string[];
  prevented: { actionId: string; reason: string }[];
  redirects: { actionId: string; from: string; to: string }[];
  silenced: string[];
  honeypotDrags: { honeypotId: string; draggedId: string }[];
  infections: string[];
  cures: string[];
  infectionKills: string[];
}
```

**Dashboard (`/dashboard`)** — `NightResolution` completo (añade `logs[]` y `privateResults[]`).

---

## Socket.io — Namespace `/dashboard` (PC/TV)

Conexión: `io('http://<host>:<port>/dashboard')`

### Cliente → servidor

| Evento | Parámetros | Descripción |
|--------|------------|-------------|
| `createRoom` | `roomId`, `maxPlayers` | Crea sala (**maxPlayers obligatorio**, entre 5 y 15) |
| `joinDashboard` | `roomId` | Suscribirse a vista pública de la sala |
| `leaveDashboard` | `roomId` | Salir de la vista |
| `startGame` | `roomId` | Inicia partida |
| `advancePhase` | `roomId` | Avanza fase |

### Servidor → cliente

| Evento | Descripción |
|--------|-------------|
| `roomCreated` | `{ roomId, maxPlayers }` — sala creada (solo tras `createRoom`) |
| `publicState` | Topología pública (`maxPlayers`, `playerCount`, jugadores; rol visible si eliminado o FIN) |
| `incidentReport` | Bajas nocturnas (`eliminatedPlayerIds` / alias `disconnected`) |
| `nightResolved` | Resolución nocturna **completa** (incluye `logs`, `privateResults`, infecciones, curas) |
| `voteTrace` | Votos en tiempo real para animaciones |
| `voteTied` | Empate — `{ skipVotes, reason: 'tie' \| 'no_votes' }` |
| `playerReconnected` | `(roomId, playerId)` — jugador reconectado |
| `playerDisconnected` | `(roomId, playerId)` — jugador desconectado (socket) |
| `phaseTransition` | Señal para animaciones noche/día |
| `phaseChanged` | Fase actual |
| `playerEliminated` | `(roomId, playerId, reason)` |
| `gameOver` | Resultado final |
| `error` | Error |

Ver también [`../SOCKET_CONTRACT.md`](../SOCKET_CONTRACT.md) para flujos de integración y ejemplos de payload.

---

## Acciones nocturnas por rol

Payload base de `playerAction`:

```typescript
{
  id: string;           // ID único de la acción
  actor: string;        // playerId del actor
  role?: string;        // rol del actor (validado)
  type: string;         // tipo de acción (tabla abajo)
  target?: string;      // playerId objetivo
  timestamp: number;
  meta?: Record<string, any>;
}
```

| Rol | `type` | `meta` extra | Efecto |
|-----|--------|--------------|--------|
| Analista SOC | `scan` | — | Resultado privado `safe` / `malicious` |
| Antivirus | `protect` **o** `cure` (una por noche) | — | Solo una acción: bloquear kill o curar infección. Cooldown independiente por objetivo |
| Pentester | `pentester_kill` | — | Kill letal (2 usos; culpa si mata aliado) |
| Deep Freeze | `freeze` | — | Congela objetivo (no actúa esa noche) |
| Enrutador BGP | `bgp_swap` | `{ swapWith: playerId }` | Intercambia tráfico entre dos nodos |
| Honeypot | `honeypot_drag` | — | Define a quién arrastrar si muere |
| DDoS / Rootkit | `hacker_vote` | — | Voto conjunto hacker para kill nocturno |
| Ransomware | `ransomware` | — | Silencia objetivo al día siguiente |
| Spyware | `spy` | — | Revela visitantes al objetivo (privado) |
| Phisher | `phisher_redirect` | `{ redirectTo: playerId }` | Redirige voto diurno de la víctima |
| Gusano | `worm_infect` | — | Infecta al objetivo; muere la noche siguiente si no hay cura (`worm_kill` es alias). **Inmune a kills mientras vive** |
| Zero-Day | `zero_day_assume` | — | Asume rol de jugador ya eliminado |
| SysAdmin, Troll, Minero | — | — | Sin acción nocturna |

---

## Máquina de estados — detalle

| Fase | Descripción |
|------|-------------|
| **LOBBY** | Esperando jugadores; sin roles |
| **REPARTO** | Asignación de roles (transición rápida) |
| **NOCHE** | Acciones secretas en móvil; servidor resuelve al avanzar |
| **DÍA** | Reporte de incidentes (`incidentReport`); debate |
| **VOTACIÓN** | Votos públicos; mayoría elimina (Ban de IP) |
| **VERIFICACIÓN** | Comprueba victoria; continúa o pasa a `FIN` |
| **FIN** | Partida terminada |

Flujo cíclico: `VERIFICACIÓN → NOCHE` si nadie ha ganado.

---

## Condiciones de victoria

| Bando / rol | Condición |
|-------------|-----------|
| **System** | No quedan jugadores Black Hat vivos |
| **Black Hat** | Hackers vivos ≥ jugadores System vivos |
| **Troll** | Es baneado por votación diurna |
| **Gusano** | Es el único jugador vivo |
| **Minero de Cripto** | Único superviviente cuando caen los hackers |

**Notas:**
- No existe victoria de **equipo caótico** (`Team.CHAOTIC`). Troll, Gusano, Minero y Zero-Day ganan solo en solitario (o Zero-Day hereda victoria de bando; ver abajo).
- **Zero-Day**: no tiene victoria solitaria propia. Si asume el rol de un jugador System eliminado y no quedan hackers vivos, puede declarar victoria **System** como si fuera de ese bando (`assumedFromPlayerId` en metadata).

### Gusano — inmunidad
Mientras el Gusano está vivo, **ningún kill nocturno** puede eliminarlo (`tryKill` en `RuleEngine`). El flag `isWormImmune` en metadata es informativo para el cliente; no se consume.

### Phisher — alcance
`phisher_redirect` guarda en metadata un mapa `phisherRedirects[víctima] = redirectTo`. Solo afecta el **voto diurno** de la víctima en fase `VOTACION` (`resolvePhisherRedirect`). No redirige acciones nocturnas de otros jugadores.

---

## Persistencia

Cada partida se guarda en `data/games/<roomId>.json` (o en `DATA_DIRECTORY/games/`).

Campos relevantes del JSON:

```json
{
  "roomId": "room-test-1",
  "phase": "NOCHE",
  "phaseStartedAt": 1781639243150,
  "nightNumber": 1,
  "dayNumber": 0,
  "players": [
    {
      "id": "player-1",
      "name": "Tester",
      "isAlive": true,
      "isConnected": false,
      "role": "SysAdmin",
      "team": "system",
      "metadata": {}
    }
  ],
  "actionQueue": [],
  "votes": {},
  "logs": [],
  "lastNightKills": [],
  "winner": null,
  "soloWinner": null
}
```

Tras reinicio del servidor, al unirse un jugador a una sala existente se restaura el estado y la fase de la máquina de estados.

---

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NODE_ENV` | Entorno | `development` |
| `PORT` | Puerto HTTP | `3000` |
| `LOG_LEVEL` | Nivel de log | `info` |
| `DATA_DIRECTORY` | Directorio raíz de datos | `./data` |
| `JWT_SECRET` | Secreto JWT (pendiente) | — |
| `NIGHT_DURATION_MS` | Duración fase noche (auto-advance) | `60000` |
| `DAY_DURATION_MS` | Duración fase día (auto-advance) | `60000` |
| `AUTO_ADVANCE` | Avance automático de fases | `false` |

---

## Docker (desarrollo)

```bash
docker-compose -f docker-compose.yml config   # validar YAML
docker-compose up
```

Levanta Node 18 con el backend en el puerto 3000. MongoDB y frontends quedan a cargo del Integrante 4 según el documento maestro.

---

## Próximos pasos

- [ ] Autenticación JWT en conexión socket
- [ ] Tests unitarios (`RuleEngine`, `VictoryChecker`, `Matchmaking`)
- [ ] Adapter MongoDB (Integrante 4)
- [ ] Redis pub/sub para multi-instancia (opcional)
- [ ] Métricas y logging estructurado

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `Need at least 5 players to start` | Unir 5+ jugadores antes de `startGame` |
| `Room is full` | Máximo 15 jugadores por sala |
| `action rejected` | Verificar fase `NOCHE`, rol y tipo de acción. El mensaje incluye código entre paréntesis, ej. `(antivirus_cooldown)` |
| `vote rejected` | Votar solo en `VOTACION`; silenciados no pueden votar |
| Estado desincronizado tras crash | Revisar JSON en `data/games/`; reconectar con mismo `playerId` |
| Dashboard sin eventos | Conectar a namespace `/dashboard` y emitir `joinDashboard` |

---

Documento alineado con el **Firewall Protocol Master Document (GDD)** — Proyecto de Grado, Programación Móvil.
