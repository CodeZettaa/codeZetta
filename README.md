# CodeZetta

Learning platform for software engineering courses. Phase 1 covers the public site, accounts, and the course catalog.

## Local setup

Postgres via Docker:

```bash
docker compose up -d
cp .env.example .env
```

If Docker is not available, a local Prisma Postgres server works instead:

```bash
npx prisma dev -d --name codezetta --port 51213 --db-port 51214
```

Point `DATABASE_URL` at that server and add `pgbouncer=true`. The checked-in `.env.example` uses the Docker URL.

Set `AUTH_SECRET` and `SEED_ADMIN_PASSWORD` in `.env`, then:

```bash
npm install
npm run db:setup
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

`npm run db:setup` creates the schema and seeds the admin account plus the catalog. Re-running the seed resets the seeded courses.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run db:migrate` — create a migration
- `npm run db:seed` — seed admin and courses
