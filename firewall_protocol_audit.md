# 🔥 Firewall Protocol — Documento Maestro de Mejoras v2.0

**Consolidación final — eliminación de duplicados, resolución de conflictos, fusión de propuestas relacionadas**
**Fecha:** julio 2026 · **Versión:** 2.0 (reemplaza audit v1.0)

> [!IMPORTANT]
> Este documento es exclusivamente de análisis y planificación. No se modifica ningún archivo del proyecto. Cada propuesta está diseñada para ser implementada por otro modelo sin ambigüedad.

---

## Decisiones de consolidación

Antes de las propuestas, documento las acciones de limpieza aplicadas sobre el audit v1.0.

### Fusiones realizadas (12 propuestas → 6)

| Propuestas fusionadas | Nueva propuesta | Justificación |
|---|---|---|
| A1.2 (haptic al conectar) + B1.3 (vibración diferenciada) | **M05** — Sistema háptico unificado | A1.2 era un caso particular de B1.3. Un solo sistema de haptics cubre ambas. |
| A2.2 (animación de llegada) + parte de A11.1 (sonido de join) | **M04** — Ceremonia de conexión de jugador | Ambas son facetas del mismo evento ("alguien se unió"). |
| B3.1 (resumen narrativo de noche) + B7.2 (mensajes de sistema en chat) | **M18** — Narrativa de eventos unificada | Ambas resuelven "el jugador se pierde lo que pasó". Un sistema de eventos en el chat con formato narrativo cubre las dos. |
| C3 (gradientes) + C4 (glassmorphism) | **M09** — Profundidad visual y glassmorphism | Cambios CSS complementarios en la misma superficie; implementar juntos. |
| A9.1 (transiciones entre pantallas) + A9.2 (curvas de easing) | **M08** — Sistema de animaciones y transiciones | Las curvas de easing son prerequisito de las transiciones. Un único sistema de motion design. |
| A1.3 (validación de código) + F2 (copiar código con un tap) | **M02** — UX completa del código de sala | Ambas mejoran la misma UI del campo `FIRE-XXXX`. |

### Propuestas eliminadas (4)

| Propuesta eliminada | Razón |
|---|---|
| **B11.2** — Alianzas temporales visibles | **Conflicto de diseño.** Hacer alianzas visibles contradice el núcleo de deducción social. La incertidumbre sobre quién confía en quién ES el juego. Visibilizar alianzas reduce el espacio de engaño y puede desequilibrar el meta (Black Hat abusa alianzas falsas de forma demasiado obvia). |
| **E2** — Racha diaria y recompensas | **No encaja en el contexto.** Firewall Protocol es un juego de sesiones presenciales/grupales, no un free-to-play móvil diario. Las rachas diarias presuponen un flujo de usuarios recurrentes que no existe en un proyecto de grado académico. El sistema de logros ya cubre motivación a largo plazo. |
| **B10.1** — IA de bots con dificultad adaptativa | **Esfuerzo desproporcionado.** Los bots son herramienta de QA, no adversarios para humanos. Invertir en IA de bots sofisticada tiene un retorno mínimo comparado con mejorar la experiencia PvP real. El tutorial (M13) resuelve mejor el problema de onboarding de novatos. |
| **A4.2** — Configuración de sonido por categoría | **Over-engineering.** Para el estado actual del proyecto, un toggle mute + un slider de volumen global es suficiente. La complejidad de UX de 4 sliders + selector de intensidad de vibración no justifica su valor. Si se necesita más control, añadir solo un toggle de vibración (integrado en M05). |

### Correcciones aplicadas

| Propuesta corregida | Cambio | Razón |
|---|---|---|
| **A5.2** — Avatares predefinidos temáticos | **Eliminada y reemplazada por M30** (avatar de 2 iniciales) | El sistema YA muestra la primera letra del usuario como fallback. No se necesitan avatares predefinidos ni media service. Solo cambiar de 1 letra a 2 iniciales (ej. "SA" para Steven Alvarez). |
| **A3.1** — Countdown pre-partida | **Degradada de ★★★☆☆ a ★★☆☆☆** | El host YA controla cuándo inicia. Un countdown automático añade complejidad sin resolver un dolor real. Movida a Fase 5. |
| **E1** — Sistema de niveles y XP | **Degradada de ★★★★☆ a ★★★☆☆** | Los logros expandidos (M16) cubren la progresión. Niveles + XP es una capa adicional que puede implementarse después. |

---

## Índice de mejoras (40 propuestas consolidadas)

