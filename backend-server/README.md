> **Contrato socket compartido**: ver [`../SOCKET_CONTRACT.md`](../SOCKET_CONTRACT.md) en la raíz del monorepo.

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
- Gusano inmune + kill propio, Minero con 3 escudos, Zero-Day asume rol eliminado
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
- **Empate o sin votos de eliminación** → nadie eliminado, evento `voteTied`, salto directo a `NOCHE`
- Voto en blanco (`target: null`) se registra bajo clave `skip` (no cuenta para eliminar)
- Phisher redirige votos en secreto
- **Victoria por bando**: System elimina hackers / Black Hat iguala o supera en número
- **Victoria solitaria**: Troll (baneado), Gusano (último en pie), Minero (único superviviente)

### Información pública vs privada
- `toPlainForPlayer(viewerId)` — estado móvil con roles ajenos ocultos
- `toPublicState()` — estado dashboard sin secretos
- `privateResult` — rol propio, equipo hacker, escaneos, espionaje
- `incidentReport` — caídas nocturnas sin revelar atacante
- `voteTrace` — trazado de votos para animaciones del dashboard

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
test/
└── test_persistence.js      # Prueba manual de persistencia
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

Si no existe `.env`, se usan valores por defecto desde `src/config/env.ts`.

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

### 5. Prueba de persistencia

```bash
node test/test_persistence.js
```

Conecta un cliente a `/game`, crea sala, inicia partida y valida el JSON en `data/games/room-test-1.json`.

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
| `privateResult` | `roomId`, `payload` | Rol, equipo hacker, scan, spy |
| `phaseChanged` | `roomId`, `phase` | Cambio de fase |
| `phaseTransition` | `{ roomId, from, to, at }` | Transición con timestamp |
| `incidentReport` | `{ roomId, nightNumber, disconnected[] }` | Reporte de amanecer |
| `nightResolved` | `roomId`, `resolution` | Resolución nocturna |
| `voteTrace` | `{ roomId, voter, target, timestamp }` | Voto registrado |
| `voteTied` | `{ roomId, voteCount, candidates[] }` | Empate en votación — nadie eliminado |
| `playerReconnected` | `roomId`, `playerId` | Jugador reconectado |
| `playerDisconnected` | `roomId`, `playerId` | Jugador desconectado |
| `playerEliminated` | `roomId`, `playerId`, `reason` | Jugador eliminado |
| `gameOver` | `roomId`, `winner`, `soloWinner?` | Fin de partida |
| `actionAccepted` | `actionId` | Acción aceptada |
| `error` | `message` | Error |

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
| `roomCreated` | `{ roomId, maxPlayers }` — sala creada |
| `publicState` | Topología pública (`maxPlayers`, `playerCount`, jugadores sin roles) |
| `incidentReport` | Nodos desconectados tras la noche |
| `voteTrace` | Votos en tiempo real para animaciones |
| `voteTied` | Empate en votación — sin eliminación |
| `phaseTransition` | Señal para animaciones noche/día |
| `phaseChanged` | Fase actual |
| `gameOver` | Resultado final |
| `error` | Error |

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
| Gusano | `worm_infect` | — | Infecta al objetivo; muere la noche siguiente si no hay cura (`worm_kill` es alias) |
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
      "metadata": {},
      "pendingActions": []
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
| `action rejected` | Verificar fase `NOCHE`, rol y tipo de acción |
| `vote rejected` | Votar solo en `VOTACION`; silenciados no pueden votar |
| Estado desincronizado tras crash | Revisar JSON en `data/games/`; reconectar con mismo `playerId` |
| Dashboard sin eventos | Conectar a namespace `/dashboard` y emitir `joinDashboard` |

---

Documento alineado con el **Firewall Protocol Master Document (GDD)** — Proyecto de Grado, Programación Móvil.
