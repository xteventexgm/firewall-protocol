# Roadmap — Mobile Terminal (jugador)

Para analizar en equipo. Incluye **opinión sobre mostrar roles en partida** (sin implementar aún).

---

## Qué tiene hoy

- Login invitado o cuenta (correo, perfil, avatar MinIO/disco)
- Unirse por código/QR, reconexión automática
- Rol secreto, briefing 20 s, amenaza por equipo
- Acciones nocturnas, votos, chat (public/dead/hacker)
- Botón **Ver rol y habilidad** en partida
- Cuenta: stats (System, Black Hat, **Caótico**), historial 10 partidas + detalle
- Sesión persistente (refresh 90 d, renovación al abrir app)
- Game over narrativo (sin códigos técnicos)

---

## Opinión: ¿mostrar qué roles existen en la partida?

### El problema

Si hay un **Troll** y nadie lo sabe, el debate pierde capa social (“¿hay troll?”). Demasiado anonimato puede frustrar en mesas experimentadas.

### Opciones de diseño

| Enfoque | Pros | Contras |
|---------|------|---------|
| **A. No mostrar nada** (hoy) | Máxima tensión; fiel a Mafia clásica | Roles caóticos / Troll invisibles meta-juego |
| **B. Solo conteos de equipo** (como amenaza) | “Hay intrusos caóticos” sin nombres de rol | Ya parcialmente en briefing (`intruderCount`) |
| **C. Lista de roles en mesa, sin jugador** | “En esta partida hay: Troll, Gusano, Antivirus…” | Reduce deducción; más accesible para nuevos |
| **D. Lista desbloqueable** | Tras N noches o al morir, ver roles posibles | Compromiso; recompensa supervivencia |
| **E. Glosario “roles que podrían estar”** | Según tamaño de mesa, roles del pool GDD — no confirma cuáles se repartieron | Educativo sin spoilear reparto exacto |

### Recomendación del equipo técnico (para votar)

1. **Corto plazo:** mantener secreto total en partida; mejorar **briefing** con conteos (“~1 caótico cada 5 jugadores”) — ya existe en lobby móvil.
2. **Si el playtest pide más info:** implementar **E** — ventana “Roles en el pool de esta mesa” desde menú ⋮, calculada por `maxPlayers` + reglas de balance, **sin** listar qué salió realmente.
3. **Evitar C** salvo modo “casual” toggle del host — sería setting de sala en backend.

> Implementar **lista exacta de roles repartidos** (quién es qué) en móvil **rompería el core loop**. Solo tiene sentido en FIN o espectador admin.

---

## Ideas priorizadas

### P0 — UX y retención

| Idea | Descripción |
|------|-------------|
| **Pool de roles (modo E)** | Hoja estilo perfil: “Roles que pueden aparecer en una mesa de N jugadores”. |
| **Notificaciones push** (Capacitor) | “La partida va a empezar”, “Es tu turno de votar” — opcional. |
| **Haptic + accesibilidad** | Más feedback en votación y eliminación. |
| **Modo oscuro / tamaño texto** | Ajustes en ajustes de terminal. |
| **Tutorial primera partida** | Overlay guiado en LOBBY. |

### P1 — Social y cuenta

| Idea | Descripción |
|------|-------------|
| **Amigos / lista reciente** | Salas recientes, mismos compañeros de facultad. |
| **Logros** | “Primera victoria caótica”, “5 MVPs”. |
| **Compartir resultado** | Card imagen post-partida para WhatsApp. |
| **Deep link** | `firewall://join/FIRE-XXXX` |

### P2 — Gameplay móvil

| Idea | Descripción |
|------|-------------|
| **Notas privadas** | Bloc por jugador sospechoso (solo local). |
| **Voz proximidad** | Fuera de scope técnico actual — solo idea. |
| **Modo espectador móvil** | Tras muerte, ver topología simplificada (si backend envía vista muerto ampliada). |

### P3 — Mejoras a futuro (discutir en equipo)