| # | Nombre | Área | Prioridad | Complejidad |
|---|--------|------|-----------|-------------|
| **M01** | Secuencia de boot cinematográfica | Login | ★★★★★ | Media |
| **M02** | UX completa del código de sala | Login | ★★★★★ | Media |
| **M03** | Historial de salas recientes | Login | ★★★☆☆ | Baja |
| **M04** | Ceremonia de conexión de jugador | Lobby | ★★★★☆ | Baja |
| **M05** | Sistema háptico unificado | Game Feel | ★★★★☆ | Baja |
| **M06** | Barra de composición de equipos | Lobby | ★★★★☆ | Baja |
| **M07** | Sistema de "Listo" pre-partida | Lobby | ★★★★☆ | Media-alta |
| **M08** | Sistema de animaciones y transiciones | Visual | ★★★★☆ | Media |
| **M09** | Profundidad visual y glassmorphism | Visual | ★★★★☆ | Baja |
| **M10** | Sistema de iconos unificado | Visual | ★★★★☆ | Media-alta |
| **M11** | Cobertura completa de SFX | Sonido | ★★★★★ | Baja-media |
| **M12** | Crossfade entre loops musicales | Sonido | ★★★★☆ | Media |
| **M13** | Tutorial interactivo para primera partida | Onboarding | ★★★★★ | Alta |
| **M14** | Enciclopedia de roles accesible | Onboarding | ★★★★☆ | Media |
| **M15** | Modo Partida Rápida (pool de roles reducido) | Onboarding | ★★★★★ | Media |
| **M16** | Expansión del sistema de logros + notificación | Retención | ★★★★★ | Media |
| **M17** | Configuración de partida pre-inicio (host) | Configuración | ★★★★★ | Media |
| **M18** | Narrativa de eventos unificada (chat + sistema) | Partida | ★★★★☆ | Baja |
| **M19** | Screen shake y glitch al recibir daño | Game Feel | ★★★★★ | Baja |
| **M20** | Efecto de apagón noche/amanecer | Game Feel | ★★★★★ | Media |
| **M21** | Timer visual progresivo de fase | Partida | ★★★★☆ | Media |
| **M22** | Animación ceremonial de voto | Partida | ★★★★☆ | Baja |
| **M23** | Progreso de votación visible en móvil | Partida | ★★★★☆ | Baja |
| **M24** | Secuencia de Game Over escalonada | Partida | ★★★★★ | Media |
| **M25** | Efecto visual de infección progresiva | Partida | ★★★★☆ | Media |
| **M26** | Zoom pulse en la topología (eventos) | Dashboard | ★★★★☆ | Media |
| **M27** | Animación de voto en la topología | Dashboard | ★★★★☆ | Media |
| **M28** | Partículas y VFX en nodos de topología | Dashboard | ★★★★☆ | Alta |
| **M29** | Estadísticas e historial en el perfil | Perfil | ★★★★☆ | Media-alta |
| **M30** | Fallback de avatar: 2 iniciales | Perfil | ★★★★☆ | Baja |
| **M31** | Soporte para daltonismo | Accesibilidad | ★★★★☆ | Baja-media |
| **M32** | Contraste WCAG y fuentes adaptativas | Accesibilidad | ★★★★☆ | Baja |
| **M33** | Notificación push al inicio de fase | QoL | ★★★★★ | Media |
| **M34** | Confirmación de acciones irreversibles | QoL | ★★★★☆ | Baja |
| **M35** | Auto-scroll inteligente del chat | QoL | ★★★★☆ | Baja |
| **M36** | Indicador de jugadores pendientes (noche) | QoL | ★★★★☆ | Baja |
| **M37** | Sistema de "última voluntad" | Mecánica | ★★★★☆ | Media |
| **M38** | Reacciones rápidas en el chat | Mecánica | ★★★☆☆ | Media |
| **M39** | Tipografía secundaria para texto largo | Visual | ★★★☆☆ | Baja |
| **M40** | Panel SIEM con filtros y búsqueda | Dashboard | ★★★☆☆ | Media |

### Propuestas de backlog (baja prioridad, no en roadmap principal)

| # | Nombre | Razón de backlog |
|---|--------|------------------|
| B1 | Replay visual post-partida | Complejidad alta, valor marginal vs discusión social natural |
| B2 | Modo presentación TV/cine | Nicho; el fullscreen actual es funcional |
| B3 | Variedad de minijuegos | Complejidad alta; el tipo actual es suficiente si se expande con más preguntas |
| B4 | Consistencia de border-radius | Cosmético puro; implementar orgánicamente durante otros cambios |
| B5 | Música de lobby con melodía | Depende de calidad del asset generado; probar si el ambient actual ya funciona |
| B6 | Repetir última acción nocturna | Convenience que puede crear errores (target muerto entre turnos) |
| B7 | SFX Honeypot Drag faltante | Depende del asset; generable cuando se aborde sonido |
| B8 | Countdown pre-partida (host) | El host ya controla el inicio; valor marginal |
| B9 | Sonido ambiente dinámico por tensión | Requiere múltiples assets + sistema de capas; polish avanzado |
| B10 | Sistema de niveles y XP | Los logros cubren progresión; niveles son una capa extra |
| B11 | Tabla de líderes | Requiere backend nuevo; valor bajo en proyecto académico |

---

# Propuestas detalladas

---

## M01 — Secuencia de boot cinematográfica

**Área:** Login · **Prioridad:** ★★★★★ · **Complejidad:** Media

**Problema:** La app abre directamente con formulario estático visible. Sin momento de *wow* inicial.

**Propuesta:**
1. Micro-secuencia de boot al cargar `login.page`:
   - **0-0.5s:** Pantalla negra → scanline verde vertical recorre la pantalla
   - **0.5-1.2s:** Logo `icon.png` aparece con efecto glitch (desplazamiento RGB + ruido)
   - **1.2-2.0s:** "FIREWALL PROTOCOL" se escribe carácter por carácter (typewriter)
   - **2.0-2.5s:** Partículas de fondo se activan con flash sutil
   - **2.5-3.0s:** Formulario hace fade-in escalonado desde abajo
2. Solo una vez por sesión (`sessionStorage` flag). Tap para saltar.

**Dependencias:** Ninguna

---

## M02 — UX completa del código de sala

**Área:** Login · **Prioridad:** ★★★★★ · **Complejidad:** Media
**Fusiona:** A1.3 (validación en tiempo real) + F2 (copiar con un tap)

**Problema:** El campo `FIRE-XXXX` no auto-formatea, se valida solo al enviar, y no se puede copiar con un tap.

**Propuesta:**
1. **Auto-formateo:** Uppercase automático + inserción de guión tras `FIRE`. Máscara: 9 caracteres.
2. **Validación visual debounced (500ms):**
   - Borde neutral → cyan (formato correcto) → verde (sala existe) → rojo (no existe/llena)
   - Texto dinámico: "✓ Sala encontrada · 3/10" o "✕ Sala no existe"
3. **Tap para copiar:** Al pulsar el código en el dashboard web o en el header del lobby móvil → clipboard + toast "Código copiado". En web, botón adicional de compartir link.

**Dependencias:** Endpoint `getStatus` (ya existe)

---

## M03 — Historial de salas recientes

**Área:** Login · **Prioridad:** ★★★☆☆ · **Complejidad:** Baja

