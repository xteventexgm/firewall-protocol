# Servicio media — avatares

Upload, lectura y borrado de fotos de perfil. Almacenamiento en **Cloudflare R2**, S3-compatible o **disco local**.

## Puerto

- **3003** (red interna)
- Público vía gateway:
  - `/api/media/*`
  - `/api/auth/avatar`, `/api/auth/avatars/*` (compatibilidad móvil)

## Arranque local

```bash
cd backend-container/media
cp .env.example .env
npm install
PORT=3003 npm start
```

## Docker

```bash
docker compose up -d --build media
```

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/media/avatar` | Bearer | Subir avatar (multipart) |
| DELETE | `/api/media/avatar` | Bearer | Borrar avatar del usuario |
| GET | `/api/media/avatars/:userId` | — | Servir imagen (proxy, no expone R2) |
| DELETE | `/api/media/internal/avatars/:userId` | Interno | Borrado al eliminar cuenta (identity) |

El móvil usa `POST/GET/DELETE /api/auth/avatar(s)/…` — el **gateway** reescribe a `/api/media/…`.

## Almacenamiento

| `AVATAR_STORAGE` | Destino |
|------------------|---------|
| `disk` | Volumen / carpeta local |
| `r2`, `s3`, `minio` | Bucket S3-compatible |

Variables: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` (o prefijos `R2_*`).

Ver [`STORAGE_AND_AVATARS.md`](../../STORAGE_AND_AVATARS.md).

## Integración con identity

Tras upload/delete, `media` actualiza `users.avatarUrl` en identity vía:

`PATCH /api/auth/users/:userId/avatar` + `X-Internal-Service-Key`

Al **eliminar cuenta**, identity llama:

`DELETE /api/media/internal/avatars/:userId`

Esto borra los objetos en R2 (todas las extensiones jpg/png/webp).

## Límites

- Máx. **2 MB** por archivo
- Tipos: JPEG, PNG, WebP
