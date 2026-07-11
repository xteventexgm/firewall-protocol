# Firewall Protocol — Auditoría Independiente v3.0

> **Fecha**: 2026-07-11  
> **Método**: Inspección completa del código fuente (backend, mobile-terminal, web-dashboard) sin referencia a auditorías previas.  
> **Criterio**: Solo se incluyen propuestas que resuelven un problema real, mejoran significativamente la experiencia, reducen fricción, corrigen inconsistencias, simplifican complejidad, aumentan profundidad estratégica, mejoran inmersión o rendimiento.

---

## Resumen Ejecutivo

El proyecto presenta una arquitectura bien organizada (monorepo de 3 módulos), un game loop completo con 25+ roles, sistema de chat por canales, minijuegos nocturnos, reconexión automática, persistencia dual (JSON/MongoDB), y un dashboard web con topología SVG animada. El nivel de pulido post-mejora es notablemente alto.

Sin embargo, se identifican **18 propuestas** distribuidas en las siguientes categorías:

| Categoría | Propuestas | Críticas (★★★★★) |
|-----------|:----------:|:-----------------:|
| Seguridad & Integridad | 3 | 2 |
| Networking & Resiliencia | 3 | 1 |
| Game Design & Balance | 4 | 0 |
| UX & Game Feel | 4 | 1 |
| Rendimiento & Escalabilidad | 2 | 0 |
| Calidad de Código | 2 | 0 |

---

## Áreas que ya están suficientemente bien diseñadas

Antes de las propuestas, estas áreas **no requieren intervención**:

- ✅ **Máquina de estados de fases** — Grafo de transiciones estricto con validación. Sólido.
- ✅ **Sistema de roles y catálogo** — 25+ roles con balance documentado en `balance.ts`. Escalado por mesa.
- ✅ **Reconexión automática** — Watchdog de 5s, auto-rejoin desde localStorage, distinción voluntary/transport.
- ✅ **Chat multi-canal** — Público/dead/hacker con rate-limit, burst-limit, restricciones por fase. Correcto.
- ✅ **Vinculación socket↔jugador** — `socketPlayerBinding.ts` previene suplantación con `assertSocketActor`.
- ✅ **Minijuegos nocturnos** — Degradación de acción si se falla, integrado en `RuleEngine`.
- ✅ **Sistema de sonido** — Procedural + archivos, silenciamiento nocturno, unlock de AudioContext.
- ✅ **Hápticos** — Patrones diferenciados por evento (confirm, death, victory, timer tick).
- ✅ **Persistencia dual** — JSON/MongoDB con selección automática y warm cache.
- ✅ **Topología SVG del dashboard** — Layout radial con animaciones de muerte, pulso de eventos, boot sequence.

---

## Propuestas de Mejora

---

### A01 — Dashboard sin autenticación: cualquier navegador controla cualquier partida

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★★★ |
| **Complejidad** | Media |

**Problema detectado**  
El namespace `/dashboard` no tiene autenticación. Cualquier persona que conozca el roomId puede emitir `startGame`, `advancePhase`, `kickPlayer` o `abandonLobby` desde una consola de desarrollador en cualquier navegador.

**Por qué ocurre**  
[dashboardHandler.ts](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/backend-container/game-realtime/src/sockets/dashboardHandler.ts) registra handlers directamente sin verificar la identidad del emisor ni comparar contra el socket que creó la sala.

**Impacto en la experiencia**  
Un jugador malintencionado puede destruir la partida de todos: cerrar el lobby, iniciar prematuramente, o expulsar jugadores.

**Propuesta de solución**  
1. Al crear sala (`createRoom`), asociar el `socket.id` como `hostSocketId` en `Room`.
2. En `startGame`, `advancePhase`, `kickPlayer`, `abandonLobby`, verificar que `socket.id === room.hostSocketId`.
3. En reconexión del dashboard, permitir reasignación de host si el socket original ya no existe (con timeout de gracia).

**Dependencias**: Ninguna.  
**Riesgos**: Si el host se desconecta sin timeout, nadie puede controlar la partida. Mitigar con herencia de host.  
**Beneficio esperado**: Cierra la vulnerabilidad de control no autorizado más grave del sistema.

---

### A02 — Tipo `any` en acciones del cliente permite inyección de campos arbitrarios

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★★★ |
| **Complejidad** | Baja |