**Problema:** Si el jugador cierra la app, debe re-escanear QR o recordar el código.

**Propuesta:**
1. Array en `localStorage` con las últimas 5 salas: `{ roomId, timestamp, playerName }`.
2. Chips clicables debajo del campo de código: `FIRE-AB12 · hace 2h`.
3. Al pulsar → llena el campo + dispara validación. Botón "×" para eliminar.

**Dependencias:** Ninguna

---

## M04 — Ceremonia de conexión de jugador

**Área:** Lobby · **Prioridad:** ★★★★☆ · **Complejidad:** Baja
**Fusiona:** A2.2 (animación de llegada) + sonido de join de A11.1

**Problema:** Un nuevo jugador aparece en la lista sin ningún feedback sensorial.

**Propuesta:**
1. **Animación CSS:** Cada chip nuevo entra con `translateY(8px) + opacity 0 → translateY(0) + opacity 1 + scale(1.05) → 1.0` (overshoot, 250ms).
2. **Línea terminal efímera:** `> node_alpha conectado [OK]` por 2 segundos.
3. **Sonido:** `button-confirm.mp3` al detectar nuevo jugador en `publicState`.
4. **Vibración:** `ImpactStyle.Light` (un tap sutil).

**Dependencias:** Ninguna

---

## M05 — Sistema háptico unificado

**Área:** Game Feel · **Prioridad:** ★★★★☆ · **Complejidad:** Baja
**Fusiona:** A1.2 (haptic al conectar) + B1.3 (vibración diferenciada)

**Problema:** Las vibraciones usan intensidades genéricas sin patrones rítmicos diferenciados. Además, eventos clave (conectar al servidor, reconectarse) no tienen haptics.

**Propuesta:**
Definir un mapa centralizado de patrones hápticos en un servicio:

| Evento | Patrón | Implementación |
|--------|--------|----------------|
| Conexión al servidor | Pulso suave + dot CSS pulse (1.0→1.4→1.0) | `Light` × 1 |
| Fallo de conexión | Doble corto + flash rojo | `Light` × 2 (100ms gap) |
| Transición a NOCHE | Doble lento (buzz-pause-buzz) | `Medium` × 2 (300ms gap) |
| Scan seguro | Corto suave | `Light` × 1 |
| Scan malicioso | Largo + corto-corto | `Heavy` + `Light` × 2 |
| Muerte propia | Largo intenso | `Heavy` (300ms) |
| Victoria | Triple rápido ascendente | `Light`→`Medium`→`Heavy` (100ms gaps) |
| Derrota | Largo descendente | `Heavy` (500ms) |
| Nuevo chat | Tap sutil único | `Light` × 1 |
| Voto confirmado | Doble seco (tipo sello) | `Medium` × 2 (50ms gap) |

Toggle global de vibración on/off en `localStorage`.

**Dependencias:** Capacitor Haptics (ya importado)

---

## M06 — Barra de composición de equipos

**Área:** Lobby · **Prioridad:** ★★★★☆ · **Complejidad:** Baja

**Problema:** El balance de roles se muestra como texto estático poco intuitivo.

**Propuesta:**
1. Barra segmentada horizontal: cyan (System) | rojo (Black Hat) | púrpura (Caótico).
2. Recálculo dinámico en tiempo real según `players.length` usando fórmulas de `balance.ts`.
3. Texto debajo: "Estimado: 5 System · 2 Black Hat · 1 Caótico".
4. Línea punteada de mínimo (5 jugadores). Animación suave en transiciones de width.

**Dependencias:** `balance.ts` (fórmulas ya existen)

---

## M07 — Sistema de "Listo" pre-partida

**Área:** Lobby · **Prioridad:** ★★★★☆ · **Complejidad:** Media-alta

**Problema:** Los jugadores esperan pasivamente. El host puede iniciar sin confirmación.

**Propuesta:**
1. Botón "Listo" en lobby móvil → emite `playerReady(roomId, playerId)`.
2. Backend registra `isReady` por jugador en `publicState`.
3. Topología web: nodos "ready" con borde cyan pulsante; "not ready" opacos.
4. Móvil: chip de jugador muestra "✓" si listo.
5. Host: botón "Iniciar" habilitado cuando ≥80% listos. Opción de forzar inicio.

**Dependencias:** Nuevo evento socket `playerReady` / `playerNotReady`

---

## M08 — Sistema de animaciones y transiciones

**Área:** Visual · **Prioridad:** ★★★★☆ · **Complejidad:** Media
**Fusiona:** A9.1 (transiciones entre pantallas) + A9.2 (curvas de easing)

**Problema:** Transiciones entre pantallas son cortes instantáneos. Animaciones CSS usan `ease` genérico sin personalidad.

**Propuesta:**
1. **Variables CSS de timing** (definir en `global.scss` / `app.scss`):
   - `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)`
   - `--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1)`
   - `--ease-in-out-quint: cubic-bezier(0.83, 0, 0.17, 1)`
   - `--ease-bounce: cubic-bezier(0.68, -0.6, 0.32, 1.6)`
2. **Mapa de aplicación:**
   - Paneles: `--ease-out-expo` (300ms)
   - Overlays fullscreen: `--ease-in-out-quint` (400ms)
   - Chips/badges: `--ease-out-back` (200ms)
   - Toasts: `--ease-out-expo` (250ms)
   - Logros: `--ease-bounce` (500ms)
3. **Transición login → dashboard:** Fade-out escalonado (formulario→logo→fondo) + entrada de dashboard con efecto boot terminal. 600-800ms total.
4. `will-change: transform, opacity` en elementos animados frecuentes.

**Dependencias:** Ninguna

---

## M09 — Profundidad visual y glassmorphism

**Área:** Visual · **Prioridad:** ★★★★☆ · **Complejidad:** Baja
**Fusiona:** C3 (gradientes) + C4 (glassmorphism en overlays)

**Problema:** Paneles planos sin profundidad. Overlays opacos desaprovechan partículas de fondo.

