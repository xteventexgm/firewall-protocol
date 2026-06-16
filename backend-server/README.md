# Firewall Protocol — Backend

Servidor realtime de juego basado en Node.js, Express, Socket.io y TypeScript.

**Estado**: Backend funcional con máquina de estados, matchmaking, motor de reglas, persistencia JSON y sockets en tiempo real.

**Stack**: TypeScript 5.9 + Node.js + Express 4.18 + Socket.io 4.7 + ts-node (dev)

## Características implementadas:

- Tipos TypeScript estrictos en `src/types/`:
  - `roles.types.ts`: catálogo de roles y equipos.
  - `events.types.ts`: fases del juego y contratos de eventos socket.

- Modelos en `src/models/`:
  - `PlayerProfile.ts`: `Player` y datos de perfil.
  - `GameState.ts`: `GameStateModel` con helpers para fases, colas y logs.

- Máquina de estados en `src/game/StateMachine.ts`:
  - Transiciones permitidas: LOBBY → REPARTO → NOCHE → DÍA → VOTACIÓN → VERIFICACIÓN.
  - Emite `phaseChanged` y expone `next()`.

- Matchmaking en `src/game/Matchmaking.ts`:
  - Asigna roles a 5–15 jugadores.
  - Aproxima 25% Hackers (redondeo al más cercano) y asigna el resto entre System y Chaotic.
  - RNG inyectable para pruebas deterministas.

- Motor de reglas en `src/game/RuleEngine.ts`:
  - Resolución de acciones nocturnas por prioridad.
  - Soporta protecciones (Antivirus), congelación (Deep Freeze), redirecciones (Honeypot/BGP) y resolución de ataques.

- Gestión de partidas en `src/game/Room.ts` y `src/game/RoomManager.ts`:
  - Aislamiento de salas, orquestación de fases, asignación de roles y resolución de noches.
  - Timers opcionales para auto-advance.

- Socket.io en `src/sockets/`:
  - `index.ts`: namespace `/game`.
  - `roomHandler.ts`: `joinRoom`, `leaveRoom`, `createRoom`.
  - `gameHandler.ts`: `playerAction`, `startGame`, `advancePhase`, `submitVote`.

- Persistencia ligera en `src/services/dbSyncService.ts`:
  - Guardado/lectura de estados de juego en `backend-server/data/games/*.json`.
  - Adapter simple en `src/config/database.ts`.

- Utilidades:
  - `src/utils/logger.ts`: logger simple.
  - `src/utils/constants.ts`: constantes de proyecto.
  - `src/config/env.ts`: configuración de entorno con valores por defecto.

Cómo ejecutar (desarrollo):

### 1. Instalar dependencias:

```bash
cd backend-server
npm install
```

### 2. Configurar entorno (opcional):

Crea `.env` en `backend-server/` con valores personalizados:

```bash
NODE_ENV=development
PORT=3000
JWT_SECRET=your-secret-key-here
DATA_DIRECTORY=./data/games
```

Si no existe `.env`, se usan valores por defecto desde `src/config/env.ts`.

### 3. Ejecutar en modo desarrollo:

```bash
npm run dev
```

El servidor iniciará en `http://localhost:3000` (o el puerto configurado en `.env`).

**Nota**: TypeScript se compila automáticamente vía ts-node.

### 4. Verificar salud del servidor:

```bash
curl http://localhost:3000/health
# Respuesta: { "status": "ok", "ts": "2026-06-16T..." }
```

### 5. Probar persistencia:

```bash
node test/test_persistence.js
```

Este script conecta un cliente socket.io, crea una sala, inicia el juego en fase NOCHE y valida que el estado se persista en `data/games/room-test-1.json`.

## Estructura de carpetas:

