# Almacenamiento de archivos y avatares — Firewall Protocol

Guía sobre **dónde viven los datos**, por qué los avatares están en disco hoy, **alternativas** (MongoDB, nube) y **cuándo** tiene sentido microservicios para esto.

**Relacionado:** [`DATABASE.md`](DATABASE.md) · [`CHANGELOG.md`](CHANGELOG.md)

**Última revisión:** junio 2026

---

## 1. Resumen ejecutivo

| Tipo de dato | Dónde está hoy | ¿En MongoDB? |
|--------------|----------------|--------------|
| Partidas activas/archivadas | Colección `games` | Sí |
| Usuarios, sesiones, historial | `users`, `auth_sessions`, `game_participations` | Sí |
| **Archivos de avatar (PNG/JPG/WebP)** | **MinIO** (bucket `avatars`) o **disco** `data/avatars/` según `AVATAR_STORAGE` | **No** (solo la ruta en `users.avatarUrl`) |
| Partidas sin Mongo (`MONGO_URI` vacío) | JSON `data/games/*.json` | No |

**Los avatares en disco no es un requisito de diseño permanente** — es la opción más simple para la fase actual del proyecto (monolito, LAN, pocos usuarios). Se puede migrar a MongoDB GridFS o a almacenamiento en nube **sin** dividir en microservicios.

**Almacenamiento configurable:** `AVATAR_STORAGE=disk` (default) o `minio`. MinIO vive en el **monolito** (no hace falta microservicio solo por avatares). Ver §2.1.

---

## 2. Implementación actual (`AVATAR_STORAGE`)

| Modo | Variable | Dónde van los bytes |
|------|----------|---------------------|
| **Disco** (default) | `AVATAR_STORAGE=disk` | `backend-server/data/avatars/<userId>.{ext}` |
| **MinIO** | `AVATAR_STORAGE=minio` + `MINIO_*` | Bucket S3 (`MINIO_BUCKET`, p. ej. `avatars`) |

Código: `AvatarService.ts`, `minioClient.ts`, rutas en `auth.routes.ts`.

El móvil **siempre** consume `GET /api/auth/avatars/:userId` — el backend hace de **proxy** hacia disco o MinIO; el cliente no habla con el puerto 9000.

### 2.1 MinIO en el monolito (no microservicio)

MinIO es un **servicio de infraestructura** (como MongoDB), no un microservicio de aplicación. El backend sube con el SDK `minio` y sirve por la misma API HTTP.

```env
AVATAR_STORAGE=minio
MINIO_ENDPOINT=localhost      # en Docker Compose: minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=avatars
```

**Arranque local:**

```bash
cd backend-server
docker compose up minio -d    # consola web :9001
npm start
```

**Migrar avatares ya en disco:**

```bash
AVATAR_STORAGE=minio npm run avatars:migrate-to-minio
```

**Health:** `GET /health` incluye `avatars.storage` y estado MinIO.

Un **Media microservicio** separado solo tendría sentido con mucho tráfico de uploads, CDN propia o equipo que despliegue auth/assets aparte del juego.

---

## 3. Por qué el disco sigue siendo el fallback por defecto

Código: `backend-server/src/services/AvatarService.ts`

| Decisión | Motivo |
|----------|--------|
| Archivos en `data/avatars/<userId>.{jpg\|png\|webp}` | Sin dependencias extra; funciona igual en dev y con Docker volume |
| En MongoDB solo `users.avatarUrl` | Ruta API (`/api/auth/avatars/:userId`) o URL externa `https://…` |
| Límite 2 MB, tipos JPEG/PNG/WebP | Suficiente para foto de perfil; evita inflar la BD |
| No se muestran en partida | Solo pantalla de cuenta en móvil — no afecta sockets ni latencia de juego |

### Ventajas del disco en fase 0

- Implementación rápida (multer + `fs.writeFile`).
- Backups separados: `mongodump` para datos + copia de `data/avatars/` para imágenes.
- El servidor sirve la imagen con `GET /api/auth/avatars/:userId` sin leer documentos grandes en cada consulta de perfil.

### Desventajas

- **Otra PC / otro contenedor** sin copiar `data/avatars/` → usuarios existen en Mongo pero la foto puede faltar (404).
- **Varias instancias del backend** (escalado horizontal) → cada nodo tiene su propia carpeta; un upload en el nodo A no se ve en el nodo B.
- Los backups deben incluir **dos sitios** (Mongo + carpeta).