**Propuesta:**
1. **Paneles:** `background: linear-gradient(135deg, #0d1520, #0a1018)` + `box-shadow: 0 4px 24px #00000080`. Paneles activos (noche, votación) con glow sutil del color de fase.
2. **Overlays** (briefing de rol, amenaza, game over, eliminado): `backdrop-filter: blur(20px) saturate(150%)` + `background: rgba(5, 10, 18, 0.85)`.

**Dependencias:** Ninguna

---

## M10 — Sistema de iconos unificado

**Área:** Visual · **Prioridad:** ★★★★☆ · **Complejidad:** Media-alta

**Problema:** Iconos son mezcla de emojis Unicode que se renderizan diferente en cada dispositivo/OS.

**Propuesta:**
1. Usar subset de Phosphor Icons o Lucide Icons (SVG inline o icon font).
2. Reemplazar emojis en UI por iconos consistentes:
   - Equipos: shield-check (System), skull (Black Hat), bolt (Caótico)
   - Fases: moon, sun, vote, check-circle
   - Estados: wifi-on/off, heart, skull-crossbones
3. Mantener emojis solo en logros (intencional, estilo badge).
4. Iconos heredan color del texto por contexto.

**Dependencias:** Selección de librería de iconos

---

## M11 — Cobertura completa de SFX

**Área:** Sonido · **Prioridad:** ★★★★★ · **Complejidad:** Baja-media

**Problema:** No todas las acciones tienen trigger de sonido. Falta audio en: join, selección de target, resultado de scan, empate de voto, reconexión.

**Propuesta:**
1. **Mapeo completo de acción → sonido:**
   - `joinRoom` → `button-confirm.mp3`
   - Seleccionar nodo objetivo → `button-click.mp3`
   - Scan seguro → nuevo `scan-result-safe.mp3` (pitido ascendente breve)
   - Scan malicioso → nuevo `scan-result-malicious.mp3` (alerta grave descendente)
   - Empate de votación → nuevo `vote-tie.mp3` (tono neutral "inconclusive")
   - Reconexión exitosa → `button-confirm.mp3`
2. **Nuevos assets a generar:** 3 MP3 (usar prompts de `SOUND_AI_PROMPTS.md`).

**Dependencias:** Generación de 3 SFX

---

## M12 — Crossfade entre loops musicales

**Área:** Sonido · **Prioridad:** ★★★★☆ · **Complejidad:** Media

**Problema:** Los cambios de fase cortan el audio bruscamente.

**Propuesta:** Crossfade de 500ms (fade-out actual + fade-in nuevo) usando gain nodes de Web Audio API. Aplicar en `GameSoundService` al cambiar entre `lobby-loop`, `night-loop`, y transiciones de fase.

**Dependencias:** Ninguna

---

## M13 — Tutorial interactivo para primera partida

**Área:** Onboarding · **Prioridad:** ★★★★★ · **Complejidad:** Alta

**Problema:** No existe tutorial. 44 roles, 7 fases, 3 equipos sin guía alguna. Curva de aprendizaje extrema.

**Propuesta:**
1. **Tutorial guiado** (accesible desde login + menú de cuenta):
   - 5-7 pantallas con transición slide:
     - "¿Qué es Firewall Protocol?" — concepto en 2 oraciones
     - "Los 3 equipos" — System, Black Hat, Caótico
     - "El ciclo" — Noche → Día → Votación → Verificación
     - "Tu rol" — ejemplo con Analista SOC
     - "¿Cómo ganas?" — condiciones por equipo
     - "Consejos básicos" — no revelar tu rol, observar patrones
   - Completado → flag en `localStorage`.
2. **Tooltips contextuales en primera partida:**
   - Al recibir rol: qué hacer en la noche.
   - Primera VOTACIÓN: mecánica de voto.
   - Primer scan: significado de SEGURO/SOSPECHOSO/MALICIOSO.
   - Se desactivan tras la primera partida completa.

**Dependencias:** Ninguna (diseño de ilustraciones opcional)

---

## M14 — Enciclopedia de roles accesible

**Área:** Onboarding · **Prioridad:** ★★★★☆ · **Complejidad:** Media

**Problema:** El catálogo de 44 roles solo está en `ROLES.md`. Inaccesible desde la app.

**Propuesta:**
1. Sección "Enciclopedia" accesible desde login (footer o menú de cuenta).
2. Lista de roles agrupada por equipo (cyan/rojo/púrpura).
3. Al pulsar un rol: ficha con descripción, acción nocturna, condición de victoria.
4. Buscador por nombre. Indicador "jugado" para usuarios con cuenta.

**Dependencias:** Datos de `roleInfo.ts` (ya existen client-side)

---

## M15 — Modo Partida Rápida (pool de roles reducido)

**Área:** Onboarding · **Prioridad:** ★★★★★ · **Complejidad:** Media

**Problema:** 44 roles abruman a novatos. Partidas cortas tienen demasiada variabilidad.

**Propuesta:**
1. **Modo Básico** — 12 roles simples:
   - System: SysAdmin, Analista SOC, Antivirus, Pentester
   - Black Hat: DDoS Operator, Rootkit, Ransomware, Spyware
   - Caótico: Troll, Gusano, Minero de Cripto, Zero-Day
2. **Modo Avanzado** — 44 roles completos (default actual).
3. Seleccionable por el host en el lobby. Badge "BÁSICO" / "AVANZADO" visible en ambos clientes.

**Dependencias:** Modificar `balance.ts` para aceptar pool configurable

---

## M16 — Expansión del sistema de logros + notificación

**Área:** Retención · **Prioridad:** ★★★★★ · **Complejidad:** Media

**Problema:** 17 logros insuficientes para 44 roles. Sin notificación visual al desbloquear.

