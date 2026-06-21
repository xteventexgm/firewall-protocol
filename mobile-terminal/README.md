# Mobile Terminal — Firewall Protocol

App **Ionic + Angular** que actúa como terminal secreta de cada jugador. Aquí ven su rol, ejecutan acciones nocturnas, votan y chatean — sin acceso a la información global del host.

## Qué hace

| Pantalla | Descripción |
|----------|-------------|
| **Login** | Unirse por código `FIRE-XXXX` o QR; alias del jugador |
| **Lobby (sala)** | Espera con lista de nodos y ocupación |
| **Dashboard** | Rol, acciones, votación, chat, minijuegos y overlays de fase |
| **Eliminado** | Overlay *SISTEMA CAÍDO* + chat de espectadores |
| **Victoria** | Overlay con equipo ganador, revelaciones y botón *Volver al login* |

El host **no** inicia ni avanza fases desde el móvil; eso solo ocurre en [`web-dashboard`](../web-dashboard/).

---

## Requisitos

- Node.js 18+
- Backend en marcha ([`backend-server`](../backend-server/))
- Para dispositivo físico: Android Studio / Xcode (Capacitor)

---

## Desarrollo en navegador

```bash
cd mobile-terminal
npm install
ionic serve
```

Abre la URL que muestra la CLI (típicamente `http://localhost:8100`).

### Configurar servidor

`src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  socketUrl: 'http://localhost:3000',
};
```

En teléfono real en la misma WiFi, usa la IP del PC con el backend (no `localhost`).

---

## Build nativo (Android)

```bash
ionic build
npx cap sync android
npx cap open android
```

### Pantalla completa

En dispositivo nativo, la app oculta la barra de estado del sistema (`StatusBar.hide()` + overlay) para experiencia inmersiva. Configuración en `src/app/app.component.ts` y `capacitor.config.ts`.

---

## Flujo del jugador

1. Ingresar código de sala y alias.
2. Esperar en lobby hasta que el host inicie.
3. Leer briefing de rol (~14 s) y confirmar.
4. **Noche:** elegir acción/objetivo si el rol lo permite; completar minijuegos (skill checks) cuando el servidor los envíe.
5. **Día / Votación:** debatir (chat público) y votar objetivo o abstenerse.
6. **Black Hat en noche:** canal de chat hacker exclusivo del equipo.
7. Si muere: pantalla roja de nodo caído + chat de muertos.
8. Al terminar la partida: overlay de victoria/derrota → *Volver al login*.

---

## Chat por canal

| Canal | Quién | Cuándo |
|-------|-------|--------|
| `public` | Vivos | Lobby, día, votación, fin |
| `hacker` | Black Hat vivos | Noche (y fases públicas si el rol lo permite) |
| `dead` | Eliminados | Fases públicas, noche y verificación |

Rate-limit: 3 s entre mensajes, máx. 10/minuto (ver backend `ChatManager.ts`).

---

## Estructura relevante

```
src/app/
├── pages/
│   ├── login/                 # Entrada a sala
│   └── dashboard/             # Partida activa
├── components/
│   ├── text-challenge/        # Minijuegos / skill checks
│   ├── action-progress/       # Barra de progreso de acción
│   ├── home-atmosphere/       # Fondo cyber (partículas)
│   └── lobby-closed-overlay/  # Sala cerrada por host
├── services/
│   ├── socket/                # Socket.io /game
│   └── game-sound.service.ts  # SFX y hápticos
└── core/
    ├── role-actions.ts        # Acciones por rol
    └── models/                # Tipos de estado
```

---

## Reconexión

Si se pierde la conexión, la app reintenta `joinRoom` con el mismo `playerId` guardado en `localStorage`. Si la sala terminó o el host cerró el lobby, redirige a login con mensaje explicativo.

---

## Pruebas

[`TESTING.md`](../TESTING.md) — secciones de conexión, noche, chat y fin de partida.

---

## Documentación relacionada

- [README principal](../README.md)
- [Catálogo de roles](../ROLES.md)
- [Contrato socket](../SOCKET_CONTRACT.md)
- [Changelog](../CHANGELOG.md)
