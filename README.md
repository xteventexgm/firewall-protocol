<p align="center">
  <img src="web-dashboard/public/icon.png" alt="Firewall Protocol" width="96" height="96" />
</p>

<h1 align="center">Firewall Protocol</h1>

<p align="center">
  <strong>Thriller de deducción social multijugador</strong> con temática de ciberseguridad.<br/>
  5–15 jugadores · roles secretos · noche/día · votaciones · victoria en tiempo real.
</p>

<p align="center">
  <a href="#qué-es-el-juego">Qué es</a> ·
  <a href="#arquitectura">Arquitectura</a> ·
  <a href="#inicio-rápido">Inicio rápido</a> ·
  <a href="#documentación">Documentación</a> ·
  <a href="CHANGELOG.md">Cambios recientes</a>
</p>

---

## Qué es el juego

**Firewall Protocol** es un juego de mesa digital inspirado en *Mafia* / *Werewolf*, ambientado en un datacenter bajo ataque. Los jugadores son **nodos de una red**: administradores, analistas, hackers y roles caóticos con agendas propias.

| Elemento | Descripción |
|----------|-------------|
| **Equipos** | **System** (defensa), **Black Hat** (ataque) y roles **Caóticos** con victorias solitarias |
| **Ciclo** | **Noche** (acciones secretas en el móvil) → **Día** (debate e incidentes) → **Votación** (expulsar sospechosos) |
| **Roles** | 16 roles únicos: escaneos SOC, antivirus, honeypots, ransomware, gusano, minero de cripto, etc. |
| **Host** | Una pantalla grande (PC/TV) muestra la topología, votos y logs públicos — **sin revelar roles vivos** |
| **Jugadores** | Cada uno usa su teléfono como terminal secreta: rol, acciones nocturnas, chat y votos |

La partida termina cuando un bando cumple su condición de victoria o un rol solitario gana (Troll baneado, Gusano/Minero último superviviente, etc.). Ver [`WIN_CONDITIONS.md`](WIN_CONDITIONS.md) y [`ROLES.md`](ROLES.md).

---

## Arquitectura

Monorepo con tres aplicaciones y un contrato socket compartido:

```
┌─────────────────┐     Socket.io /game      ┌──────────────────┐
│  mobile-terminal │ ◄──────────────────────► │                  │
│  (Ionic/Angular) │                          │  backend-server  │
└─────────────────┘                          │  Node + Socket.io│
                                             │                  │
┌─────────────────┐   Socket.io /dashboard   │                  │
│  web-dashboard  │ ◄──────────────────────► │                  │
│  (Angular)      │                          └────────┬─────────┘
└─────────────────┘                                   │
                                              Persistencia: MongoDB
                                              (o JSON en data/games/)
                                              Avatares: data/avatars/
```

| Carpeta | Rol | Audiencia |
|---------|-----|-----------|
| [`backend-server/`](backend-server/) | Autoridad del juego: fases, reglas, victoria, chat | Servidor |
| [`mobile-terminal/`](mobile-terminal/) | Terminal del jugador: login, rol, acciones, chat | Teléfonos |
| [`web-dashboard/`](web-dashboard/) | Centro de mando: QR, topología 3D, host, replay | PC / TV |

**Contrato de eventos:** [`SOCKET_CONTRACT.md`](SOCKET_CONTRACT.md)  
**Tipos canónicos:** [`backend-server/src/types/events.types.ts`](backend-server/src/types/events.types.ts)

---

## Inicio rápido

### 1. Backend (obligatorio)

```bash
cd backend-server
npm install
npm run dev
```

Servidor en `http://localhost:3000`. Ver [`backend-server/README.md`](backend-server/README.md).

### 2. Dashboard (host)

```bash
cd web-dashboard
npm install
ng serve
```

Abre `http://localhost:4200` → crea sala → muestra QR/código `FIRE-XXXX`.

### 3. Terminal móvil (jugadores)

```bash
cd mobile-terminal
npm install
ionic serve
```

En red local, apunta la URL del socket al IP del servidor. En producción, compila con Capacitor para Android/iOS. Ver [`mobile-terminal/README.md`](mobile-terminal/README.md).

### Prueba en red externa

Si los móviles no están en la misma LAN, expón el backend con un túnel (ngrok, localtunnel, etc.) y configura la URL en `environment.ts` de cada cliente.

---

## Flujo típico de una partida

1. **Host** crea sala en web-dashboard (5–15 jugadores).
2. **Jugadores** escanean QR o ingresan `FIRE-XXXX` en el móvil.
3. **Host** pulsa *Iniciar partida* → reparto automático de roles.
4. Cada móvil muestra briefing de rol; la TV muestra *RED COMPROMETIDA*.
5. **Noche:** jugadores con habilidad actúan desde el móvil; la TV muestra progreso.
6. **Día:** reporte de incidentes (bajas nocturnas sin revelar atacante).
7. **Votación:** expulsión por mayoría; posible victoria inmediata si se cumple condición.
8. **Fin:** overlay de victoria en todos los dispositivos; host puede exportar replay JSON.

Guía de QA paso a paso: [`TESTING.md`](TESTING.md).

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [`ROLES.md`](ROLES.md) | Catálogo de los 16 roles, habilidades y victorias |
| [`WIN_CONDITIONS.md`](WIN_CONDITIONS.md) | Condiciones de victoria/derrota y orden de evaluación |
| [`SOCKET_CONTRACT.md`](SOCKET_CONTRACT.md) | Eventos Socket.io (`/game` y `/dashboard`) |
| [`TESTING.md`](TESTING.md) | Checklist manual de pruebas |
| [`CHANGELOG.md`](CHANGELOG.md) | Historial de cambios del proyecto |
| [`DATABASE.md`](DATABASE.md) | Esquema MongoDB, auth, scripts `db:*` |
| [`MICROSERVICES.md`](MICROSERVICES.md) | Evolución monolito → Redis → microservicios |
| [`STORAGE_AND_AVATARS.md`](STORAGE_AND_AVATARS.md) | Avatares, GridFS, S3 y backups |
| [`SOUND_AI_PROMPTS.md`](SOUND_AI_PROMPTS.md) | Prompts para generar efectos de sonido con IA |
| [`backend-server/README.md`](backend-server/README.md) | API, motor de reglas, persistencia |
| [`web-dashboard/README.md`](web-dashboard/README.md) | Dashboard host, build y despliegue |
| [`mobile-terminal/README.md`](mobile-terminal/README.md) | App Ionic, Capacitor y pantalla completa |

---

## Stack tecnológico

| Capa | Tecnologías |
|------|-------------|
| Backend | TypeScript, Node.js, Express, Socket.io |
| Web dashboard | Angular 20, Three.js (topología 3D), Tailwind |
| Mobile terminal | Ionic, Angular, Capacitor, Socket.io-client |
| Datos | JSON en disco (`data/games/`), preparado para MongoDB |

---

## Estado del proyecto

Proyecto de grado — **Programación Móvil**. El backend es la fuente de verdad del estado; los clientes son vistas sincronizadas en tiempo real.

Funcional hoy: matchmaking, 16 roles, noche/día/votación, minijuegos (skill checks), chat por canales, victoria, reconexión, persistencia y export de replay.

Pendiente / roadmap: JWT en sockets, tests automatizados amplios, MongoDB, despliegue multi-instancia.

---

## Licencia y créditos

Proyecto académico — *Firewall Protocol Master Document (GDD)*.  
Desarrollo colaborativo: backend, dashboard web y terminal móvil.