**Propuesta:**
1. **Notificación de desbloqueo:**
   - Banner animado sobre Game Over con slide-in desde arriba.
   - Icono + nombre + "¡Logro desbloqueado!" con efecto de brillo.
   - Sonido `achievement-unlocked.mp3` (nuevo SFX) + vibración `Heavy`.
   - Múltiples logros → carrusel.
   - Badge "NUEVO" en la pantalla de logros.
2. **Logros nuevos** (de 17 a ~30):
   - **Progresión:** "Veterano de Red" (10 partidas), "Elite SOC" (50), "Leyenda" (100)
   - **Roles:** "Cirujano de Red" (3 curas/Antivirus), "Trampa mortal" (Honeypot drag), "0-Day exploit" (Zero-Day gana), "Pingüino de Hielo" (Deep Freeze 2 noches seguidas)
   - **Sociales:** "Diplomático" (20 mensajes), "Silencio de Radio" (ganar sin chatear)
   - **Secretos:** "Error 418" (5 acciones imposibles), "Caballo de Troya" (Rootkit nunca escaneado)

**Dependencias:** 1 nuevo SFX

---

## M17 — Configuración de partida pre-inicio (host)

**Área:** Configuración · **Prioridad:** ★★★★★ · **Complejidad:** Media

**Problema:** El host no puede personalizar timers ni parámetros antes de iniciar. Solo disponible mid-game o vía `.env`.

**Propuesta:**
Panel "Configuración de sala" en dashboard web, fase LOBBY:
- Duración de noche: slider 30s-180s (default 60s)
- Duración de día: slider 30s-180s (default 60s)
- Duración de votación: slider 30s-300s (default 90s)
- Auto-avance: toggle on/off
- Minijuegos: toggle on/off
- Pool de roles: Básico / Avanzado (integrado con M15)

Resumen visible en móvil: "Partida rápida (30s)" o "Partida completa (sin timer)".

**Dependencias:** `setPhaseConfig` (ya existe en socket)

---

## M18 — Narrativa de eventos unificada

**Área:** Partida · **Prioridad:** ★★★★☆ · **Complejidad:** Baja
**Fusiona:** B3.1 (resumen narrativo) + B7.2 (mensajes de sistema en chat)

**Problema:** Los eventos se muestran como toasts efímeros y no quedan registrados. El resumen de noche es texto genérico tipo `parts.join(', ')`.

**Propuesta:**
1. **Inyectar eventos como mensajes de sistema en el chat** con formato especial (sin autor, icono de sistema, color cyan, fuente menor, centrado):
   - "⚡ Fase nocturna iniciada"
   - "La red amaneció con heridas. **[NodeName]** fue eliminado."
   - "Noche tranquila. La red permanece intacta."
   - "☣ Una amenaza biológica fue detectada. 1 nodo infectado."
   - "🗳 [NodeName] expulsado por mayoría"
   - "🤝 Empate — nadie fue eliminado"
2. Los mensajes no cuentan para rate limit del jugador.
3. Se renderizan con animación slide-up + fade-in + icono de severidad.

**Dependencias:** Ninguna

---

## M19 — Screen shake y glitch al recibir daño

**Área:** Game Feel · **Prioridad:** ★★★★★ · **Complejidad:** Baja

**Problema:** La muerte propia es un overlay estático. `.interference-shake` existe pero no se aplica a muertes.

**Propuesta:**
1. **Muerte propia** (`playerEliminated` para tu ID):
   - Screen shake intenso (keyframes 300ms, random ±6px xy)
   - Glitch visual: pantalla en franjas horizontales por 200ms
   - Flash rojo full-screen (opacity 0→0.4→0, 150ms)
   - Sonido `node-down.mp3` (verificar que se reproduce)
   - Haptic: patrón de muerte de M05
2. **Muerte de otro** (incident report):
   - Mini-shake sutil (±2px, 150ms)
   - Flash rojo tenue

**Dependencias:** Ninguna

---

## M20 — Efecto de apagón noche/amanecer

**Área:** Game Feel · **Prioridad:** ★★★★★ · **Complejidad:** Media

**Problema:** La transición a noche no cambia la atmósfera visual. Solo sonido + cambio de contenido.

**Propuesta:**
1. **Móvil (entrada a NOCHE):**
   - Fondo: `#050a12` → `#020508` (300ms transición)
   - Partículas de `HomeAtmosphereComponent`: de cyan a verde tenue
   - Scanlines sutiles (líneas horizontales semi-transparentes bajando)
   - Texto: de `#e0e0e0` a verde terminal tenue `#00ff8844`
2. **Dashboard web (entrada a NOCHE):**
   - Topología reduce brillo 40%
   - Cables pasan de cyan a verde oscuro
   - Overlay sutil de noise (estática digital)
   - Nodos que actúan se iluminan brevemente
3. **Volver al DÍA:** Flash de "amanecer" (blanco breve → colores normales). Reversar todas las transiciones.

**Dependencias:** Ninguna

---

## M21 — Timer visual progresivo de fase

**Área:** Partida · **Prioridad:** ★★★★☆ · **Complejidad:** Media

**Problema:** El countdown es un texto pequeño `⏱ 0:45` sin dramatismo.

**Propuesta:**
1. El borde del panel de acción (`action-panel night` y `action-panel vote`) cambia de color progresivamente: cyan → amarillo → rojo.
2. Últimos 10 segundos: borde parpadea en rojo.
3. Últimos 5 segundos: haptic pulsante cada segundo (patrón de M05).
4. Al expirar: sonido `timer-warning.mp3`.

**Dependencias:** `phaseEndsAt` (ya existe en state)

---

## M22 — Animación ceremonial de voto

**Área:** Partida · **Prioridad:** ★★★★☆ · **Complejidad:** Baja

**Problema:** Votar se siente como llenar un formulario — sin peso ceremonial.

**Propuesta:**
1. Al pulsar "Confirmar voto":
   - Botón: efecto sello (scale 1.0 → 0.95 → 1.0 con flash de color, 200ms)
   - Selección del nodo: parpadea 2× en rojo
   - Onda visual propagada desde el botón hacia los bordes
   - Sonido `vote-cast.mp3` (ya existe)
   - Haptic: patrón sello de M05
