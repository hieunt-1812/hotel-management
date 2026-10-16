# Hotel Management API

Backend API for a Hotel Management System built with NestJS, TypeORM (PostgreSQL) and Redis.

## Tech stack

- NestJS 12, TypeScript
- PostgreSQL 15 + TypeORM (manual migrations)
- Redis (JWT blacklist on logout)
- JWT authentication (Passport)
- i18n (`nestjs-i18n`, `vi` / `en`)
- Swagger docs at `/docs`

## Getting started

```bash
# 1. Start PostgreSQL (port 5433) and Redis (port 6380)
docker compose up -d

# 2. Environment variables
cp .env.example .env            # then set JWT_SECRET
cp .env.test.example .env.test

# 3. Create the test database (first time only)
docker exec hotel_postgres psql -U postgres -c "CREATE DATABASE hotel_db_test;"

# 4. Install dependencies and apply migrations
npm install
npm run build
npm run migration:run

# 5. Seed sample data (admin, user, room types, amenities, rooms)
npm run seed

# 6. Run the app
npm run start:dev
```

- API: http://localhost:3000/api
- Swagger: http://localhost:3000/docs

## Database migrations

| Command | Description |
| --- | --- |
| `npm run migration:create -- src/database/migrations/<Name>` | Create an empty migration |
| `npm run migration:generate -- src/database/migrations/<Name>` | Generate a migration from entity changes |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Revert the latest migration |
| `npm run migration:show` | List migrations and their status |
| `npm run migration:reset` | Drop the schema and re-run all migrations |

The migration CLI reads the compiled output, so run `npm run build` before any migration command.

## Seed data

`npm run seed` runs a console script (Nest application context, no HTTP server) that inserts sample data. It is safe to run repeatedly — existing rows are skipped.

| Account | Email | Password |
| --- | --- | --- |
| Admin | `admin@hotel.local` (or `SEED_ADMIN_EMAIL`) | `Admin@123` (or `SEED_ADMIN_PASSWORD`) |
| User | `user@hotel.local` | `User@123` |

Also seeds 3 room types, 6 amenities and 5 rooms.

## Tests

```bash
npm run test        # unit tests
npm run test:e2e    # e2e tests (uses .env.test, runs migrations on hotel_db_test)
```
