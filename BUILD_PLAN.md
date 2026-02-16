# Miniclaw - Build Plan

A lightweight, headless backend-as-a-service powered by Hono.js and SQLite.

## Overview

**Goal:** Create a standalone, self-hosted backend service that combines:
- **SQLite** for relational data storage
- **Hono.js** for the API layer
- **Better Auth** for authentication
- CLI for administration
- No admin UI (headless by design)

**Target Users:** Developers who want a simple, self-hosted alternative to Supabase/Firebase/Convex without the overhead.

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Bun | Fast, native TypeScript, SQLite built-in |
| API Framework | Hono.js | Lightweight, edge-compatible |
| Database | SQLite (bun:sqlite) | Fast, embedded, zero-config |
| Auth | better-auth | Comprehensive auth framework |
| CLI | Commander.js | Admin interactions |
| Migrations | Custom SQL files | Schema management |
| Validation | Zod | Request/response validation |
| Deployment | Bun compile + Docker | Binary and container |

---

## Project Structure

```
firefly/
├── auth.ts               # Better Auth configuration
├── src/
│   ├── index.ts          # Entry point
│   ├── app.ts            # Hono app setup
│   ├── config/           # Configuration
│   ├── db/               # Database layer
│   ├── api/              # API routes
│   │   └── routes/
│   │       ├── health.ts
│   │       ├── tables.ts
│   │       ├── records.ts
│   │       ├── migrations.ts
│   │       └── backup.ts
│   ├── cli/              # CLI commands
│   └── utils/            # Utilities
├── migrations/           # Migration SQL files
├── backups/              # Backup storage
├── data/                 # SQLite database
└── docs/                 # Documentation
```

---

## Phase 1: Foundation & Core Setup ✅

### 1.1 Project Initialization ✅
- [x] Initialize Bun project
- [x] Install dependencies
- [x] Configure TypeScript (strict mode)
- [x] Setup project structure
- [x] Create basic README

### 1.2 Database Layer ✅
- [x] SQLite connection with Bun's built-in driver
- [x] Database initialization script
- [x] Schema definition system

### 1.3 Basic Hono Server ✅
- [x] Server setup with Hono
- [x] Health check endpoint
- [x] Error handling middleware
- [x] CORS configuration

**Status:** ✅ Complete

---

## Phase 2: Authentication System ✅

### 2.1 Better Auth Setup ✅
- [x] Install better-auth package
- [x] Create auth instance with SQLite adapter
- [x] Configure email/password authentication
- [x] Set up environment variables

### 2.2 Auth Integration ✅
- [x] Mount auth handler at `/api/auth/*`
- [x] Create session middleware
- [x] Add user/session to request context

**Status:** ✅ Complete

---

## Phase 3: Database Management ✅

### 3.1 Table Management ✅
- [x] Dynamic table creation API
- [x] Table schema definition format
- [x] Column types (text, integer, real, boolean, json, timestamp)
- [x] Index support

### 3.2 Record Operations ✅
- [x] `POST /api/:table/records` - Create records
- [x] `GET /api/:table/records` - List records (with pagination, filters)
- [x] `GET /api/:table/records/:id` - Get single record
- [x] `PATCH /api/:table/records/:id` - Update record
- [x] `DELETE /api/:table/records/:id` - Delete record

### 3.3 Query Features ✅
- [x] Filter operators (eq, ne, gt, lt, gte, lte, like, in, isnull)
- [x] Sorting (ASC, DESC, multiple columns)
- [x] Pagination (offset/limit)
- [x] Field selection (select param)

**Status:** ✅ Complete

---

## Phase 4: Migration System ✅

### 4.1 Migration Framework ✅
- [x] Migration file format (up/down)
- [x] Migration runner
- [x] Migration state tracking
- [x] Rollback support

### 4.2 CLI Commands ✅
- [x] `firefly migrate create <name>` - Create migration
- [x] `firefly migrate up` - Run pending migrations
- [x] `firefly migrate down` - Rollback last migration
- [x] `firefly migrate status` - Show migration status

### 4.3 API Endpoints ✅
- [x] `GET /api/migrations` - List migrations
- [x] `POST /api/migrations/create` - Create migration
- [x] `POST /api/migrations/up` - Run migrations
- [x] `POST /api/migrations/down` - Rollback

**Status:** ✅ Complete

---

## Phase 5: Backup & Restore ✅

### 5.1 Backup System ✅
- [x] SQLite database export
- [x] Compression support (gzip)
- [x] Timestamped backup files
- [x] Full backup (database + metadata)