2. "✓ Voto confirmado" aparece con typewriter effect.

**Dependencias:** Ninguna

---

## M23 — Progreso de votación visible en móvil

**Área:** Partida · **Prioridad:** ★★★★☆ · **Complejidad:** Baja

**Problema:** El jugador no sabe cuántos han votado. Solo ve su propio voto.

**Propuesta:**
1. Contador: "Votos emitidos: 3/7" debajo del formulario.
2. Barra de progreso que se llena conforme más gente vota (sin revelar HACIA QUIÉN).
3. Flash "Mayoría alcanzada" cuando se supera el umbral.

**Dependencias:** Dato ya disponible en `votes` del state

---

## M24 — Secuencia de Game Over escalonada

**Área:** Partida · **Prioridad:** ★★★★★ · **Complejidad:** Media

**Problema:** Todo aparece de golpe en el Game Over. Sin dramatismo en la revelación.

**Propuesta:**
1. **Dashboard web (TV):**
   - 0-2s: Pantalla oscurece → "PROTOCOLO FINALIZADO" con glitch
   - 2-4s: "SISTEMA ASEGURADO" o "BRECHA TOTAL" con animación dramática
   - 4-8s: Roles revelados uno a uno (nombre → flash → rol)
   - 8-10s: Estadísticas con conteo animado (0 → valor final)
   - 10s+: MVP destacado con efecto especial
2. **Móvil:**
   - Resultado personal ("Ganaste"/"Perdiste") con haptic correspondiente
   - Revelación de equipo ganador
   - Roles revelados
   - Estadísticas + logros desbloqueados (integrado con M16)
3. Sonidos `win-system.mp3`/`win-hacker.mp3`/`defeat.mp3` sincronizados.

**Dependencias:** Ninguna

---

## M25 — Efecto visual de infección progresiva

**Área:** Partida · **Prioridad:** ★★★★☆ · **Complejidad:** Media

**Problema:** La infección es un panel binario. Sin urgencia visual creciente.

**Propuesta:**
1. **Noche 1 de infección:** Borde verde tenue pulsando suavemente en la pantalla.
2. **Noche 2 (madura):** Borde rojo intenso pulsando rápido + ruido digital en esquinas + overlay sutil de estática.
3. Panel de infección con barra de progreso: "50% → Maduración en 1 noche".
4. Al morir por infección: efecto "system crash" fullscreen.

**Dependencias:** Ninguna

---

## M26 — Zoom pulse en la topología

**Área:** Dashboard · **Prioridad:** ★★★★☆ · **Complejidad:** Media

**Problema:** La topología tiene escala fija. Los eventos no tienen peso visual diferenciado.

**Propuesta:**
- Kill nocturno: scale 1.0 → 1.02 → 1.0 (300ms) centrado en nodo eliminado
- Votación resuelta: scale 1.03 (500ms ease-out) hacia nodo eliminado
- Victoria: scale 1.05 con distorsión cromática sutil

Implementar con CSS transform en contenedor de topología.

**Dependencias:** Ninguna

---

## M27 — Animación de voto en la topología

**Área:** Dashboard · **Prioridad:** ★★★★☆ · **Complejidad:** Media

**Problema:** Las líneas de voto aparecen estáticamente. Sin animación de "disparo".

**Propuesta:**
1. Línea de voto se dibuja progresivamente del votante al objetivo (300ms).
2. Pulso de energía recorre la línea (partícula A→B).
3. Nodo objetivo brilla al recibir cada voto. Grosor crece con más votos.
4. Al resolver: líneas del eliminado flashean en rojo; el resto se desvanece.

**Dependencias:** Ninguna

---

## M28 — Partículas y VFX en nodos de topología

**Área:** Dashboard · **Prioridad:** ★★★★☆ · **Complejidad:** Alta

**Problema:** Los nodos se diferencian solo por color/borde. Sin efectos de partículas.

**Propuesta:**
- **Vivos:** Partículas de datos fluyendo por cables (puntos que se mueven hub↔nodo).
- **Infectados:** Partículas rojas/verdes orbitando el nodo.
- **Muertos:** Cable desconectado con chispa esporádica; nodo con estática digital.
- **Silenciados:** Ondas de interferencia emanando del nodo.
- **Kill nocturno:** Cable estalla en chispas; nodo se apaga con fade-to-red.

Implementar con CSS pseudo-elementos o Canvas overlay.

**Dependencias:** Performance testing en TV/proyector

---

## M29 — Estadísticas e historial en el perfil

**Área:** Perfil · **Prioridad:** ★★★★☆ · **Complejidad:** Media-alta

**Problema:** El perfil muestra solo contadores básicos. Sin historial detallado.

**Propuesta:**
1. **Historial de partidas:** Lista scrollable — fecha, sala, rol, equipo, resultado (V/D), duración, MVP.
2. **Estadísticas globales:** Victorias por equipo (gráfico), roles más jugados, racha actual, "rol favorito".

**Dependencias:** `game_participations` (ya existe)

---

## M30 — Fallback de avatar: 2 iniciales

**Área:** Perfil · **Prioridad:** ★★★★☆ · **Complejidad:** Baja

> [!IMPORTANT]
> **Corrección del audit v1.0:** El sistema YA muestra la primera letra del nombre como fallback cuando no hay avatar. NO se necesitan avatares predefinidos ni un sistema de selección. La mejora es únicamente cambiar de 1 letra a 2 iniciales.

**Problema:** El fallback actual muestra solo 1 letra. Con nombres similares ("Steven", "Samuel") ambos muestran "S", lo que no ayuda a distinguirlos.

