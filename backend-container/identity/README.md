# Servicio de identidad (`@firewall/identity-service`)

Registro, login, JWT, sesiones, perfil e historial de participaciones.

## Arranque local

```bash
cd backend-container/identity
cp .env.example .env
# Edita JWT_SECRET y MONGO_URI (mismos valores que backend-server durante la migración)
npm install
npm start
```

El servicio escucha en **http://localhost:3001**.

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio |
| GET | `/api/auth/status` | Auth habilitado |
| POST | `/api/auth/register` | Alta de cuenta |
| POST | `/api/auth/login` | Login (campo `login`: email o username) |
| POST | `/api/auth/refresh` | Renovar access token |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/auth/profile` | Perfil + participaciones |
| GET | `/api/auth/verify` | Validar Bearer token (otros servicios) |

**Avatares** (upload/serve) siguen en el monolito (`backend-server`) hasta el servicio `media`.

## Docker

### Opción A — Docker Desktop (recomendado)

1. Asegúrate de tener `.env` en esta carpeta (`cp .env.example .env` y edítalo).
2. **Detén** cualquier `npm start` local en el puerto 3001 (solo uno puede usar ese puerto).
3. En Docker Desktop: **Containers** → **Create** no hace falta; usa Compose:
   - Abre una terminal en `backend-container/identity/`
   - Ejecuta:

```bash
docker compose up -d --build
```

4. En Docker Desktop verás el proyecto **`identity`** con el contenedor `firewall-protocol-identity`.
5. Para pararlo: `docker compose down` o el botón **Stop** en la UI.

### Opción B — imagen manual

```bash
docker build -t firewall-identity .
docker run --rm -p 3001:3001 --env-file .env firewall-identity
```

## Consumo desde el monolito

`backend-server` importa utilidades compartidas vía dependencia local:

```json
"@firewall/identity-service": "file:../backend-container/identity"
```

Tras cambios en identity, ejecuta `npm install` en `backend-server/`.