### 5.2 Restore System ✅
- [x] Database restore from backup
- [x] Decompression support

### 5.3 CLI Commands ✅
- [x] `firefly backup create` - Create backup
- [x] `firefly backup list` - List backups
- [x] `firefly backup restore <file>` - Restore from backup

### 5.4 API Endpoints ✅
- [x] `GET /api/backup` - List backups
- [x] `POST /api/backup/create` - Create backup
- [x] `POST /api/backup/restore/:filename` - Restore
- [x] `GET /api/backup/download/:filename` - Download
- [x] `DELETE /api/backup/:filename` - Delete

**Status:** ✅ Complete

---

## Phase 6: CLI ✅

### 6.1 Server Commands ✅
- [x] `firefly start` - Start server

### 6.2 Migration Commands ✅
- [x] `firefly migrate create <name>`
- [x] `firefly migrate up`
- [x] `firefly migrate down`
- [x] `firefly migrate status`

### 6.3 Backup Commands ✅
- [x] `firefly backup create`
- [x] `firefly backup list`
- [x] `firefly backup restore <file>`

### 6.4 Table Commands ✅
- [x] `firefly tables list`
- [x] `firefly tables drop <name>`

### 6.5 User Commands ✅
- [x] `firefly users list`
- [x] `firefly users delete <email>`

**Status:** ✅ Complete

---

## Phase 7: Documentation 🔄

### 7.1 Documentation
- [x] API documentation (docs/API.md)
- [ ] OpenAPI/Swagger spec
- [ ] Getting started guide
- [ ] Deployment guide

### 7.2 Examples
- [x] cURL examples
- [ ] JavaScript/TypeScript client example
- [ ] Python client example

**Status:** 🔄 In Progress

---

## Phase 8: Testing ⏳

### 8.1 Testing
- [ ] Unit tests for core modules
- [ ] Integration tests for API
- [ ] CLI command tests

### 8.2 Quality
- [x] TypeScript strict mode
- [x] Error handling
- [x] Logging

**Status:** ⏳ Pending

---

## API Summary

| Category | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| **Auth** | `/api/auth/sign-up/email` | POST | Register user |
| | `/api/auth/sign-in/email` | POST | Login user |
| | `/api/auth/sign-out` | POST | Logout user |
| | `/api/auth/session` | GET | Get session |
| **Tables** | `/api/tables` | GET | List tables |
| | `/api/tables` | POST | Create table |
| | `/api/tables/:name` | GET | Get table |
| | `/api/tables/:name` | DELETE | Drop table |
| **Records** | `/api/:table/records` | GET | List records |
| | `/api/:table/records` | POST | Create record |
| | `/api/:table/records/:id` | GET | Get record |
| | `/api/:table/records/:id` | PATCH | Update record |
| | `/api/:table/records/:id` | DELETE | Delete record |
| **Migrations** | `/api/migrations` | GET | List migrations |
| | `/api/migrations/create` | POST | Create migration |
| | `/api/migrations/up` | POST | Run migrations |
| | `/api/migrations/down` | POST | Rollback |
| **Backup** | `/api/backup` | GET | List backups |
| | `/api/backup/create` | POST | Create backup |
| | `/api/backup/restore/:filename` | POST | Restore |
| | `/api/backup/download/:filename` | GET | Download |
| | `/api/backup/:filename` | DELETE | Delete |

---

## CLI Summary

```bash
# Server
firefly start [--port 3000]

# Migrations
firefly migrate create <name>
firefly migrate up
firefly migrate down
firefly migrate status

# Backup
firefly backup create [--type database|full]
firefly backup list
firefly backup restore <filename>

# Tables
firefly tables list
firefly tables drop <name>

# Users
firefly users list
firefly users delete <email>
```

---

## Future Enhancements

- Vector search (zvec integration)
- OAuth providers (Google, GitHub, etc.)
- GraphQL API
- Real-time subscriptions (WebSocket)
- File storage integration
- API keys for services
- Rate limiting
- Multi-tenancy

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| 1. Foundation | ✅ | 100% |
| 2. Auth | ✅ | 100% |
| 3. Database | ✅ | 100% |
| 4. Migrations | ✅ | 100% |
| 5. Backup | ✅ | 100% |
| 6. CLI | ✅ | 100% |
| 7. Docs | 🔄 | 50% |
| 8. Testing | ⏳ | 0% |

**Overall: 81% Complete** 🚀