**Propuesta:**
1. Cambiar el fallback de 1 letra a 2 iniciales.
2. Lógica: tomar la primera letra del nombre + la primera del apellido (si hay espacio) o la segunda letra del nombre si no hay espacio. Ej: "Steven Alvarez" → "SA", "node_alpha" → "NO".
3. Aplicar en todos los puntos donde se renderiza el avatar fallback:
   - Lobby (chips de jugador): `node-hex-icon`
   - Lista de nodos en partida: misma clase
   - Game Over reveals
   - FAB de cuenta en login
4. Centrar las 2 letras y ajustar font-size si es necesario (probablemente reducir ~20% para que quepan ambas).

**Dependencias:** Ninguna

---

## M31 — Soporte para daltonismo

**Área:** Accesibilidad · **Prioridad:** ★★★★☆ · **Complejidad:** Baja-media

**Problema:** El juego depende de colores para equipos y resultados de scan.

**Propuesta:**
1. Iconos por equipo además del color: 🛡 System, 💀 Black Hat, ⚡ Caótico.
2. Resultados de scan con texto siempre visible: "SEGURO" + ✓, "SOSPECHOSO" + ⚠, "MALICIOSO" + ✕.
3. Opción "Alto contraste" en ajustes: aumenta luminosidad + añade patrones de textura.

**Dependencias:** Ninguna (se beneficia de M10 si se implementa primero)

---

## M32 — Contraste WCAG y fuentes adaptativas

**Área:** Accesibilidad · **Prioridad:** ★★★★☆ · **Complejidad:** Baja

**Problema:** `--color-cyber-muted: #4a6a7a` sobre `#0d1520` = ~3.2:1 (no pasa WCAG AA). Fuentes potencialmente muy pequeñas en pantallas de 5".

**Propuesta:**
1. Cambiar `--color-cyber-muted` a `#6a8a9a` (~4.7:1). Verificar todos los estados de texto.
2. Tamaño mínimo body: 14px.
3. Opción "Texto grande" en ajustes: escala fuente base +20%.

**Dependencias:** Ninguna

---

## M33 — Notificación push al inicio de fase

**Área:** QoL · **Prioridad:** ★★★★★ · **Complejidad:** Media

**Problema:** Con auto-avance, el jugador puede perderse su turno si la app está en segundo plano.

**Propuesta:**
- Notificación local (Capacitor Local Notifications) al entrar en NOCHE: "Es tu turno — ejecuta tu acción nocturna".
- Al entrar en VOTACIÓN: "Fase de votación — elige a quién expulsar".

**Dependencias:** Capacitor Local Notifications

---

## M34 — Confirmación de acciones irreversibles

**Área:** QoL · **Prioridad:** ★★★★☆ · **Complejidad:** Baja

**Problema:** Acciones con usos limitados (Fuerza Bruta, Nodo de Respaldo, Emergency Patch) no piden confirmación.

**Propuesta:** Diálogo: "¿Usar [acción]? Te quedan [N] usos. No se puede deshacer." para todas las acciones con `usesRemaining`.

**Dependencias:** Ninguna

---

## M35 — Auto-scroll inteligente del chat

**Área:** QoL · **Prioridad:** ★★★★☆ · **Complejidad:** Baja

**Problema:** El chat no scrollea automáticamente si el usuario está leyendo mensajes anteriores.

**Propuesta:** Auto-scroll al fondo al recibir mensaje, EXCEPTO si el usuario scrolleó hacia arriba (detectar scroll position). Badge "↓ Nuevos mensajes" para volver al fondo.

**Dependencias:** Ninguna

---

## M36 — Indicador de jugadores pendientes (noche)

**Área:** QoL · **Prioridad:** ★★★★☆ · **Complejidad:** Baja

**Problema:** El host ve `acted/total` pero no sabe QUIÉN falta, lo que alarga las noches.

**Propuesta:** En dashboard web, marcar nodos con estado "ha actuado" / "pendiente" (sin revelar la acción elegida). Cambio visual sutil en el nodo de la topología (ej: opacidad reducida para pendientes).

**Dependencias:** Ninguna (dato ya disponible)

---

## M37 — Sistema de "última voluntad"

**Área:** Mecánica · **Prioridad:** ★★★★☆ · **Complejidad:** Media

**Problema:** La eliminación es un dead-end abrupto sin cierre narrativo.

**Propuesta:**
1. Al ser eliminado: 10 segundos para escribir un "último log" (máx 60 caracteres).
2. Se publica en chat público: "Último log del nodo [Name]: [mensaje]" con formato especial (borde rojo, ☠).
3. Puede contener info estratégica o desinformación. No revela rol.

**Dependencias:** Nuevo evento socket + lógica en `ChatManager`

---

## M38 — Reacciones rápidas en el chat

**Área:** Mecánica · **Prioridad:** ★★★☆☆ · **Complejidad:** Media

**Problema:** Escribir mensajes completos en móvil es lento durante votación.

**Propuesta:**
1. Barra de reacciones rápidas (6-8 opciones): 👍 De acuerdo, 👎 En contra, 🤔 Sospechoso, 🛡 Inocente, ⚠ Alerta, 💀 Acuso.
2. Se envían como `ChatMessage` con tipo `reaction` (renderizado más grande, con borde de color).
3. Mismo rate limit que chat regular.

**Dependencias:** Nuevo tipo de `ChatMessage`

---

## M39 — Tipografía secundaria para texto largo

**Área:** Visual · **Prioridad:** ★★★☆☆ · **Complejidad:** Baja

**Problema:** Monospace para todo (incluyendo descripciones largas de roles, tutorial) reduce legibilidad.

**Propuesta:** Añadir `Inter` o `Space Grotesk` como fuente sans-serif para cuerpos de texto. Mantener monospace para UI, códigos y datos.

**Dependencias:** Google Fonts import

---

## M40 — Panel SIEM con filtros y búsqueda

**Área:** Dashboard · **Prioridad:** ★★★☆☆ · **Complejidad:** Media

**Problema:** Logs públicos como lista plana cronológica. Difícil seguir en partidas largas.

