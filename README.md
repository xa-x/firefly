# Firefly

A lightweight, headless backend-as-a-service powered by Hono.js and SQLite.

## Features

- 🚀 **Fast** - Built on Bun with Hono.js
- 💾 **SQLite** - Embedded database, zero configuration
- 🔐 **Auth** - Better Auth (email/password, OAuth ready)
- 📊 **Dynamic Tables** - Create tables via API (Phase 3)
- 🔄 **Migrations** - Schema versioning (Phase 4)
- 💾 **Backup** - Export/import (Phase 5)
- 🖥️ **CLI** - Admin tools (Phase 6)

## Quick Start

```bash
# Clone and install
git clone <repo>
cd firefly
bun install

# Start development server
bun run dev

# Server runs at http://localhost:3000
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | API info |
| `GET /health` | Health check |
| `POST /api/auth/sign-up/email` | Register user |
| `POST /api/auth/sign-in/email` | Login user |
| `POST /api/auth/sign-out` | Logout user |
| `GET /api/auth/session` | Get session |

📖 **[Full API Documentation](./docs/API.md)**

## Example Usage

```bash
# Sign up
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"User"}'

# Sign in (saves cookie)
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  -c cookies.txt

# Get session
curl http://localhost:3000/api/auth/session -b cookies.txt
```

## Configuration

Create `.env` file:

```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=./data/firefly.db
BETTER_AUTH_SECRET=your-32-char-secret-key
BETTER_AUTH_URL=http://localhost:3000
```

## Commands

```bash
bun run dev        # Development server with watch
bun run start      # Production server
bun run build      # Compile to binary
bun run typecheck  # TypeScript check
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| API | Hono.js |
| Database | SQLite (bun:sqlite) |
| Auth | Better Auth |
| Validation | Zod |

## Project Structure

```
firefly/
├── auth.ts           # Better Auth config
├── src/
│   ├── index.ts      # Entry point
│   ├── app.ts        # Hono app
│   ├── config/       # Configuration
│   ├── db/           # Database layer
│   ├── api/          # API routes
│   └── utils/        # Utilities
├── docs/             # Documentation
├── data/             # SQLite database
└── backups/          # Backups
```

## Roadmap

- [x] Phase 1: Foundation ✅
- [x] Phase 2: Authentication ✅
- [ ] Phase 3: Database Management
- [ ] Phase 4: Migrations
- [ ] Phase 5: Backup & Restore
- [ ] Phase 6: CLI
- [ ] Phase 7: OpenAPI Docs
- [ ] Phase 8: Testing

## License

MIT
