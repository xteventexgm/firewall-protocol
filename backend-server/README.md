# Firewall Protocol — Backend

Resumen del estado actual del backend implementado (Node.js + Express + Socket.io + TypeScript).

Estado: prototipo funcional minimalista

Características implementadas:

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

1. Instalar dependencias:

```powershell
cd backend-server
npm install
```

2. Ejecutar en modo desarrollo (requiere `ts-node` instalado por devDependencies):

```powershell
npm run dev
```

3. Probar endpoint de salud:

```powershell
curl http://localhost:3000/health
```

Notas y próximos pasos recomendados:

- Añadir pruebas unitarias para `RuleEngine` y `Matchmaking`.
- Implementar validaciones y autenticación de sockets.
- Extender `dbSyncService` para soporte de bases de datos reales (Postgres, MongoDB) si es necesario.
- Completar lógica de verificación y de votación avanzada.
- Añadir logging estructurado y métricas.

Si quieres, puedo:
- Añadir pruebas unitarias para `RuleEngine` ahora.
- Implementar autenticación básica por token en sockets.
- Mejorar la persistencia con SQLite/Postgres.
