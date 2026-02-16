# Miniclaw API Documentation

A lightweight, headless backend-as-a-service.

## Base URL

```
http://localhost:3000
```

## Authentication

Miniclaw uses [Better Auth](https://better-auth.com) for authentication with cookie-based sessions.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/sign-up/email` | Register new user |
| POST | `/api/auth/sign-in/email` | Login user |
| POST | `/api/auth/sign-out` | Logout user |
| GET | `/api/auth/session` | Get current session |

---

## Auth Examples

### Sign Up

```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123",
    "name": "John Doe"
  }'
```

**Response:**
```json
{
  "token": "session-token-here",
  "user": {
    "id": "abc123",
    "name": "John Doe",
    "email": "user@example.com",
    "emailVerified": false,
    "image": null,
    "createdAt": "2026-02-16T18:41:50.544Z",
    "updatedAt": "2026-02-16T18:41:50.544Z"
  }
}
```

### Sign In

```bash
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }' \
  -c cookies.txt
```

**Response:**
```json
{
  "token": "session-token-here",
  "user": {
    "id": "abc123",
    "name": "John Doe",
    "email": "user@example.com",
    "emailVerified": false
  }
}
```

### Get Session

```bash
curl http://localhost:3000/api/auth/session \
  -b cookies.txt
```

**Response:**
```json
{
  "user": {
    "id": "abc123",
    "name": "John Doe",
    "email": "user@example.com",
    "emailVerified": false
  },
  "session": {
    "id": "session-id",
    "userId": "abc123",
    "expiresAt": "2026-02-23T18:41:50.544Z"
  }
}
```

### Sign Out

```bash
curl -X POST http://localhost:3000/api/auth/sign-out \
  -b cookies.txt
```

---

## Other Endpoints

### Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-02-16T18:41:03.737Z"
}
```

### API Info

```bash
curl http://localhost:3000/
```

**Response:**
```json
{
  "name": "Miniclaw",
  "version": "0.1.0",
  "description": "Lightweight backend-as-a-service",
  "endpoints": {
    "health": "/health",
    "auth": "/api/auth/*",
    "session": "/api/session",
    "tables": "/api/tables (Phase 3)",
    "records": "/api/tables/:table/records (Phase 3)"
  }
}
```

---

## Client SDK (JavaScript/TypeScript)

```typescript
import { createAuthClient } from 'better-auth/react';

const authClient = createAuthClient({
  baseURL: 'http://localhost:3000'
});

// Sign up
const { data, error } = await authClient.signUp.email({
  email: 'user@example.com',
  password: 'securepassword123',
  name: 'John Doe'
});

// Sign in
const { data, error } = await authClient.signIn.email({
  email: 'user@example.com',
  password: 'securepassword123'
});

// Sign out
await authClient.signOut();

// Get session
const session = await authClient.getSession();
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment |
| `DATABASE_PATH` | `./data/firefly.db` | SQLite database path |
| `BETTER_AUTH_SECRET` | (dev secret) | Auth secret key (32+ chars) |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Base URL for auth |

---

## Database Tables

### Better Auth Tables (auto-created)

- `user` - User accounts
- `session` - User sessions
- `account` - OAuth accounts
- `verification` - Email verification tokens

### Miniclaw Tables

- `_migrations` - Migration tracking
- `_tables` - Dynamic table metadata

---

## Error Response Format

All errors follow this format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "status": 400
  }
}
```

---

## Roadmap

- [x] Phase 1: Foundation
- [x] Phase 2: Authentication (better-auth)
- [ ] Phase 3: Database Management (dynamic tables)
- [ ] Phase 4: Migrations
- [ ] Phase 5: Backup & Restore
- [ ] Phase 6: CLI
- [ ] Phase 7: Documentation
- [ ] Phase 8: Testing

---

## Quick Start

```bash
# Install
cd firefly
bun install

# Development
bun run dev

# Server starts at http://localhost:3000
```
