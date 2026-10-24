# Document Repository

A proof of concept for a corporate document repository: employees upload, store, search, preview, download and version documents, and access is controlled by department. Built for the EEMW full-stack software engineer assessment.

**Demo video:** (https://drive.google.com/file/d/1KU9G2xPaR9JFdPH17EdMnNPWkHRDB5Sg/view?usp=drivesdk)

## Summary

This project is a scalable-by-design document repository. A **Node.js (Express, TypeScript)** REST API stores file metadata, versions, tags and permissions in **PostgreSQL**, keeps the files behind a swappable storage layer (local Docker volume today, S3-style storage later) and caches search results in **Redis**. A **Next.js (App Router)** frontend styled with **Tailwind CSS** provides login, an upload form, a search page and a document detail page with version history. Users belong to a department and have a role; documents are either public or restricted to selected departments, and that rule is enforced in the API and inside the search query itself. Uploading a new version never overwrites anything: the history is kept, and any old version can be restored. The whole system starts with one command (`docker compose up --build`) and comes with demo users and documents.

## Contents

1. [Quick start](#1-quick-start)
2. [What it does](#2-what-it-does)
3. [Assessment requirements and where to find them](#3-assessment-requirements-and-where-to-find-them)
4. [Architecture](#4-architecture)
5. [Design decisions](#5-design-decisions)
6. [Database design](#6-database-design)
7. [API reference](#7-api-reference)
8. [Security](#8-security)
9. [Testing](#9-testing)
10. [Project structure](#10-project-structure)
11. [Configuration](#11-configuration)
12. [Assumptions](#12-assumptions)
13. [Limitations and what I would do next](#13-limitations-and-what-i-would-do-next)

---

## 1. Quick start

### Run everything with Docker (recommended)

Requirements: Docker Desktop (or Docker Engine with the Compose plugin). Nothing else needs to be installed.

```bash
git clone https://github.com/jjanahassan/EEMW-assessment.git
cd EEMW-assessment
docker compose up --build
```

The first build takes a few minutes. When the logs show `API running on http://localhost:4000`, open **http://localhost:3000**.

On start, the API container applies the database migrations and creates the demo users and four demo documents (set `SEED_DEMO_DATA=false` to skip the demo data). Data is kept in Docker volumes, so it survives restarts.

```bash
docker compose ps                # all four services should be "healthy"
docker compose logs -f backend   # follow the API logs
docker compose down              # stop, keep the data
docker compose down -v           # stop and delete the database, cache and uploaded files
```

### Demo accounts

All accounts use the password `Password123!`. The login page also has one-click buttons for them.

| Account | Department | Role |
|---|---|---|
| admin@company.com | Engineering | admin |
| finance.manager@company.com | Finance | manager |
| finance.employee@company.com | Finance | employee |
| legal.manager@company.com | Legal | manager |
| hr.employee@company.com | Human Resources | employee |
| engineer@company.com | Engineering | employee |

Demo documents: *Annual Finance Report* (restricted: Finance and Legal), *Vendor Contract Template* (restricted: Legal and Finance), *Employee Leave Policy* (public) and *API Technical Guide* (public). Try logging in as the HR employee: restricted documents never appear in search and open as "no access".

### Run for development (backend and frontend separately)

Requirements: **Node.js 22 LTS** (the Docker images use `node:22-alpine`; Next.js 16 needs Node 20.9 or newer) and Docker for the database.

```bash
# 1. Database and Redis only
docker compose up -d postgres redis

# 2. Backend (http://localhost:4000)
cd backend
cp .env.example .env            # set JWT_SECRET to a long random string
npm install
npm run migrate up              # create the schema
npm run seed                    # demo users
npm run seed:documents          # demo documents (uses samples/report.pdf)
npm run dev

# 3. Frontend (http://localhost:3000), in a second terminal
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Then open **http://localhost:3000**. If the containerized backend or frontend are running, stop them first (`docker compose down`), because they use the same ports 3000 and 4000.

### Troubleshooting

| Problem | Fix |
|---|---|
| Port 3000, 4000, 5432 or 6379 already in use | Stop the other process, or `docker compose down` |
| Backend container unhealthy | `docker compose logs backend`; a validation message names the missing or invalid variable |
| Browser shows a CORS error | `CORS_ORIGIN` must equal the address the frontend is opened on (`http://localhost:3000`) |
| "Cannot reach the server" in the UI | The API address is baked in at build time; rebuild with `docker compose up --build` |
| Too many requests (429) | The API rate limit is per IP; restart the API container |
| On Windows, installs fail with `EPERM` | Keep the project outside OneDrive-synced folders |

---

## 2. What it does

**Core features**

- Register and log in (JWT). Users have a department and a role (`admin`, `manager`, `employee`).
- Upload a document with a title, description, tags, visibility (public, or restricted to chosen departments) and a file.
- Search by title, description, tags and uploader, with filters (tags, uploader, file type, date range), sorting and pagination.
- Open a document to see its metadata, current version, download count and full version history.
- Preview (PDF, PNG, JPEG, text) and download any version.
- Upload a new version (the old one is kept) and restore an earlier version.

**Beyond the brief**

- Typo-tolerant ranked search with highlighted matches (`finnance` finds *Finance*, `polic` finds *Policy*).
- Search results cached in Redis with O(1) invalidation; the API reports `X-Cache: HIT/MISS`.
- Tag autocomplete.
- Content validation by magic bytes (a renamed `.exe` or fake PDF is rejected), SHA-256 checksum per version, and a guard against uploading a file identical to the current version.
- Streaming downloads with `ETag` / `304 Not Modified` support and correct UTF-8 (Arabic) file names.
- Version restore that keeps the history intact, safe against concurrent uploads.
- A swappable storage layer and an event bus that decouples side effects (cache invalidation today, audit log next).
- Light and dark theme ("Evergreen") with a one-click toggle and no flash on load.
- One-command Docker setup with migrations and demo data, non-root containers and healthchecks.
- Unit tests for the permission policy, file validation, search query builder, cache, event bus, authentication and version logic.

---

## 3. Assessment requirements and where to find them

| Requirement | Where it is |
|---|---|
| Upload and store files | `POST /api/documents`; multer streams to a temp file, the service validates it and stores it through `StorageProvider` |
| Store metadata (title, tags, permissions, versions) | Tables `documents`, `tags`, `document_tags`, `document_permissions`, `document_versions` |
| Search by title, tags and uploader | `GET /api/documents?q=&tags=&uploader=` (plus filters, sorting, pagination) |
| View and download | `GET /api/documents/:id/view` and `/download` |
| Users with department and role | `users` table, `departments` table, `user_role` enum |
| Documents with multiple tags | Many-to-many `document_tags` |
| New version replaces the old one, history kept | Append-only `document_versions` plus `documents.current_version_id` |
| Restricted to certain departments | `visibility` plus `document_permissions`; enforced by `canAccessDocument` and in the search SQL |
| Backend: upload, search, view/download, version history endpoints | [API reference](#7-api-reference) |
| Frontend: upload form, search page, detail page | `frontend/src/app/upload`, `search`, `documents/[id]` |
| Layers: routes, business logic, data access | [Backend layers](#42-backend-layers) |
| PostgreSQL with keys, relationships and indexes | [Database design](#6-database-design) |
| Redis caching | Search cache, [section 5.5](#55-search) |
| `docker-compose.yml`, whole app through Compose | Repository root |
| API validation and sensible status codes | Zod schemas, custom errors, [error format](#error-format) |
| Architecture diagram and design choices | [Architecture](#4-architecture) and [Design decisions](#5-design-decisions) |
| README with summary, assumptions, run steps, Node version, next steps | This file |
| Deliverables: GitHub repository and video | This repository; video link at the top |

---

## 4. Architecture

### 4.1 System overview

```mermaid
flowchart LR
    U["User's browser"]
    subgraph compose["Docker Compose network"]
        FE["Next.js frontend<br/>App Router, Tailwind"]
        API["Express API<br/>TypeScript, REST"]
        PG[("PostgreSQL 16<br/>metadata, versions, permissions,<br/>full-text search")]
        RD[("Redis 7<br/>search cache")]
        FS["StorageProvider<br/>uploads volume today, S3 later"]
    end
    U -->|"loads the app"| FE
    U -->|"REST and JSON with a Bearer token"| API
    API --> PG
    API --> RD
    API --> FS
```

The system is a **modular monolith**: one API process with clear internal layers. For a proof of concept this is simpler to build, run and reason about than microservices, and the seams (storage interface, event bus, cache) show where it would be split or scaled. The API is stateless (state lives in PostgreSQL, Redis and the storage layer), so several instances can run behind a load balancer.

### 4.2 Backend layers

```mermaid
flowchart TD
    R["Routes and middleware<br/>authenticate, upload, validate"] --> C["Controllers<br/>translate HTTP"]
    C --> S["Services<br/>business rules, transactions"]
    S --> RE["Repositories<br/>SQL only"]
    S --> SP["StorageProvider<br/>interface"]
    S --> EB["EventBus<br/>observer"]
    RE --> PG[("PostgreSQL")]
    SP --> LS["LocalStorageProvider"]
    EB --> CA["Search cache invalidation"]
```

| Layer | Responsibility | Knows nothing about |
|---|---|---|
| Routes and middleware | URL mapping, authentication, file upload, input validation | business rules |
| Controllers | read the request, call a service, send the response | SQL, storage |
| Services | permissions, validation of the real file, versioning rules, transactions | HTTP, SQL text |
| Repositories | all SQL | HTTP, business rules |
| StorageProvider | save, copy, read and delete file bytes | database |

Objects are created and connected in one place, `backend/src/container.ts` (the composition root), and receive their dependencies through constructors. That is what makes the services unit-testable with fake repositories.

### 4.3 Design patterns used

| Pattern | Where | Why |
|---|---|---|
| Repository | `*.repository.ts` | All SQL in one place; services can be tested with fakes |
| Service layer | `*.service.ts` | Business rules independent of HTTP |
| Dependency injection, composition root | `container.ts` | One place decides which implementations are used |
| Strategy / Adapter | `StorageProvider` interface and `LocalStorageProvider` | Swap local disk for S3 without touching business code |
| Observer | `EventBus` | Side effects (cache invalidation, later audit log) without coupling them to the upload code; a failing listener never breaks a request |
| Middleware chain | Express route pipelines | `authenticate`, upload, validation and the handler compose cleanly |
| Cache-aside | `SearchCache` | Read from Redis, fall back to PostgreSQL |
| Schema validation (DTOs) | Zod schemas | Input is validated and converted to typed data at the edge |
| Transaction wrapper | `withTransaction` | All-or-nothing writes |

### 4.4 Technology choices

| Choice | Reason |
|---|---|
| Express + TypeScript (strict) | Small, explicit framework; types catch mistakes early |
| PostgreSQL | Relational integrity for users, documents, versions and permissions, plus built-in full-text search and trigram matching, so no separate search engine is needed |
| `pg` with plain SQL and `node-pg-migrate` | Explicit queries and indexes (needed for full-text and fuzzy search); versioned SQL migrations |
| Redis | Fast cache for repeated searches; optional, the API works without it |
| Zod | One definition for validation and TypeScript types |
| JWT + bcrypt | Stateless authentication that scales across instances |
| Next.js App Router + Tailwind | Modern React framework; Tailwind keeps styling consistent with one approach |
| Vitest | Fast TypeScript-native test runner |
| Docker Compose | One command for the whole stack |

---

## 5. Design decisions

### 5.1 Storage
Files sit behind a `StorageProvider` interface (`save`, `copy`, `getStream`, `delete`). The local implementation writes to a Docker volume and refuses any key that would escape the storage root. Files are stored under generated keys (`documents/<documentId>/<versionId>.<ext>`), never user-supplied names, which removes path-traversal risk. The original file name is kept in the database only. Moving to S3 or MinIO means writing one new class.

### 5.2 Upload validation and atomicity
- Three checks: an extension allowlist (rejected before anything is written), **magic bytes** (the real content must match the claimed type), and a size limit (25 MB). The stored MIME type comes from the server's own mapping, never from the client.
- Allowed types: PDF, DOCX, XLSX, PPTX, TXT, PNG, JPG/JPEG. HTML and SVG are excluded on purpose, because served from the same origin they could run script.
- Authentication runs **before** multer, so anonymous requests never write to disk.
- The file is stored first, then the database rows are written in one transaction. If the transaction fails, the stored file is deleted, so there are no orphan files or rows. Temp files are removed when the response ends, on every path.
- A SHA-256 checksum is stored per version.

### 5.3 Versioning
- A new version inserts a row and moves `documents.current_version_id`. Nothing is overwritten.
- Restoring an old version creates a **new** version that copies the old file (`Restored from version N`), so the history always shows what happened.
- The transaction locks the document row (`SELECT ... FOR UPDATE`) before computing the next version number, so simultaneous uploads queue up instead of colliding on the unique `(document_id, version_number)` constraint.
- Each version owns its stored file, so removing or archiving one version later cannot break another.
- Guards: uploading a file identical to the current version, or restoring the version that is already current, returns 409.

### 5.4 Permissions
A document is visible to a user if **any** of these is true:

1. the user is an `admin`,
2. the user uploaded it,
3. it is `public`,
4. it is `restricted` and the user's department is in `document_permissions`.

For restricted documents the uploader's own department is always added, so a team cannot lock itself out. The rule exists twice with the same meaning: as a pure function (`canAccessDocument`, unit-tested) for single documents, and as a SQL clause inside the search query, so counts and pagination stay correct and restricted documents cannot leak through search. Only admins, the uploader, or a manager of the uploader's department can add or restore versions.

A user who cannot see an existing document gets `403`. (Returning `404` would hide its existence, which is stricter; the trade-off is documented here.)

### 5.5 Search
- **Four ways `q` can match:** full-text search (stemming, so "reports" finds "report"), substring match (`polic` finds "Policy"), trigram word similarity (`finnance` finds "Finance"), and tag names. Results are ranked by `ts_rank` plus word similarity.
- Filters: tags (all or any), uploader name or email, file type, date range. Sort by relevance, newest, oldest, title or downloads. Page size up to 50.
- Matches are highlighted with `ts_headline` using `[[` and `]]` markers; the frontend renders them as React text, never as raw HTML.
- Every user value is a bound parameter, LIKE wildcards are escaped, and `ORDER BY` comes from a whitelist.
- **Redis cache-aside with namespace versioning:** the cache key contains a global version number plus the user's scope (results differ per user). Invalidation is a single `INCR`, O(1), with no key scanning; old keys expire after 60 seconds. The key is built once before computing the result, so a search that races with an upload can never store stale data under the new version. If Redis is down, search still works.
- Pagination uses `OFFSET` with the total from a window function: simple and fine at this scale. Keyset pagination would be the next step for very large tables.

### 5.6 Download and preview
Files are streamed with `stream.pipeline` (flat memory use for large files). `Content-Disposition` carries an ASCII fallback plus an RFC 5987 UTF-8 name, so Arabic file names work. Inline preview is limited to types that cannot run script (PDF, PNG, JPEG, text). The `ETag` is the file's SHA-256 with `Cache-Control: private, no-cache`: the browser asks every time (so permissions are re-checked) but receives `304` instead of the file when nothing changed. The download counter is an atomic increment recorded after a download completes, and a database trigger keeps `updated_at` from changing when only the counter moves.

### 5.7 Authentication
Passwords are hashed with bcrypt (cost 10) and must be 8 to 72 characters with a letter and a digit. JWTs are signed with HS256 (the algorithm is pinned on verification) and carry only the user id; the user is reloaded on each request, so role or department changes and deleted users take effect immediately. Login errors are generic, and a dummy hash comparison runs when the email is unknown, so neither the message nor the response time reveals which emails exist. Self-registration always creates an `employee`.

### 5.8 Frontend
- **One API client** (`lib/api.ts`) attaches the token, converts the API's error format into a typed `ApiError`, reports network failures clearly, and logs the user out on a 401. Components never call `fetch` directly.
- **Search state lives in the URL**, so searches can be shared and the back button works. Typing is debounced and stale requests are cancelled with `AbortController`.
- Files are fetched with the token and shown or saved from blob URLs, because a plain link or iframe cannot send the `Authorization` header.
- Client-side checks mirror the API's rules for fast feedback, and server validation messages are mapped back onto the right form fields. The UI hides Restore and "new version" from users who cannot use them; the server enforces the rule regardless.
- **Theme:** colors are semantic CSS variables (`page`, `surface`, `fg`, `accent`, `highlight`, ...) mapped to Tailwind utilities, so components contain no `dark:` classes. A small script in `<head>` applies the saved theme before the first paint (no flash), and the toggle follows the operating system until the user chooses.
- Built for Next.js 16 Cache Components: components that read the URL sit inside `Suspense` boundaries. TypeScript, ESLint and the production build all pass.

### 5.9 Docker
Multi-stage images keep compilers out of the final images. Both containers run as the non-root `node` user. The API entrypoint applies migrations, optionally seeds demo data, then starts Node as the main process (`exec`), so it receives `SIGTERM` and shuts down gracefully. Every service has a healthcheck and `depends_on` waits for health, so the stack starts in the right order. Database, Redis and uploads live in named volumes.

---

## 6. Database design

```mermaid
erDiagram
    DEPARTMENTS ||--o{ USERS : "has"
    USERS ||--o{ DOCUMENTS : "uploads"
    DOCUMENTS ||--|{ DOCUMENT_VERSIONS : "has history"
    USERS ||--o{ DOCUMENT_VERSIONS : "uploads version"
    DOCUMENTS ||--o{ DOCUMENT_TAGS : "tagged with"
    TAGS ||--o{ DOCUMENT_TAGS : "used by"
    DOCUMENTS ||--o{ DOCUMENT_PERMISSIONS : "restricted to"
    DEPARTMENTS ||--o{ DOCUMENT_PERMISSIONS : "may access"
    USERS ||--o{ AUDIT_LOGS : "performs"
    DOCUMENTS ||--o{ AUDIT_LOGS : "subject of"

    DEPARTMENTS {
        int id PK
        text name UK
    }
    USERS {
        uuid id PK
        text name
        text email UK
        text password_hash
        int department_id FK
        user_role role
    }
    DOCUMENTS {
        uuid id PK
        text title
        text description
        uuid uploader_id FK
        document_visibility visibility
        uuid current_version_id FK
        int download_count
        tsvector search_vector
        timestamptz deleted_at
    }
    DOCUMENT_VERSIONS {
        uuid id PK
        uuid document_id FK
        int version_number
        text file_name
        text storage_key
        text mime_type
        bigint size_bytes
        char checksum_sha256
        uuid uploaded_by FK
        text change_note
    }
    TAGS {
        int id PK
        text name UK
    }
    DOCUMENT_TAGS {
        uuid document_id PK,FK
        int tag_id PK,FK
    }
    DOCUMENT_PERMISSIONS {
        uuid document_id PK,FK
        int department_id PK,FK
    }
    AUDIT_LOGS {
        bigint id PK
        uuid user_id FK
        uuid document_id FK
        text action
        jsonb metadata
    }
```

**How each requirement maps to the schema**

- *Users with department and role:* `users.department_id` and the `user_role` enum.
- *Multiple tags per document:* the join table `document_tags` with a composite primary key, so a pair can't repeat. Tag names are unique case-insensitively.
- *A new version replaces the old one but the history is kept:* `document_versions` is append-only, and `documents.current_version_id` points at the current row. Reading the current version is one lookup, and the pointer can never leave a document with zero or two "current" versions.
- *Restricted documents:* `documents.visibility` plus `document_permissions` (document, department).

**Indexes (every searched column is indexed)**

| Table | Index | Used for |
|---|---|---|
| `documents` | GIN on generated `search_vector` (title weight A, description weight B) | full-text search |
| `documents` | GIN trigram on `title` | substring and typo-tolerant matching |
| `documents` | B-tree on `uploader_id`; partial B-tree on `created_at DESC WHERE deleted_at IS NULL` | uploader lookups, newest-first lists |
| `document_versions` | unique `(document_id, version_number)`; index on `checksum_sha256` | version integrity, duplicate detection |
| `tags` | unique `lower(name)`; GIN trigram on `name` | case-insensitive uniqueness, tag matching and autocomplete |
| `document_tags` | primary key `(document_id, tag_id)`; index on `tag_id` | tags of a document, documents of a tag |
| `document_permissions` | primary key `(document_id, department_id)`; index on `department_id` | permission checks in search |
| `users` | unique `lower(email)`; index on `department_id`; GIN trigram on `name` and `email` | login, uploader search |
| `audit_logs` | indexes on `document_id`, `user_id`, `created_at DESC` | reserved for the audit trail |

Other details: UUIDs for users, documents and versions (ids in URLs cannot be guessed or counted); `ON DELETE CASCADE` on tags, permissions and versions, `SET NULL` on audit logs so an audit trail outlives what it describes; `CHECK` constraints on titles, sizes and version numbers; the schema is applied through versioned SQL migrations in `backend/migrations`. The `audit_logs` table and the `deleted_at` soft-delete column are created and respected by queries, but the audit trail and trash features are not wired to the API yet (see [next steps](#13-limitations-and-what-i-would-do-next)).

---

## 7. API reference

All routes except `/health`, `/api/auth/register`, `/api/auth/login` and `/api/departments` need `Authorization: Bearer <token>`. Manual requests for every endpoint and error case are in [`backend/requests.http`](backend/requests.http) (VS Code REST Client extension).

| Method | Route | Description |
|---|---|---|
| GET | `/health` | API, database and Redis status |
| POST | `/api/auth/register` | Create an account (always role `employee`) |
| POST | `/api/auth/login` | Returns `{ user, token }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/departments` | List departments |
| GET | `/api/tags?q=` | Tag suggestions (prefix match) |
| POST | `/api/documents` | Upload (`multipart/form-data`: `file`, `title`, `description`, `tags`, `visibility`, `departmentIds`) |
| GET | `/api/documents` | Search and list (parameters below) |
| GET | `/api/documents/:id` | Metadata, tags, current version, permitted departments |
| GET | `/api/documents/:id/versions` | Version history, newest first |
| POST | `/api/documents/:id/versions` | Upload a new version (`file`, optional `changeNote`) |
| POST | `/api/documents/:id/versions/:n/restore` | Make an older version current (creates a new version) |
| GET | `/api/documents/:id/download?version=` | Stream the file as an attachment |
| GET | `/api/documents/:id/view?version=` | Stream inline (PDF, PNG, JPEG, text) |

**Search parameters** for `GET /api/documents`

| Parameter | Meaning |
|---|---|
| `q` | Free text (title, description, tags; typo tolerant) |
| `tags`, `tagMode` | Comma-separated tags; `all` (default) or `any` |
| `uploader` | Uploader name or email |
| `fileType` | `pdf`, `docx`, `xlsx`, `pptx`, `txt`, `png`, `jpg` |
| `from`, `to` | Created date range |
| `sort` | `relevance`, `newest`, `oldest`, `title`, `downloads` |
| `page`, `limit` | Pagination (limit 1 to 50, default 10) |

### Error format

Every failure returns `{ "error": { "code", "message", "details?" } }`, where `details` lists field-level messages for validation errors.

| Status | Meaning |
|---|---|
| 400 | Invalid input (field errors, bad id, missing file, unknown department) |
| 401 | Missing, invalid or expired token; wrong credentials |
| 403 | No access to the document, or not allowed to modify it |
| 404 | Unknown document or version, or missing stored file |
| 409 | Email already registered; file identical to the current version; version already current |
| 413 | File larger than the limit |
| 415 | File type not allowed, content does not match the extension, or type cannot be previewed |
| 429 | Too many requests or login attempts |
| 500 | Unexpected error (details are logged, never returned) |

---

## 8. Security

- Passwords hashed with bcrypt; generic login errors with timing protection; login rate limit of 10 failed attempts per 15 minutes per IP, and 300 API requests per 15 minutes per IP.
- JWT with a pinned algorithm; the user is reloaded on every request.
- Authorization enforced on the server (policy function and SQL), never only in the UI.
- Uploads: extension allowlist, magic-byte check, size limit, generated storage keys, no HTML or SVG, authentication before any bytes are written.
- SQL injection: parameterized queries everywhere, escaped LIKE patterns, whitelisted sorting.
- XSS: highlights and all user content are rendered as React text; downloads use safe `Content-Disposition` and `X-Content-Type-Options: nosniff` (Helmet).
- HTTP hardening with Helmet and a CORS allowlist; request bodies and environment variables validated with Zod.
- Containers run as a non-root user; secrets come from environment variables, and the demo defaults are for local use only.

---

## 9. Testing

**Backend** (Vitest): `cd backend && npm test`. Unit tests cover the permission policy, file signatures, the search query builder (including permission clause and injection safety), the Redis cache (hit, miss, invalidation, Redis failure), the event bus, authentication, version and restore logic with fake repositories and storage, and the download header helper.

**Frontend:** `npx tsc --noEmit`, `npm run lint` and `npm run build` all pass.

**Manual and API tests:** `backend/requests.http` contains every endpoint and the error cases (401, 403, 404, 409, 413, 415, 429) with the expected status in each title. It includes permission checks across departments and cache hit/miss checks.

---

## 10. Project structure

```text
.
├── docker-compose.yml          # postgres, redis, backend, frontend
├── .env.example                # optional overrides for Compose
├── backend/
│   ├── Dockerfile, docker-entrypoint.sh
│   ├── migrations/             # versioned SQL schema
│   ├── samples/                # sample files for tests and demo data
│   ├── requests.http           # manual API requests
│   ├── src/
│   │   ├── app.ts, server.ts, container.ts
│   │   ├── config/             # env validation, database, redis
│   │   ├── db/                 # seed scripts
│   │   ├── errors/, events/, middleware/, storage/, utils/, types/
│   │   └── modules/            # auth, departments, documents, tags
│   └── tests/
└── frontend/
    ├── Dockerfile
    └── src/
        ├── app/                # login, register, search, upload, documents/[id]
        ├── components/         # UI primitives, navbar, tag input, version table, preview
        ├── hooks/
        └── lib/                # API client, auth, theme, utilities
```

---

## 11. Configuration

**Backend** (`backend/.env`, see `backend/.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `DATABASE_URL` | `postgresql://docrepo:...@localhost:5432/docrepo` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `JWT_SECRET` | none (min. 16 characters) | Token signing key |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `UPLOAD_DIR` | `uploads` | Where files are stored |
| `MAX_FILE_SIZE_MB` | `25` | Upload size limit |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin |

**Frontend** (`frontend/.env.local`): `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`; baked in at build time).

**Docker Compose** (optional root `.env`, see `.env.example`): `POSTGRES_PASSWORD`, `JWT_SECRET`, `SEED_DEMO_DATA` (default `true`).

---

## 12. Assumptions

- Self-registration always creates an `employee`; promoting someone to manager or admin would be an admin action.
- A user's department is chosen at registration. In a real company it would come from HR or single sign-on.
- A restricted document always remains visible to the uploader's department.
- Allowed file types are PDF, Office (docx, xlsx, pptx), plain text and PNG/JPEG, with a 25 MB limit.
- "Uploader" search matches the uploader's name or email.
- The JWT lives in `localStorage` for this proof of concept (see next steps).
- Files are stored on a local Docker volume, as the brief allows.
- The demo credentials and the one-click login buttons exist for reviewers and would be removed in a real deployment.

---

## 13. Limitations and what I would do next

**Known limitations**

- The token in `localStorage` can be read by any script on the page.
- A ZIP header cannot tell a real `.docx` from a renamed archive; there is no virus scanning.
- One storage node; one API process rate-limits per IP in memory.
- The frontend has no automated component or end-to-end tests yet.
- The `audit_logs` table and the soft-delete column are prepared but not exposed.

**With more time**

1. Authentication in an `httpOnly` cookie set by a Next.js route handler, which also allows server-rendered pages; refresh tokens and password reset.
2. S3 or MinIO storage behind the existing interface, virus scanning (ClamAV) and a retention policy for old versions.
3. Audit log fed by the event bus, trash and restore for deleted documents, edit-metadata endpoints, and an admin screen for users and roles.
4. Expiring share links, drag-and-drop upload with progress, and range requests for large PDFs.
5. CI (lint, tests, build, image builds), component tests and Playwright end-to-end tests, an accessibility audit and contrast checks.
6. Keyset pagination and request coalescing against cache stampedes; extracting file text for content search; Elasticsearch or OpenSearch only if relevance needs outgrow PostgreSQL.
7. For production: TLS at a reverse proxy, Express `trust proxy`, unpublished database ports, secrets from a secret manager, metrics and tracing.
