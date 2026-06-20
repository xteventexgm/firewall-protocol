# Guía de pruebas manuales — Firewall Protocol

Checklist para testers y QA jugando partidas reales. Marca cada ítem al probarlo.

> Documentación general del proyecto: [`README.md`](README.md) · Cambios recientes: [`CHANGELOG.md`](CHANGELOG.md)

## Requisitos

- Backend en marcha (`backend-server`)
- Web dashboard abierto en TV/PC (host)
- Al menos 2 terminales móviles (ideal: 5–10 jugadores)
- Misma red o túnel (ngrok/localtunnel) si pruebas remotas

---

## 1. Conexión y lobby

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|-------------------|
| 1.1 | Crear sala | Host → Crear sala (elige capacidad) | Código `FIRE-XXXX`, QR visible, fase LOBBY |
| 1.2 | Unirse por QR | Móvil escanea QR | Llega a alias → entra al dashboard de jugador |
| 1.3 | Unirse manual | Móvil ingresa código + alias | Mismo flujo que QR |
| 1.4 | Código inválido | Móvil: `ABC-123` | Error: código inválido, no entra |
| 1.5 | Sala inexistente | Móvil: `FIRE-ZZZZ` (no creada) | Error: sala no encontrada |
| 1.6 | Sala llena | Llenar hasta `maxPlayers`, otro intenta entrar | Error: sala llena |
| 1.7 | Partida ya iniciada | Host inicia; nuevo jugador intenta entrar | Error: partida ya comenzó |
| 1.8 | Reconexión móvil | Cierra app / pierde WiFi → vuelve | Re-entra automáticamente a la misma sala |
| 1.9 | Reconexión web | Refresca página con sala guardada | Vuelve a la sala tras `publicState` |
| 1.10 | Sala terminada | Tras FIN, móvil con sesión vieja | Redirige a login con aviso |

---

## 2. Flujo de partida (host)

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|-------------------|
| 2.1 | Inicio | Con ≥ mínimo jugadores → Iniciar | Fase REPARTO → roles asignados |
| 2.2 | Briefing móvil | Tras reparto | Overlay de rol ~14s en cada móvil |
| 2.3 | Briefing TV | Primer DÍA | Overlay "RED COMPROMETIDA" ~20s |
| 2.4 | Avanzar fases | Host pulsa Avanzar fase | Transiciones: NOCHE → DÍA → VOTACIÓN → … |
| 2.5 | Auto-avance | Activa timers y Aplicar | Fases avanzan solas al expirar; panel lateral en modo compacto |
| 2.6 | Panel compacto | Partida iniciada (sin timer) | QR y timers ocultos; solo código, fase, Avanzar y Volver al lobby |
| 2.7 | Móvil no inicia | Intentar `startGame` desde cliente (devtools) | Rechazado: solo dashboard |

---

## 3. Noche

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|-------------------|
| 3.1 | Acción nocturna | Rol con habilidad elige objetivo | Confirmación / barra de progreso en TV |
| 3.2 | Acción inválida | Objetivo prohibido (ej. self-target) | Toast con mensaje claro en móvil |
| 3.3 | Ya actuó | Enviar segunda acción misma noche | Error `already_acted` |
| 3.4 | Fase incorrecta | Acción en DÍA | Error `wrong_phase` |
| 3.5 | Minijuego | Skill check si aplica | UI de reto; fallo/éxito con consecuencia |
| 3.6 | Resolución | Host avanza tras NOCHE | Panel de resolución + logs SIEM en TV |

---

## 4. Día y votación

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|-------------------|
| 4.1 | Voto | Cada vivo vota en VOTACIÓN | Líneas de voto en topología |
| 4.2 | Empate | Provocar empate | Mensaje de empate, sin eliminación |
| 4.3 | Chat público | Mensaje en DÍA | Visible en feed (si fase lo permite) |
| 4.4 | Chat hacker | Black Hat en NOCHE | Canal hacker visible y abierto en móvil |
| 4.5 | Chat muertos | Jugador eliminado | Chat de espectadores en overlay *SISTEMA CAÍDO* (también en NOCHE) |
| 4.6 | Jugador muerto | Muerto intenta votar/actuar | Rechazado |

---

## 5. Roles específicos (muestra)

Probar al menos una partida con estos roles presentes:

- **Minero de Cripto**: `mine_crypto` (+escudo), `crypto_bribe` (gasta escudo → kill), cooldown mismo nodo
- **SysAdmin**: parche de emergencia con confirmación
- **Troll**: provocar en día
- **Antivirus**: protección / cura con cooldown
- **Infección**: nodos infectados visibles en TV tras briefing

Ver detalle en `ROLES.md`.

---

## 6. Fin de partida

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|-------------------|
| 6.1 | Victoria por bando | Eliminar último hacker (voto) | Un solo *Avanzar fase* desde VOTACIÓN → overlay game over en **todos** los dispositivos |
| 6.2 | Victoria solitaria | Minero/Gusano último vivo; Troll baneado | Overlay con mensaje solitario y sonido |
| 6.3 | Móvil post-FIN | Tras overlay | Permanece en pantalla de victoria hasta pulsar **Volver al login** |
| 6.4 | TV post-FIN | Overlay visible | Botón *Volver al lobby*; opción replay JSON y nueva partida |
| 6.5 | Sin fuga de roles | Observar TV durante noche | No aparecen nombres de roles internos en logs (ej. "Crypto Miner") |
| 6.6 | Nueva ronda | Crear sala nueva | Código distinto, sin estado residual |

---

## 7. Errores y edge cases

| # | Escenario | Qué observar |
|---|-----------|--------------|
| 7.1 | Backend caído | Indicador desconectado en lobby; mensaje al reconectar |
| 7.2 | Dos pestañas mismo jugador | Segunda conexión desconecta la primera |
| 7.3 | Host abandona TV | Partida sigue en servidor; otro host puede re-entrar con código guardado |
| 7.4 | Códigos en minúsculas | `fire-ab12` normalizado a `FIRE-AB12` |
| 7.5 | Rate-limit chat | Enviar mensajes rápido → cooldown visible en botón Enviar |
| 7.6 | Export replay | Tras FIN en TV → Descargar replay JSON |
| 7.7 | Pantalla completa móvil | App nativa Android | Barra de estado del sistema oculta |

---

## 8. API replay (host / QA)

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| 8.1 | `GET /api/games` | Lista salas guardadas en disco |
| 8.2 | `GET /api/games/FIRE-XXXX/replay` | Descarga JSON con estado completo |

---

## Códigos de error socket (referencia)

Formato: `Mensaje legible (codigo)`

| Código | Significado |
|--------|-------------|
| `room_not_found` | Sala no existe |
| `game_ended` | Partida cerrada en servidor |
| `game_started` | No se admiten jugadores nuevos |
| `room_full` | Capacidad máxima alcanzada |
| `invalid_room_code` | Formato distinto de FIRE-XXXX |
| `wrong_phase` | Acción en fase incorrecta |
| `dashboard_only` | Solo el host puede hacerlo |
| `not_joined` / `identity_mismatch` | Sesión socket inválida |

---

## Reportar bugs

Incluir siempre:

1. Código de sala y fase actual
2. Rol del jugador afectado (si aplica)
3. Pasos exactos para reproducir
4. Mensaje de error mostrado (texto completo)
5. Captura de consola del backend si es posible