Por eso, al pasar a producción o a varias máquinas, conviene migrar blobs a un almacén compartido (ver §4).

---

## 3. ¿Se pueden subir los PNG a MongoDB?

**Sí.** MongoDB puede guardar binarios de varias formas:

### 3.1 GridFS (recomendado si todo queda en Mongo)

- Colecciones `fs.files` + `fs.chunks` (o prefijo custom).
- Adecuado para archivos >16 MB o cuando quieres streaming; también sirve para avatares de 2 MB.
- **Un solo backup** (`mongodump`) incluye usuarios e imágenes.
- El monolito seguiría exponiendo `GET /api/auth/avatars/:userId` leyendo desde GridFS en lugar de disco.

```text
POST /api/auth/avatar  →  multer buffer  →  GridFS.uploadStream  →  users.avatarUrl = gridfs://...
GET  /api/auth/avatars/:userId  →  openDownloadStream(userId)
```

### 3.2 Binario embebido en `users` (no recomendado)

- Campo `avatarData: BinData` en el documento del usuario.
- Simple pero **hincha** cada lectura de perfil; límite 16 MB por documento; mala práctica para APIs que listan usuarios.

### 3.3 Solo URL en Mongo (ya soportado parcialmente)

- `users.avatarUrl = "https://cdn.ejemplo.com/…"` — el archivo vive fuera (Imgur, S3, Cloudinary).
- El backend no almacena bytes; el móvil carga la URL directamente.
- Útil si no quieres servir imágenes desde tu API.

### Comparativa rápida (avatares ~100 KB–2 MB)

| Opción | Complejidad | Multi-instancia | Backup | Cuándo elegirla |
|--------|-------------|-----------------|--------|-----------------|
| **Disco local** (actual) | Baja | Mala | Mongo + carpeta | Dev, LAN, una sola máquina |
| **GridFS** | Media | Buena (una Mongo) | Solo Mongo | Quieres todo centralizado sin S3 |
| **URL externa** | Baja | Excelente | Solo Mongo | Ya usas CDN o no quieres servir bytes |
| **S3 / R2 / Cloudinary** | Media–alta | Excelente | Proveedor + Mongo | Producción real, muchos usuarios |
| **Microservicio Media** | Alta | Excelente | Por servicio | Escala y equipo grande (§5) |

---

## 4. Otras opciones para imágenes (PNG, WebP, etc.)

### 4.1 Object storage (S3, MinIO, Cloudflare R2)

- El backend sube con SDK (`@aws-sdk/client-s3`); guarda en Mongo solo la URL pública o firmada.
- Estándar en producción; barato; CDN delante.
- **No requiere microservicio** — puede vivir en el mismo `AuthService` / rutas `/api/auth/avatar`.

### 4.2 Cloudinary / Uploadcare

- Upload directo desde el móvil con token firmado; transformaciones (resize, WebP).
- Menos carga en tu servidor; coste por uso.

### 4.3 Volumen Docker compartido

- Montar `mongo_data` + `avatar_data` en `docker-compose.yml`.
- Mejora un solo host Docker; **no** resuelve varias VMs sin NFS/EFS.

### 4.4 Recomendación por fase

```text
Hoy (grado / LAN)
  → Disco local + backup manual de data/avatars/

Siguiente paso (misma BD, sin microservicios)
  → GridFS en el monolito O MinIO/S3 con URL en users.avatarUrl

Producción seria / varias regiones
  → S3/R2 + CDN; opcional servicio Media si el equipo crece
```

---

## 5. ¿Aquí entran los microservicios?

**No es obligatorio** para guardar avatares en Mongo o en S3. Un monolito puede:

- Subir a GridFS o S3 desde `POST /api/auth/avatar`.
- Servir o redirigir desde `GET /api/auth/avatars/:userId`.

Los microservicios entran cuando el **dominio** o la **operación** justifican desplegar y escalar por separado — no porque el archivo sea un PNG.

### 5.1 Qué problema resuelve cada capa

| Problema | Solución mínima | ¿Microservicio? |
|----------|-----------------|-----------------|
| Persistir usuarios y partidas | MongoDB en monolito | No |
| Avatares en varias instancias | GridFS, S3 o volumen compartido | No |
| Auth JWT + registro | Rutas `/api/auth/*` en monolito (ya hecho) | Opcional más adelante |
| Muchas salas en tiempo real | Monolito con estado en memoria + persistencia MongoDB | No (suficiente para grado) |
| Equipo separado despliega auth sin tocar juego | **Auth Service** (Fase 2) | Sí |
| Tráfico masivo de uploads/CDN | **Media / Assets Service** o S3 directo | A veces |

