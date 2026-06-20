# Web Dashboard — Firewall Protocol

Centro de mando para el **host** de la partida. Se ejecuta en PC o TV conectada a la misma red que el servidor y los móviles de los jugadores.

<p align="center">
  <img src="public/icon.png" alt="Firewall Protocol" width="64" height="64" />
</p>

## Qué hace

| Función | Descripción |
|---------|-------------|
| **Crear sala** | Genera código `FIRE-XXXX`, capacidad 5–15, QR para móviles |
| **Control de fases** | Iniciar partida, avanzar noche/día/votación (solo el host) |
| **Topología** | Vista 3D de nodos: vivos, muertos, desconectados, infecciones |
| **Votación** | Líneas animadas entre votante y objetivo |
| **Logs públicos** | Feed SIEM de eventos nocturnos (sin filtrar roles vivos) |
| **Chat** | Mensajes del canal público |
| **Victoria** | Overlay con ganadores, revelación de roles, MVP y export replay |
| **Sonido** | Ambiente y SFX por fase, incidente, voto y game over |

Los jugadores **no** usan esta app; cada uno juega desde [`mobile-terminal`](../mobile-terminal/).

---

## Requisitos

- Node.js 18+
- Backend en marcha ([`backend-server`](../backend-server/))
- Navegador moderno (Chrome, Edge, Firefox)

---

## Desarrollo

```bash
cd web-dashboard
npm install
ng serve
```

Abre `http://localhost:4200`.

### URL del servidor

Configura el endpoint Socket.io en:

`src/environments/environment.ts` (y `environment.prod.ts` para build de producción).

```typescript
export const environment = {
  production: false,
  socketUrl: 'http://localhost:3000',
};
```

En red LAN, usa la IP de la máquina que ejecuta el backend (ej. `http://192.168.1.10:3000`).

---

## Uso como host

### Antes de empezar

1. Conecta el dashboard al servidor (indicador verde en el panel).
2. Crea sala y comparte QR o código `FIRE-XXXX`.
3. Espera al menos **5 jugadores** conectados.
4. Opcional: configura timers de noche/día y auto-avance.

### Durante la partida

- El panel lateral pasa a **modo compacto**: solo código, fase actual, *Avanzar fase* y *Volver al lobby*.
- El QR y la configuración de timers se ocultan para dar espacio a la topología.
- *Volver al lobby* cierra la vista de partida en TV **sin** borrar la sala en el servidor.

### Tras el fin

- Overlay de victoria con botones: *Volver al lobby*, *Iniciar nueva partida*, *Descargar replay JSON*.
- Los roles de todos los jugadores quedan visibles en la lista del panel (fase `FIN`).

---

## Build de producción

```bash
ng build
```

Artefactos en `dist/web-dashboard/`. Sirve la carpeta con cualquier servidor estático o integra en tu pipeline.

---

## Estructura relevante

```
src/app/
├── app.ts / app.html          # Shell: lobby + escenario principal
├── core/
│   ├── models/                # Tipos alineados con SOCKET_CONTRACT
│   ├── services/              # game-socket, game-sound
│   └── utils/                 # game, layout, replay, night-resolution
└── features/
    ├── lobby/                 # Crear sala, QR, controles host
    ├── topology/              # Vista 2D/3D de la red
    ├── votes/                 # Líneas de votación
    ├── phases/                # Overlays de fase, briefing, progreso noche
    ├── game-over/             # Pantalla de victoria
    ├── public-logs/           # Logs SIEM nocturnos
    └── chat/                  # Feed de chat público
```

---

## Sonidos

Los assets SFX viven en `public/sfx/` (o rutas configuradas en `GameSoundService`). Para generar nuevos sonidos con IA, ver [`SOUND_AI_PROMPTS.md`](../SOUND_AI_PROMPTS.md) en la raíz del monorepo.

---

## Pruebas

Checklist manual compartido: [`TESTING.md`](../TESTING.md).

```bash
ng test    # unit tests Karma (si están configurados)
```

---

## Documentación relacionada

- [README principal](../README.md)
- [Contrato socket](../SOCKET_CONTRACT.md)
- [Condiciones de victoria](../WIN_CONDITIONS.md)
- [Changelog](../CHANGELOG.md)
