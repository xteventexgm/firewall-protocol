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

### 1.1 Boot de topología (sala vacía)

Probar con capacidades **5, 7 y 12** jugadores. Crear sala y **no unir jugadores** hasta terminar la animación.

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| 1.1a | Secuencia completa | Grilla → hub → cables por capas → nodos `?` wireframe → consola `Red operativa` → fade suave (~2,4 s) al estado tenue |
| 1.1b | Destello final | Brillo de fondo **visible pero no cegador** al terminar nodos; desaparece gradualmente con el fade |
| 1.1c | Sin corte brusco | Al acabar el boot, líneas/nodos no “saltan” de color ni desaparecen de golpe |
| 1.1d | Layout 7 jugadores | Sur/norte/e/oeste a distancia similar; no un brazo pegado al hub |
| 1.1e | Layout 8–12 | Estrella extendida simétrica (cardinales + hojas) |
| 1.1f | Texto de espera | *Esperando nodos…* en esquina inferior izquierda, sin tapar nodos |
| 1.1g | Primer jugador | Tras boot, al unirse uno: cable → wireframe → parpadeo → nodo conectado |
| 1.1h | Mis salas | Tarjeta muestra `Conectados · 0 / N nodos` y actualiza al unir jugadores |

### 1.2 Bots de QA (sin móviles)

Requiere backend con bots habilitados (por defecto; `DEV_BOTS=false` los desactiva).

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|-------------------|
| 1.2a | Rellenar bots | Crear sala (p. ej. capacidad 12) → **Añadir bots hasta N** | Aparecen `BOT-01`…`BOT-N` según `maxPlayers`; badge **BOT** |
| 1.2b | Iniciar solo | Con 5 bots → **Iniciar partida** | Reparto, fases y resolución nocturna sin terminales móviles |
| 1.2c | Logs QA | Avanzar NOCHE / VOTACIÓN con auto-avance | Panel SIEM muestra líneas `[BOT/QA]` (acción enviada, voto, fallos) |
| 1.2d | Quitar bots | En LOBBY → **Quitar bots** | Solo quedan jugadores humanos (si los había) |
| 1.2e | Prod desactivado | Servidor con `DEV_BOTS=false` | Botón deshabilitado o error *Bots desactivados* |
| 1.2f | Partida QA auto | **Partida QA automática** en lobby | Bots + inicio + avance hasta FIN; overlay game over; logs `[BOT/QA]` con ganador |
| 1.2g | CLI headless | `cd backend-server && npm run qa:bot-match` | Termina con exit 0, imprime ganador en consola |

---

## 2. Flujo de partida (host)

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|-------------------|
| 2.1 | Inicio | Con ≥ mínimo jugadores → Iniciar | Fase DÍA 1; TV muestra *Distribuyendo roles* |
| 2.2 | Briefing móvil | Tras reparto | Overlay de rol ~20 s → vibración → alerta por equipo ~20 s |
| 2.3 | Briefing TV | Tras reparto en TV | *Distribuyendo roles* ~20 s → *RED COMPROMETIDA* ~20 s |
| 2.3b | Copy por equipo (móvil) | Un jugador system, uno black_hat, uno chaotic | System: red comprometida; Hacker: acceso exitoso; Caótico: vector activo |
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
