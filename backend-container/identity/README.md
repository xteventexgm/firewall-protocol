# Servicio de identidad (`@firewall/identity-service`)

Registro, login, JWT, sesiones, perfil, historial de partidas y correos transaccionales.

## Puerto

- **3002** (red interna Docker)
- Público vía gateway: `http://localhost:3000/api/auth/*`

## Arranque local

```bash
cd backend-container/identity
cp .env.example .env
npm install
PORT=3002 npm start
```

## Docker

Desde la raíz del repo:

```bash
docker compose up -d --build identity
docker compose logs -f identity
```

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio |
| GET | `/api/auth/status` | Auth habilitado, flags |
| POST | `/api/auth/register` | Alta de cuenta |
| POST | `/api/auth/login` | Login (`login`: correo o username) |
| POST | `/api/auth/refresh` | Renovar access token |
| POST | `/api/auth/logout` | Cerrar sesión (refresh) |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/auth/profile` | Perfil + participaciones |
| GET | `/api/auth/verify` | Validar Bearer (otros servicios) |
| POST | `/api/auth/forgot-password` | Código de recuperación |
| POST | `/api/auth/reset-password` | Nueva contraseña con código |
| GET/POST | `/api/auth/verify-email` | Verificar correo (web o API) |
| POST | `/api/auth/resend-verification` | Reenviar correo (Bearer) |
| POST | `/api/auth/request-delete-account` | Enviar código eliminar cuenta |
| POST | `/api/auth/confirm-delete-account` | Confirmar borrado (código + password) |
| POST | `/api/auth/change-password` | Cambiar contraseña |
| PATCH | `/api/auth/username` | Cambiar username |
| POST | `/api/auth/link-guest` | Vincular id invitado |
| GET | `/api/auth/brand/icon.png` | Logo (favicon páginas web) |
| GET | `/api/auth/participations` | Historial de partidas |

**Avatares:** upload/serve en servicio [`media`](../media/README.md); rutas legacy `/api/auth/avatars/*` en el gateway.

## Variables clave (`.env`)

| Variable | Descripción |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas |
| `JWT_SECRET` | Firma JWT |
| `SMTP_*` | Envío de correos |
| `APP_PUBLIC_URL` | URL pública del gateway (enlaces en correos) |
| `REQUIRE_EMAIL_VERIFICATION` | Bloquea join sin verificar (game-realtime) |
| `MEDIA_URL` | `http://media:3003` — borrar avatar al eliminar cuenta |
| `INTERNAL_SERVICE_KEY` | Auth entre servicios |

## Paquete npm

Exporta utilidades para `game-realtime`:

```json
"@firewall/identity-service": "file:../identity"
```

Tras cambios: `npm install` en `game-realtime/` y rebuild Docker.

## Consumo desde otros servicios

- **game-realtime:** `verifyAccessToken`, `findUserById`, `isEmailVerified` en `joinRoom`
- **media:** PATCH avatar URL vía HTTP interno
- **gateway:** proxy directo