**Propuesta:**
1. Filtros por severidad (`Info|Warn|Critical|Success`) y tipo (`Eliminaciones|Votos|Infecciones`).
2. Agrupación por ronda con headers colapsables.
3. Búsqueda rápida por nombre de jugador.
4. Highlight + scroll-into-view del último evento.

**Dependencias:** Ninguna (datos ya disponibles en `publicLogs`)

---

# Roadmap de implementación consolidado

---

## Fase 1 — Primera Impresión y Game Feel Core (Semana 1-2)

> Objetivo: Que el juego se sienta premium desde el primer contacto.

| # | Mejora | Prioridad | Complejidad |
|---|--------|-----------|-------------|
| M01 | Secuencia de boot cinematográfica | ★★★★★ | Media |
| M02 | UX completa del código de sala | ★★★★★ | Media |
| M08 | Sistema de animaciones y transiciones | ★★★★☆ | Media |
| M09 | Profundidad visual y glassmorphism | ★★★★☆ | Baja |
| M19 | Screen shake y glitch al recibir daño | ★★★★★ | Baja |
| M20 | Efecto de apagón noche/amanecer | ★★★★★ | Media |
| M30 | Fallback de avatar: 2 iniciales | ★★★★☆ | Baja |

---

## Fase 2 — Feedback Sensorial Completo (Semana 3-4)

> Objetivo: Que cada acción tenga peso visual, sonoro y háptico.

| # | Mejora | Prioridad | Complejidad |
|---|--------|-----------|-------------|
| M05 | Sistema háptico unificado | ★★★★☆ | Baja |
| M11 | Cobertura completa de SFX | ★★★★★ | Baja-media |
| M12 | Crossfade entre loops musicales | ★★★★☆ | Media |
| M04 | Ceremonia de conexión de jugador | ★★★★☆ | Baja |
| M22 | Animación ceremonial de voto | ★★★★☆ | Baja |
| M25 | Efecto visual de infección progresiva | ★★★★☆ | Media |
| M33 | Notificación push al inicio de fase | ★★★★★ | Media |
| M21 | Timer visual progresivo de fase | ★★★★☆ | Media |

---

## Fase 3 — Onboarding y Accesibilidad (Semana 5-6)

> Objetivo: Que cualquier persona pueda jugar sin instrucción verbal.

| # | Mejora | Prioridad | Complejidad |
|---|--------|-----------|-------------|
| M13 | Tutorial interactivo para primera partida | ★★★★★ | Alta |
| M14 | Enciclopedia de roles accesible | ★★★★☆ | Media |
| M15 | Modo Partida Rápida | ★★★★★ | Media |
| M17 | Configuración de partida pre-inicio | ★★★★★ | Media |
| M31 | Soporte para daltonismo | ★★★★☆ | Baja-media |
| M32 | Contraste WCAG y fuentes adaptativas | ★★★★☆ | Baja |
| M34 | Confirmación de acciones irreversibles | ★★★★☆ | Baja |
| M18 | Narrativa de eventos unificada | ★★★★☆ | Baja |

---

## Fase 4 — Retención y Profundidad (Semana 7-8)

> Objetivo: Que los jugadores quieran volver.

| # | Mejora | Prioridad | Complejidad |
|---|--------|-----------|-------------|
| M16 | Logros expandidos + notificación | ★★★★★ | Media |
| M24 | Secuencia de Game Over escalonada | ★★★★★ | Media |
| M29 | Estadísticas e historial en perfil | ★★★★☆ | Media-alta |
| M06 | Barra de composición de equipos | ★★★★☆ | Baja |
| M23 | Progreso de votación visible en móvil | ★★★★☆ | Baja |
| M35 | Auto-scroll inteligente del chat | ★★★★☆ | Baja |
| M36 | Indicador de jugadores pendientes | ★★★★☆ | Baja |
| M37 | Sistema de "última voluntad" | ★★★★☆ | Media |

---

## Fase 5 — Polish y Topología Viva (Semana 9-10+)

> Objetivo: Elevar la capa visual del dashboard y pulir detalles finales.

| # | Mejora | Prioridad | Complejidad |
|---|--------|-----------|-------------|
| M07 | Sistema de "Listo" pre-partida | ★★★★☆ | Media-alta |
| M10 | Sistema de iconos unificado | ★★★★☆ | Media-alta |
| M26 | Zoom pulse en la topología | ★★★★☆ | Media |
| M27 | Animación de voto en la topología | ★★★★☆ | Media |
| M28 | Partículas y VFX en nodos | ★★★★☆ | Alta |
| M38 | Reacciones rápidas en chat | ★★★☆☆ | Media |
| M39 | Tipografía secundaria | ★★★☆☆ | Baja |
| M40 | Panel SIEM con filtros | ★★★☆☆ | Media |
| M03 | Historial de salas recientes | ★★★☆☆ | Baja |

---

## Resumen ejecutivo

| Métrica | v1.0 | v2.0 (este documento) |
|---------|------|-----------------------|
| **Total propuestas** | 56 | **40** (−16) |
| **Duplicados eliminados** | — | 12 fusionados → 6 |
| **Ideas eliminadas** | — | 4 |
| **Correcciones aplicadas** | — | 3 |
| **★★★★★ Imprescindible** | 14 | **11** |
| **★★★★☆ Muy recomendable** | 27 | **22** |
| **★★★☆☆ Buena mejora** | 12 | **7** |
| **★★☆☆☆ Backlog** | 3 | **11** (movidas a backlog) |
| **Fases del roadmap** | 5 | **5** |

> [!TIP]
> Las Fases 1 y 2 transforman la primera impresión y el game feel con esfuerzo mayoritariamente front-end (CSS/TS). Las Fases 3 y 4 abordan retención y accesibilidad con algo de backend. La Fase 5 es polish de topología y features opcionales. Cada mejora es implementable de forma independiente.

---

*Documento maestro v2.0 — consolidación final para implementación.*