**Problema detectado**  
El handler `playerAction` en [gameHandler.ts L13](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/backend-container/game-realtime/src/sockets/gameHandler.ts#L13) recibe `action: any` y lo pasa directamente a `room.submitAction(action)` sin sanitizar. Similarmente, `submitVote` recibe `vote: any`.

**Por qué ocurre**  
El código confía en que el cliente envía estructuras bien formadas. No hay validación de schema en el borde del socket.

**Impacto en la experiencia**  
Un cliente modificado podría enviar campos `meta` con valores inesperados que alteren la resolución nocturna (ej. `meta.minigameResult: 'success'` sin haber completado el minijuego).

**Propuesta de solución**  
1. Crear una función `sanitizePlayerAction(raw: unknown): PlayerAction | null` que valide:
   - `id`, `actor`, `type` son strings no vacíos.
   - `target` es string o undefined.
   - `meta` solo contiene claves conocidas (`swapWith`, `redirectTo`, `routeTo`, `hijackTo`, `messageIndex`, `challengeToken`, `challengeAnswer`).
   - Rechazar campos desconocidos.
2. Aplicar en `playerAction`, `submitVote`, `submitChat` y `setPlayerReady`.

**Dependencias**: Ninguna.  
**Riesgos**: Bajo. Solo rechaza payloads malformados.  
**Beneficio esperado**: Elimina superficie de ataque por inyección de datos.

---

### A03 — El `chatMessage` se broadcastea a toda la room incluyendo el canal hacker

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★★☆ |
| **Complejidad** | Baja |

**Problema detectado**  
En [roomBridge.ts L86-92](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/backend-container/game-realtime/src/sockets/roomBridge.ts#L86-L92), el evento `chatMessage` se emite a toda la room del namespace `/game`:
```ts
gameNs.to(roomId).emit('chatMessage', roomId, message);
```
Esto envía mensajes del canal `hacker` y `dead` a **todos** los jugadores conectados, incluyendo jugadores System vivos.

**Por qué ocurre**  
El filtrado de canal ocurre solo en el **cliente** (`getChatForPlayer` en `ChatManager.ts`), no en la emisión del servidor.

**Impacto en la experiencia**  
Un jugador que intercepte los WebSocket frames (ej. con las DevTools del navegador o un proxy) puede leer los mensajes privados del equipo hacker. Esto rompe el juego.

**Propuesta de solución**  
En `roomBridge.ts`, al emitir `chatMessage`:
- Si `message.channel === 'hacker'`: emitir solo a sockets de jugadores con `team === 'black_hat'` y `isAlive`.
- Si `message.channel === 'dead'`: emitir solo a sockets de jugadores muertos.
- Si `message.channel === 'public'`: broadcast normal.

**Dependencias**: Ninguna.  
**Riesgos**: Ninguno funcional. Solo necesita iterar jugadores en vez de usar `to(roomId)`.  
**Beneficio esperado**: Cierra un leak de información que invalida la mecánica de chat secreto.

---

### A04 — `broadcastRoomState` envía `toPlainForPlayer` pero no filtra chat correctamente

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★★☆ |
| **Complejidad** | Baja |

**Problema detectado**  
Relacionado con A03. En [roomBridge.ts L10-16](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/backend-container/game-realtime/src/sockets/roomBridge.ts#L10-L16), `broadcastRoomState` envía `room.state.toPlainForPlayer(p.id)` a cada jugador. Esto presupone que `toPlainForPlayer` filtra los mensajes de chat por canal. Si no lo hace, todo el array `chatMessages` (incluyendo los del canal hacker) viaja en el `roomState` completo.

**Por qué ocurre**  
El método `toPlainForPlayer` necesita llamar a `getChatForPlayer` y solo incluir mensajes visibles para ese jugador.

**Impacto en la experiencia**  
Mismo impacto que A03: leak de chat hacker vía el payload de `roomState`.

**Propuesta de solución**  
Verificar que `toPlainForPlayer(playerId)` incluya `chatMessages: getChatForPlayer(this, playerId)` en lugar del array crudo.

**Dependencias**: A03.  
**Riesgos**: Ninguno.  
**Beneficio esperado**: Complementa A03 cerrando el segundo vector de filtración.

---

### A05 — Ausencia de heartbeat explícito: desconexiones en redes inestables tardan en detectarse

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★★☆ |
| **Complejidad** | Baja |

**Problema detectado**  
El backend no implementa un ping/pong heartbeat aplicativo. Socket.IO tiene `pingTimeout` y `pingInterval` nativos (default 20s/25s), pero estos no se configuran explícitamente. En redes móviles inestables (WiFi → datos, túneles), el transport puede quedar en limbo 30-60 segundos antes de que el servidor detecte la desconexión.

**Por qué ocurre**  
Se confía en los defaults de Socket.IO sin ajustar para el caso de uso móvil.

**Impacto en la experiencia**  
- Un jugador que pierde red durante la noche puede perder su turno porque el server no sabe que se desconectó a tiempo.
- Otros jugadores ven al nodo como "conectado" cuando ya no lo está.

**Propuesta de solución**  
1. Configurar `pingTimeout: 10000, pingInterval: 15000` en el servidor Socket.IO.
2. Opcionalmente, implementar heartbeat aplicativo: el cliente envía `heartbeat` cada 8s; si el server no recibe 2 consecutivos, marca desconectado.

**Dependencias**: Ninguna.  
**Riesgos**: Bajo. PingInterval más corto aumenta tráfico mínimamente.  
**Beneficio esperado**: Detección de desconexión 2-3x más rápida en redes inestables.

---

### A06 — Reconexión de dashboard puede generar doble bridge

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★☆☆ |
| **Complejidad** | Baja |

**Problema detectado**  
En [roomBridge.ts L24-25](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/backend-container/game-realtime/src/sockets/roomBridge.ts#L24-L25), la protección contra doble-bridge usa `(room as any)._bridged`. Si el dashboard se desconecta y reconecta a la misma sala, `joinDashboard` llama `getOrRestoreRoom` que puede crear una nueva instancia de Room (desde persistencia) sin `_bridged`, resultando en un segundo bridge con listeners duplicados.

**Por qué ocurre**  
`_bridged` vive en la instancia de `Room`. Si `RoomManager` restaura la sala desde disco, crea nueva instancia.

**Impacto en la experiencia**  
Emisiones duplicadas de eventos al dashboard (publicState doble, phaseChanged doble), causando renders innecesarios y posible confusión visual.

**Propuesta de solución**  
Verificar que `getOrRestoreRoom` retorne la misma instancia si ya existe en memoria. Solo restaurar desde disco si no está en `RoomManager.rooms`.

**Dependencias**: Ninguna.  
**Riesgos**: Bajo.  
**Beneficio esperado**: Elimina bugs de doble-render en reconexión del dashboard.

---

### A07 — `Room.ts` es un God Object de 930 líneas con demasiadas responsabilidades

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★☆☆ |
| **Complejidad** | Media |

**Problema detectado**  
[Room.ts](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/backend-container/game-realtime/src/game/Room.ts) maneja:
- Ciclo de vida de jugadores (add/remove/kick/reconnect/leave)
- Lógica de fases (start/advance/schedule)
- Acciones nocturnas (submit/validate/queue)
- Votos (submit/resolve/clear effects)
- Chat (submit/push system messages)
- Minijuegos
- Persistencia (database.save en cada método)
- Emisión de eventos

**Por qué ocurre**  
Crecimiento orgánico. Cada feature nueva se añadió al orquestador principal.

**Impacto en la experiencia**  
No afecta al usuario directamente, pero dificulta el mantenimiento, testing y extensión. Un cambio en votos puede romper accidentalmente el chat.

**Propuesta de solución**  
Extraer módulos sin cambiar la API pública:
1. `RoomLifecycle.ts` — add/remove/kick/reconnect/leave player.
2. `RoomPhases.ts` — startGame/advancePhase/scheduleTimeout.
3. `RoomVoting.ts` — submitVote/resolveVotes/clearVoteChaosEffects.

Room se convierte en fachada delegando a estos módulos.

**Dependencias**: Ninguna.  
**Riesgos**: Refactor grande, requiere tests de regresión.  
**Beneficio esperado**: Mantenibilidad y testabilidad significativamente mejoradas.

---

### A08 — `DashboardPage.ts` móvil tiene 2143 líneas — complejidad extrema en un solo componente

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★☆☆ |
| **Complejidad** | Media-Alta |

**Problema detectado**  
[dashboard.page.ts](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/mobile-terminal/src/app/pages/dashboard/dashboard.page.ts) maneja 45+ propiedades de estado, 30+ suscripciones, lógica de UI para todas las fases, chat, minijuegos, votación, rol briefing, threat briefing, death alerts, last will, game over, timers, haptics, y sonido.

**Por qué ocurre**  
Angular con Ionic tiende a centralizar la vista en un componente principal por página.

**Impacto en la experiencia**  
- Change detection innecesaria: cualquier cambio en 1 propiedad re-evalúa las 45+ bindings del template.
- Riesgo de memory leaks si alguna suscripción no se limpia (hay 25+ `subs.add` y 10+ `setTimeout`/`setInterval` manuales).

**Propuesta de solución**  
Extraer sub-componentes standalone:
1. `NightActionPanelComponent` — acción nocturna + minijuego.
2. `VotePanelComponent` — selección de voto, progreso, timer urgente.
3. `GameHeaderComponent` — fase, countdown, match elapsed.
4. `RoleBriefingOverlayComponent` (ya se podría separar de la página).

Usar `OnPush` change detection en cada sub-componente.

**Dependencias**: Ninguna.  
**Riesgos**: Refactor de template + lógica, pero los sub-componentes son aditivos.  
**Beneficio esperado**: Rendimiento de rendering mejorado, mantenibilidad radical.

---

### A09 — `database.save` síncrono en cada acción bloquea el event loop

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★☆☆ |
| **Complejidad** | Baja |

**Problema detectado**  
En `Room.ts`, casi cada método llama `database.save(this.id, this.state.toPlain())` de forma síncrona dentro de un `try/catch`. Esto serializa el estado completo (potencialmente grande con chatMessages, publicLogs, actionQueue) y lo escribe a disco/DB en el hilo principal.

**Por qué ocurre**  
Prioridad de durabilidad sobre rendimiento. Cada mutación persiste inmediatamente.

**Impacto en la experiencia**  
En partidas grandes (10-15 jugadores), con 120 mensajes de chat y 50+ logs públicos, `toPlain()` + JSON.stringify + write puede tomar 5-15ms por operación. En una noche con 15 acciones, eso suma ~100ms de bloqueo acumulado.

**Propuesta de solución**  
Debounce de persistencia:
1. Marcar `this.dirty = true` en cada mutación.
2. Usar `setImmediate` o `process.nextTick` para agrupar saves: si ya hay un save programado, no programar otro.
3. Save explícito en transiciones de fase (momento crítico).

```ts
private scheduleSave(): void {
  if (this._saveScheduled) return;
  this._saveScheduled = true;
  process.nextTick(() => {
    this._saveScheduled = false;
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Save fail', e); }
  });
}
```

**Dependencias**: Ninguna.  
**Riesgos**: Pérdida de 1 tick de datos si el proceso muere entre mutación y save. Aceptable dado que ya hay try/catch que traga errores.  
**Beneficio esperado**: Reduce escrituras de ~20/ciclo a ~3/ciclo, libera event loop.

---

### A10 — El estado del juego viaja completo en cada `refresh()`: sin delta/patching eficiente

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★☆☆ |
| **Complejidad** | Media |

**Problema detectado**  
`broadcastRoomState` en [roomBridge.ts](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/backend-container/game-realtime/src/sockets/roomBridge.ts#L10-L16) envía el estado completo a cada jugador en cada acción aceptada, cada voto, cada chat, cada reconexión. Para 15 jugadores, cada `refresh()` genera 15 emisiones del estado completo (potencialmente 5-10 KB por emisión).

**Por qué ocurre**  
El `refresh` se llama en `actionAccepted`, `rolesAssigned`, `playerJoined`, `playerLeft`, `playerKicked`, `voteRecorded`, `voteTied`, `playerReconnected`, `playerDisconnected`, `playerEliminated`, `chatMessage`, `phaseConfigChanged`, `incidentReport`, `nightResolved`, `gameOver`.

**Impacto en la experiencia**  
En una noche activa con 15 jugadores enviando acciones + chat, el servidor emite ~150-300 KB/s de datos redundantes. En redes móviles lentas, esto puede causar lag perceptible.

**Propuesta de solución**  
1. Para eventos granulares (`voteRecorded`, `chatMessage`, `playerConnected`), el cliente ya tiene un `patchGameState`/`patchPlayerField` en `SocketService`. Eliminar `refresh()` de estos handlers del bridge.
2. Mantener `refresh()` solo en cambios de fase, game over, e inicio de partida.
3. Los eventos específicos ya se emiten (`voteTrace`, `chatMessage`, etc.) — el cliente los consume directamente.

**Dependencias**: Verificar que el cliente aplique correctamente todos los patches sin necesidad de refresh completo.  
**Riesgos**: Si el cliente pierde un evento, el estado se desincroniza. Mitigar con un `requestFullState` periódico (ej. cada 30s).  
**Beneficio esperado**: Reducción de ~80% del tráfico de red durante partida activa.

---

### A11 — No hay timeout para jugadores AFK en noche: la fase puede bloquearse indefinidamente

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★★☆ |
| **Complejidad** | Baja |

**Problema detectado**  
Si `autoAdvance` está deshabilitado (modo manual del host), la fase NOCHE espera indefinidamente hasta que el host presione "avanzar". Pero incluso con `autoAdvance`, si un jugador no envía su acción, su turno simplemente se salta sin feedback explícito — no hay alerta al host de que alguien está AFK.

**Por qué ocurre**  
El sistema de `nightProgress` muestra qué jugadores han actuado, pero no tiene acción correctiva automática ni alertas al host.

**Impacto en la experiencia**  
En modo manual, un solo jugador que olvide actuar (o se quede dormido con el celular) bloquea a todos. El host debe adivinar cuándo "avanzar". En modo automático, es menos grave pero el jugador AFK no recibe consecuencia.

**Propuesta de solución**  
1. En modo manual: cuando todos los jugadores vivos hayan actuado (nightProgress 100%), emitir `allActionsSubmitted` al dashboard para que el host sepa que puede avanzar.
2. Mostrar un badge visual en el dashboard indicando "Todas las acciones recibidas — Avanzar fase".
3. Opcionalmente, auto-avanzar tras 10s adicionales si todos actuaron (configurable por el host).

**Dependencias**: Ninguna.  
**Riesgos**: Ninguno.  
**Beneficio esperado**: Reduce tiempos muertos significativamente en modo manual.

---

### A12 — Ausencia de confirmación visual de voto propio en el dashboard web

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★☆☆ |
| **Complejidad** | Baja |

**Problema detectado**  
En el cliente móvil, cuando un jugador vota, `myVoteConfirmed` se activa y muestra feedback visual. Pero en el dashboard web (host), no hay indicación clara de que **todos** los votos fueron recibidos ni de la distribución actual.

**Por qué ocurre**  
El dashboard recibe `voteTrace` individuales y las visualiza como líneas en la topología, pero no tiene un resumen agregado de votos emitidos vs faltantes.

**Impacto en la experiencia**  
El host no sabe cuántos votos faltan antes de decidir avanzar la fase. Debe contar manualmente las líneas de voto en la topología.

**Propuesta de solución**  
1. Mostrar un badge en la interfaz del dashboard: "Votos: 7/12" con progreso visual.
2. Cuando todos hayan votado, mostrar "Todos los votos recibidos — Avanzar fase" con un highlight visual.

**Dependencias**: Ninguna.  
**Riesgos**: Ninguno.  
**Beneficio esperado**: El host toma decisiones informadas sobre cuándo avanzar.

---

### A13 — Sonido silenciado por defecto en móvil sin indicación clara de cómo activarlo

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★★☆ |
| **Complejidad** | Baja |

**Problema detectado**  
`soundMuted = true` es el default en [dashboard.page.ts L116](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/mobile-terminal/src/app/pages/dashboard/dashboard.page.ts#L116). El jugador entra a la partida y no escucha nada. El toggle de sonido es un icono sin tooltip visible. Nuevos jugadores no saben que el juego tiene audio.

**Por qué ocurre**  
Decisión de diseño (terminal anónima en mesa), pero sin onboarding que explique por qué no hay sonido ni cómo activarlo.

**Impacto en la experiencia**  
Se pierde toda la inversión en audio procedural, SFX, y ambient sounds. Los jugadores nuevos piensan que el juego no tiene sonido. El game feel se degrada significativamente.

**Propuesta de solución**  
1. En la primera partida (detectable vía `localStorage.getItem('fp_sound_prompted')` === null), mostrar un mini-toast al entrar al dashboard: "🔊 Activa el sonido para una experiencia completa" con botón "Activar" que ejecute `toggleSound()` y persista la preferencia.
2. Si el jugador ignora el toast, respetar el mute y guardar la preferencia.

**Dependencias**: Ninguna.  
**Riesgos**: Ninguno.  
**Beneficio esperado**: Más jugadores descubren y disfrutan del audio del juego.

---

### A14 — El sistema `console.log` con `[DEBUG JOIN]` está en producción

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★☆☆ |
| **Complejidad** | Trivial |

**Problema detectado**  
En [roomHandler.ts L43-49](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/backend-container/game-realtime/src/sockets/roomHandler.ts#L43-L49), hay múltiples `console.log` con el prefijo `[DEBUG JOIN]`:
```ts
console.log(`[DEBUG JOIN] playerId=${playerId}, opts.userId=${opts?.userId}, opts.accessToken?=${!!opts?.accessToken}`);
```

**Por qué ocurre**  
Debugging residual que no se limpió antes de merge.

**Impacto en la experiencia**  
- Contamina logs de producción con ruido, dificultando diagnóstico real.
- Filtra metadatos de autenticación (userId, presence of accessToken) en stdout.

**Propuesta de solución**  
Reemplazar `console.log` por `logger.debug` con nivel configurable, o eliminar completamente.

**Dependencias**: Ninguna.  
**Riesgos**: Ninguno.  
**Beneficio esperado**: Logs de producción limpios y seguros.

---

### A15 — `setPlayerReady` tiene logging excesivo con `logger.info`/`logger.error` en paths normales

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★☆☆☆ |
| **Complejidad** | Trivial |

**Problema detectado**  
En [gameHandler.ts L117-141](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/backend-container/game-realtime/src/sockets/gameHandler.ts#L117-L141), cada llamada a `setPlayerReady` produce 2-3 líneas de log, incluyendo success path. En un lobby de 15 jugadores, cada toggle de ready genera 15 logs.

**Por qué ocurre**  
Debugging detallado de un feature en desarrollo que no se redujo para producción.

**Impacto en la experiencia**  
Ruido en logs que dificulta encontrar problemas reales.

**Propuesta de solución**  
Reducir a `logger.debug` en success path, mantener `logger.error` solo en excepciones.

**Dependencias**: Ninguna.  
**Riesgos**: Ninguno.  
**Beneficio esperado**: Logs más limpios.

---

### A16 — Pentester que mata a un aliado System muere él también — sin feedback suficiente

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★★☆☆ |
| **Complejidad** | Baja |

**Problema detectado**  
En [RuleEngine.ts L634-644](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/backend-container/game-realtime/src/game/RuleEngine.ts#L634-L644), cuando un Pentester mata a un compañero System, el Pentester también muere ("died during authorized penetration test"). Sin embargo:
1. El jugador Pentester no recibe un `privateResult` que explique por qué murió.
2. La descripción del rol y el `nightActionHint` no advierten claramente sobre esta consecuencia.

**Por qué ocurre**  
La muerte del Pentester es un log interno y un `res.kills.push`, pero no genera un `privateResult` al actor.

**Impacto en la experiencia**  
El Pentester muere sin entender por qué. Frustración extrema, especialmente para jugadores nuevos.

**Propuesta de solución**  
1. Añadir un `privateResult` al Pentester: `{ type: 'pentester_suicide', targetId, reason: 'Eliminaste a un aliado System. Ejecución de protocolo de contención.' }`.
2. Asegurar que el `nightActionHint` del Pentester incluya: "⚠ Si tu objetivo es del equipo System, morirás también."

**Dependencias**: Ninguna.  
**Riesgos**: Ninguno.  
**Beneficio esperado**: El Pentester toma decisiones informadas y entiende las consecuencias.

---

### A17 — Espectadores no tienen experiencia dedicada — ven un `roomState` parcial sin contexto

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★☆☆☆ |
| **Complejidad** | Media |

**Problema detectado**  
En [roomHandler.ts L170-176](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/backend-container/game-realtime/src/sockets/roomHandler.ts#L170-L176), cuando un jugador intenta unirse a una partida en curso, se le deja "como espectador" pero:
1. Se emite `roomState` sin filtrar — el espectador ve el mismo estado que un jugador vivo.
2. No tiene rol ni equipo, pero ve los mensajes públicos y la topología.
3. No tiene capacidad de interactuar de ninguna forma.
4. No se le informa que es espectador.

**Por qué ocurre**  
El manejo de espectadores es un fallback de error (`RoomJoinDeniedError`) en vez de un flujo diseñado.

**Impacto en la experiencia**  
El "espectador" ve una interfaz confusa sin rol, sin acciones, sin guía. Puede pensar que el juego está roto.

**Propuesta de solución**  
1. Emitir un `privateResult` tipo `spectator` al unirse: `{ type: 'spectator_joined' }`.
2. En el cliente, detectar este payload y mostrar un banner: "Estás espectando — la partida ya inició."
3. Opcionalmente, dar acceso al chat de muertos/espectadores.

**Dependencias**: Ninguna.  
**Riesgos**: Bajo.  
**Beneficio esperado**: Experiencia clara y accionable para espectadores.

---

### A18 — El `GameSoundService` crea un nuevo `Audio()` por cada reproducción de archivo

| Campo | Valor |
|-------|-------|
| **Prioridad** | ★★☆☆☆ |
| **Complejidad** | Trivial |

**Problema detectado**  
En [game-sound.service.ts L151-160](file:///c:/Users/Dell/Desktop/steven/firewall-protocol/firewall-protocol/mobile-terminal/src/app/services/game-sound.service.ts#L151-L160), `playFile` crea un `new Audio(path)` cada vez que se reproduce un sonido:
```ts
private async playFile(path: string): Promise<boolean> {
  try {
    const audio = new Audio(path);
    audio.volume = 1.0;
    await audio.play();
    return true;
  } catch { return false; }
}
```
Mientras que existe un cache de `HTMLAudioElement` en `getAudio(path)`, `playFile` no lo usa.

**Por qué ocurre**  
El cache (`this.cache`) se usa en `unlockAudio` pero no en la reproducción real.

**Impacto en la experiencia**  
- Cada reproducción descarga/decodifica el archivo de nuevo (en caché del navegador, pero aún hay overhead de creación de DOM element).
- Si hay muchos sonidos rápidos (ej. 5 votos consecutivos), se crean 5 elementos Audio que nunca se reciclan.
- Potential memory leak: los Audio elements se quedan en DOM.

**Propuesta de solución**  
Usar el cache existente:
```ts
private async playFile(path: string): Promise<boolean> {
  try {
    const audio = this.getAudio(path);
    audio.currentTime = 0;
    audio.volume = 1.0;
    await audio.play();
    return true;
  } catch { return false; }
}
```

**Dependencias**: Ninguna.  
**Riesgos**: Si dos sonidos del mismo tipo se superponen, el segundo interrumpirá al primero. Aceptable para este caso.  
**Beneficio esperado**: Eliminación de leak de elementos Audio + reproducción más rápida.

---

## Priorización Visual

```
CRÍTICA (★★★★★)
├── A01  Dashboard sin autenticación
└── A02  Tipo `any` en acciones — inyección de campos

ALTA (★★★★☆)
├── A03  Chat hacker broadcasteado a todos
├── A04  roomState no filtra chat por canal
├── A05  Sin heartbeat explícito
├── A11  Sin feedback de "todos actuaron" al host
└── A13  Sonido muted sin onboarding

MEDIA (★★★☆☆)
├── A06  Doble bridge en reconexión
├── A07  Room.ts God Object
├── A08  DashboardPage.ts 2143 líneas
├── A09  database.save síncrono bloqueante
├── A10  Estado completo en cada refresh
├── A12  Dashboard web sin resumen de votos
├── A14  console.log [DEBUG JOIN] en producción
└── A16  Pentester suicida sin feedback

BAJA (★★☆☆☆)
├── A15  Logging excesivo en setPlayerReady
├── A17  Espectadores sin experiencia dedicada
└── A18  Audio elements sin reciclar
```

---

## Fases Sugeridas de Implementación

### Fase 1 — Seguridad (A01, A02, A03, A04, A14)
Impacto inmediato en integridad del juego. No requiere cambios de UI. Implementable en 1-2 sesiones.

### Fase 2 — Networking & Game Feel (A05, A09, A10, A11, A13)
Mejora de rendimiento y experiencia perceptible. Requiere coordinación backend + mobile.

### Fase 3 — Feedback & UX (A12, A16, A17)
Polish de experiencia. Impacto positivo en jugadores nuevos.

### Fase 4 — Refactoring (A06, A07, A08, A15, A18)
Deuda técnica. No afecta funcionalidad actual, mejora mantenibilidad a largo plazo.

---

> **Nota final**: Esta auditoría es completamente independiente y se realizó sin conocimiento de mejoras previas. Si alguna propuesta coincide con trabajo ya realizado, verificar contra el código actual.
