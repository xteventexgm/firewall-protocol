# Changelog — Firewall Protocol

Historial de cambios relevantes del monorepo. Las fechas agrupan trabajo por sesión de desarrollo.

---

## [Unreleased] — 2025-06-19

### Victoria y fin de partida

- **Victoria inmediata al eliminar jugadores:** `maybeEndGame()` se invoca al votar fuera a alguien, al arrastre de honeypot y al detectar condición de victoria sin depender de una segunda fase `VERIFICACION`.
- **Corrección crítica en `VERIFICACION`:** avanzar fase ya no saltaba a `NOCHE` sin comprobar victoria; primero evalúa `checkAnyWin` y termina en `FIN` si corresponde.
- **Caso borde caótico:** si no quedan hackers ni jugadores System pero sí caóticos vivos, se resuelve victoria solitaria o desempate caótico (`VictoryChecker.ts`).
- **Móvil — overlay de victoria:** al recibir `gameOver` ya no se limpia la sesión ni hay redirect automático a los 5 s; el jugador pulsa **Volver al login** para salir.
- **Animaciones:** pulso/entrada en overlay de victoria (web y móvil).

### Chat

- **Muertos:** canal `dead` habilitado en `NOCHE` y `VERIFICACION` (backend `ChatManager.ts`).
- **Móvil — pantalla de eliminado:** chat de espectadores integrado dentro del overlay *SISTEMA CAÍDO* (antes quedaba oculto por el overlay).
- **Hackers de noche:** canal hacker forzado en `NOCHE` para `black_hat`; fallback de equipo vía `effectiveTeam` (estado + socket).

### Web dashboard

- **Panel lateral compacto** durante partida activa: oculta QR, guía, timers, lista de jugadores e *Iniciar partida*; muestra código, fase, *Avanzar fase* y *Volver al lobby*.
- **Anti-fuga de roles:** el dashboard recibe `nightResolved` público (sin `privateResults`); logs internos anonimizados en motor de reglas.
- **Briefing *RED COMPROMETIDA*:** duración aumentada a 20 s.
- **Sonido:** servicio de audio para fases, votos, victoria y UI.
- **Topología 3D:** layout spider, nodos ampliados, partículas.
- **Logs públicos nocturnos** y barra de progreso de noche en pantalla principal.

### Mobile terminal

- **Login y dashboard** rediseñados con atmósfera cyber (partículas, grid, glass shell).
- **Minijuegos (skill checks):** objetivo, contexto, consecuencias; validación servidor; feedback visual con sacudida.
- **Pantalla completa nativa:** `StatusBar.hide()` + overlay web en Capacitor (oculta barra de estado en Android).
- **Lobby cerrado / reconexión / salir** con overlays y mensajes claros.

### Backend — arquitectura nocturna

- Nuevos módulos: `NightOrchestrator`, `NightActionProcessManager`, `NightRuntimeContext`, `MinigameChallengeManager`, `PublicLogService`, `SuspicionService`.
- Procesamiento de acciones nocturnas por lotes con progreso emitido a clientes.
- Minijuegos con preguntas más exigentes y resultado `minigameAnswerResult`.

### Salas y ciclo de vida

- `finishgame` / archivado al terminar partida.
- Salir del lobby pre-partida elimina al jugador sin borrar la sala.
- Cerrar sala desde web notifica `lobbyClosed` a móviles.

### Documentación

- README raíz profesional, `CHANGELOG.md`, READMEs de web-dashboard y mobile-terminal.
- Actualización de `TESTING.md` y `WIN_CONDITIONS.md` según comportamiento actual.

---

## Sesión anterior — UI, chat y estabilidad

### Web dashboard

- Lobby con scroll, chat ampliado, icono de aplicación.
- Botón *Volver al lobby* sin destruir la sala en servidor.
- Export de replay JSON tras `FIN`.

### Mobile terminal

- Chat vertical en dashboard; flujo login → reconexión → salir.
- Chat de muertos y hackers (primera iteración).
- Overlay de victoria con revelación de roles y estadísticas.

### Backend

- `leaveRoom` pre-game quita jugador de la sala.
- Rate-limit y canales de chat (`public`, `dead`, `hacker`).
- Tests manuales en `ChatManager.test.ts`.

---

## Convenciones de este changelog

| Tipo | Significado |
|------|-------------|
| **Victoria / reglas** | Cambios en `VictoryChecker`, `Room`, `RuleEngine` |
| **Socket** | Eventos, payloads, `roomBridge` |
| **Cliente** | web-dashboard o mobile-terminal |
| **Docs** | Archivos `.md` del repositorio |

Para el detalle línea a línea, consulta el historial de git y el transcript de la sesión de desarrollo.

---

## Próximos pasos sugeridos

- [ ] Tests automatizados para `VictoryChecker` y flujo de votación → `FIN`
- [ ] JWT en conexión socket
- [ ] Documentar variables de `environment.ts` por entorno (dev/staging/prod)
- [ ] Guía de despliegue Docker completa (backend + frontends)