| Idea | Descripción | Dependencias |
|------|-------------|--------------|
| **Registro de sospechosos** | Marcar nodos con etiquetas (sospechoso / confiable / desconocido) persistidas en la partida local. | Solo cliente |
| **Historial de acciones propias** | Línea de tiempo: “Noche 2: escaneaste a X → SEGURO”. | Backend: log privado por jugador |
| **Recordatorios de fase** | Banner persistente: “Te quedan 30 s para actuar” si no enviaste acción nocturna. | `phaseEndsAt` ya existe |
| **Vista compacta / una mano** | Layout alternativo para pantallas pequeñas; botones de voto más grandes. | Solo UI |
| **Modo tablet** | Dos columnas: chat + acción en landscape. | CSS / Ionic grid |
| **Idioma (i18n)** | ES por defecto; EN opcional para demo internacional. | `@angular/localize` |
| **Login biométrico** | Face ID / huella para reabrir app sin contraseña (token en secure storage). | Capacitor + Keychain |
| **OAuth (Google / Microsoft)** | “Entrar con cuenta institucional” además de correo local. | Backend OAuth |
| **Recuperar contraseña** | Flujo email o código admin en grado. | SMTP o manual |
| **Onboarding por rol** | Primera vez que juegas “Antivirus”: mini-tutorial de protect vs cure. | Contenido + flag local |
| **Sonido por categoría** | Sliders: UI / votos / victoria / ambiente (hoy todo mezclado). | `GameSoundService` |
| **Modo streamer** | Ocultar código de sala en captura; blur en notificaciones sensibles. | Flag en ajustes |
| **QR desde galería** | Escanear screenshot de código FIRE-XXXX sin cámara en vivo. | Plugin o input manual mejorado |
| **Salas favoritas** | Pin de códigos recientes en login. | `localStorage` |
| **Indicador de latencia** | Ping al servidor en login (útil con ngrok/LAN). | Health + RTT |
| **Feedback in-app** | Botón “Reportar bug” con roomId + fase (sin datos secretos). | Form o webhook |
| **Beta / feature flags** | Activar pool de roles, nuevos minijuegos sin redeploy. | Backend flags |

---

## Mejoras técnicas (móvil)

| Tema | Propuesta | Prioridad sugerida |
|------|-----------|-------------------|
| **Tests E2E** | Cypress/Detox: login → join → votar. | Media |
| **Estado offline** | Mensaje claro si socket cae mid-vote; cola de reintento. | Alta |
| **Bundle size** | Lazy routes ya hay; auditar Three/ionic chunks si crece. | Baja |
| **Capacitor Android/iOS** | Builds release, íconos, splash, permisos cámara. | Alta para producción |
| **Secure storage** | Mover refresh token de `localStorage` a almacén nativo cifrado. | Media (seguridad) |
| **Actualizaciones OTA** | Capgo o similar para hotfix sin store — solo si hay store. | Baja |
| **Accesibilidad WCAG** | Contraste, `aria-label` en votos, soporte lector de pantalla en login. | Media |

---

## Mejoras de producto / retención (discutir)

| Idea | Pregunta para el equipo |
|------|-------------------------|
| **Rachas y temporadas** | ¿Queremos “temporada facultad” con ranking semanal o solo stats acumuladas? |
| **MVP visible en partida** | ¿Mostrar badge MVP provisional antes del FIN o solo al final? |
| **Chat rápido** | ¿Frases predefinidas (“sospecho de X”) para acelerar debate sin teclado? |
| **Voto con confirmación** | ¿Doble tap para votar evita errores o frustra en tiempo limitado? |
| **Muertos más activos** | ¿Ampliar canal `dead` con pistas limitadas o mantener solo chat social? |
| **Partida rápida** | ¿Preset host “noches 30 s” sincronizado con móvil (timer visible)? |
| **Invitar amigos** | ¿Share sheet nativo con enlace + código al crear sala desde móvil? |

---

## Integraciones posibles

| Integración | Uso |
|-------------|-----|
| **Firebase FCM** | Push cuando host inicia partida (jugadores en lobby con cuenta). |
| **Branch.io / App Links** | Deep link universal `https://fp.app/join/FIRE-XXXX`. |
| **Analytics (Mixpanel / Plausible)** | Eventos anónimos: partidas completadas, abandono en LOBBY. |
| **Sentry** | Crashes en producción con contexto de sala (sin roles). |

---

## Largo plazo (visión 6–12 meses)

- App en **Play Store / App Store** con cuenta obligatoria opcional para ranked.
- **Modo práctica** solo contra bots desde móvil (sin dashboard).
- **Cartas de rol** descargables PDF generadas post-partida para mesa física híbrida.
- **Wear OS / reloj**: solo notificación “fase VOTACIÓN” — nicho, baja prioridad.
- **Cross-play** validado en 4G con TURN para socket si NAT estricto (complejidad alta).

---

## Preguntas abiertas para la reunión de equipo

1. ¿Priorizamos **pool de roles (modo E)** o **notas privadas** primero?
2. ¿La app debe funcionar **sin cuenta** siempre, o empujamos registro tras la 3ª partida?
3. ¿Queremos **modo casual** (host decide) en v1 pública o solo competitivo?
4. ¿Push notifications son requisito de grado o nice-to-have?
5. ¿Tablet del profesor como segunda pantalla móvil o solo web-dashboard?

---

## Ideas descartadas o “más adelante”

- Jugar solo desde web — el móvil es el producto jugador.
- Ver roles vivos de otros en partida — anti-diseño salvo hack/cheat.

---

## Referencias

- `mobile-terminal/src/app/pages/dashboard/`
- `account-panel/`
- [ROLES.md](../ROLES.md), [WIN_CONDITIONS.md](../WIN_CONDITIONS.md)