### 5.2 Cuándo sí un “Media Service”

Considerar un servicio dedicado solo si:

- Subidas y descargas compiten con CPU del Game Realtime.
- Necesitas colas de procesamiento (resize, moderación, virus scan).
- Políticas de retención y CDN distintas al API de juego.
- Varios productos (web, móvil, admin) consumen los mismos assets.

Para **Firewall Protocol** (fotos de perfil opcionales, no en partida): **GridFS o S3 en el monolito es suficiente** para el alcance actual del proyecto.

### 5.3 Orden sugerido

```text
1. MongoDB para games + users          ← hecho
2. Avatares: GridFS o S3 en monolito   ← siguiente mejora de storage
3. Extraer Auth Service (opcional)
4. Media Service o CDN                 ← solo si hace falta
```

Ver también [ROADMAP_BACKEND.md](docs/ROADMAP_BACKEND.md) § P2 para evolución del backend.

---

## 6. Backups y otra PC

### Con MongoDB + avatares en disco (hoy)

```bash
# Datos
mongodump --uri="mongodb://localhost:27017/firewall_protocol" --out=./backup-fp

# Imágenes
cp -r backend-server/data/avatars ./backup-fp-avatars
```

Restaurar en otra máquina: Mongo arriba → `mongorestore` → `npm run db:setup` (si BD vacía) → copiar `data/avatars/` → mismo `.env`.

### Con GridFS o S3

- **GridFS:** solo `mongodump` / snapshots del volumen Mongo.
- **S3:** backup del bucket (versionado) + Mongo de metadatos; los avatares no van en el servidor de juego.

### Primera vez en una PC nueva

1. Instalar o levantar MongoDB (`docker compose up` en `backend-server/`).
2. Copiar `.env` (`MONGO_URI`, `JWT_SECRET`).
3. `npm run db:setup` (colecciones, índices, roles).
4. Restaurar dump **o** empezar con BD vacía.
5. Si usas disco local: copiar `data/avatars/`.

---

## 7. API actual de avatares

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/avatar` | Subida multipart (`avatar`), máx. 2 MB |
| `DELETE` | `/api/auth/avatar` | Borra archivo y `avatarUrl` |
| `GET` | `/api/auth/avatars/:userId` | Sirve bytes desde disco |
| `PATCH` | `/api/auth/profile` | `avatarUrl` externa `https://…` (opcional) |

Implementación: `backend-server/src/routes/auth.routes.ts`, `AvatarService.ts`.

---

## 8. Roadmap de implementación (storage)

| Prioridad | Tarea | Microservicio |
|-----------|-------|---------------|
| P0 | Documentar backups Mongo + `data/avatars/` | No |
| P1 | `MongoAvatarAdapter` con GridFS; migrar `AvatarService` | No |
| P1 | Script `npm run db:migrate-avatars-to-gridfs` | No |
| P2 | S3/R2 opcional vía env `AVATAR_STORAGE=s3` | No |
| P3 | Auth Service extraído (JWT, users, avatar) | Fase 2 |
| P4 | Media Service + CDN | Solo si escala lo exige |

---

## 9. Referencias en el repositorio

| Archivo | Contenido |
|---------|-----------|
| `backend-server/src/services/AvatarService.ts` | Lectura/escritura en disco |
| `backend-server/src/routes/auth.routes.ts` | Endpoints HTTP |
| `backend-server/data/avatars/` | Archivos subidos (gitignored) |
| `backend-server/docker-compose.yml` | Mongo + volumen `mongo_data` |
| `backend-server/scripts/setup-mongodb.ts` | Colecciones e índices (no incluye GridFS aún) |
| [`DATABASE.md`](DATABASE.md) | Esquema `users.avatarUrl` |
| [`docs/ROADMAP_BACKEND.md`](docs/ROADMAP_BACKEND.md) | Evolución monolito → microservicios |

---

## Resumen en una frase

**Los avatares están en disco por simplicidad en el monolito; puedes moverlos a MongoDB GridFS o a S3 sin microservicios; los microservicios tienen sentido para escalar dominios (auth, juego, analytics), no porque el archivo sea un PNG.**