```
src/
├── types/               # Tipos TypeScript estrictos
│   ├── events.types.ts  # Fases, acciones, eventos socket
│   ├── roles.types.ts   # Catálogo de roles y equipos
│   └── index.ts         # Exports
├── models/              # Clases de datos
│   ├── PlayerProfile.ts # Clase Player
│   ├── GameState.ts     # Clase GameStateModel
│   └── index.ts         # Exports
├── game/                # Lógica de juego
│   ├── StateMachine.ts  # Máquina de estados (LOBBY→REPARTO→NOCHE→DÍA→VOTACIÓN→VERIFICACIÓN)
│   ├── Matchmaking.ts   # Asignación de roles (~25% Hackers)
│   ├── RuleEngine.ts    # Resolución de acciones nocturnas por prioridad
│   ├── Room.ts          # Gestión de partida aislada, orquestación, persistencia
│   └── RoomManager.ts   # CRUD de salas
├── sockets/             # Manejo de conexiones Socket.io
│   ├── index.ts         # Namespace `/game` y setup
│   ├── roomHandler.ts   # Eventos: joinRoom, leaveRoom, createRoom
│   └── gameHandler.ts   # Eventos: playerAction, startGame, advancePhase, submitVote
├── services/            # Lógica de negocio
│   └── dbSyncService.ts # Persistencia: read/write JSON en data/games/*.json
├── config/              # Configuración
│   ├── database.ts      # Adapter persistencia (envuelve dbSyncService)
│   └── env.ts           # Variables de entorno con defaults
├── utils/               # Utilidades
│   ├── logger.ts        # Logger simple con timestamps
│   └── constants.ts     # Constantes del proyecto
├── app.ts               # Aplicación Express
└── server.ts            # Inicialización servidor + Socket.io
test/
└── test_persistence.js  # Script de prueba de persistencia
data/
└── games/               # Archivos JSON de partidas (generados en tiempo de ejecución)
```

## Persistencia:

La persistencia actual es **JSON en disco** (`data/games/*.json`). Cada partida se guarda en un archivo con el ID de la sala.

### Ejemplo de archivo persistido:

```json
{
  "roomId": "room-test-1",
  "phase": "NOCHE",
  "phaseStartedAt": 1781639243150,
  "nightNumber": 1,
  "dayNumber": 0,
  "players": [
    {
      "id": "player-test-1",
      "name": "Tester",
      "socketId": "26pOX_9yWHBpjgxqAAAB",
      "isAlive": true,
      "joinedAt": 1781639242627,
      "pendingActions": []
    }
  ],
  "actionQueue": [],
  "votes": {},
  "logs": []
}
```

## API REST:

## API REST:

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Verifica que el servidor está activo |
| `/` | GET | Mensaje de confirmación |

## Socket.io — Eventos:

### Namespace: `/game`

**Emitidos desde cliente:**
- `createRoom(roomId: string, playerId: string, playerName: string)` — Crear sala
- `joinRoom(roomId: string, playerId: string, playerName: string)` — Unirse a sala
- `leaveRoom(roomId: string, playerId: string)` — Salir de sala
- `startGame(roomId: string)` — Iniciar juego (asigna roles, entra en NOCHE)
- `advancePhase(roomId: string)` — Avanzar a siguiente fase
- `playerAction(roomId: string, playerId: string, action: PlayerAction)` — Ejecutar acción nocturna
- `submitVote(roomId: string, playerId: string, votedPlayerId: string)` — Votar en fase VOTACIÓN

**Recibidos en cliente:**
- `roomState(state: GameStateModel)` — Estado completo de la partida
- `phaseChanged(phase: GamePhase, nightNumber?: number)` — Notificación de cambio de fase
- `nightResolved(log: string)` — Acciones nocturnas resueltas

## Máquina de estados:

```
LOBBY → REPARTO → NOCHE → DÍA → VOTACIÓN → VERIFICACIÓN → (NOCHE o FIN)
```

- **LOBBY**: Esperando jugadores, sin roles asignados
- **REPARTO**: Roles asignados, transición instantánea
- **NOCHE**: Acciones concurrentes resueltas por RuleEngine (en orden: Kill → Protect → Freeze → Redirect)
- **DÍA**: Fase sin acciones (navegación manual o con timer)
- **VOTACIÓN**: Votación para eliminar jugador
- **VERIFICACIÓN**: Validación de condición de victoria

## Motor de reglas (RuleEngine):

Resuelve acciones nocturnas en prioridad:

1. **Kill** — Ataque directo (prioridad máxima)
2. **Protect** — Protección (Antivirus)
3. **Freeze** — Congelación (Deep Freeze)
4. **Redirect** — Redirección (Honeypot/BGP)

Protecciones y redirecciones pueden modificar/anular ataques. Las protecciones se aplican antes de matar jugadores.

## Próximos pasos recomendados:

- [ ] Pruebas unitarias para `RuleEngine` y `Matchmaking`
- [ ] Validación de JWT en sockets (autenticación)
- [ ] Migración a MongoDB o Postgres para persistencia robusta
- [ ] Redis pub/sub para multi-instancia (replicación de eventos)
- [ ] Lógica completa de verificación y votación
- [ ] Logging estructurado y métricas (Prom/ELK)
- [ ] Docker Compose configuración final

## Docker (experimental):

Existe `docker-compose.yml` para ambiente local. Valida la sintaxis YAML:

```bash
docker-compose -f docker-compose.yml config
```

Si es necesario ajustar, verificar que `docker-compose.yml` usa espacios (no tabs).

## Troubleshooting:
