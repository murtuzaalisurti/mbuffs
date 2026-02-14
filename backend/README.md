# mbuffs Backend

Express.js backend API for the mbuffs movie tracking application.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js 5
- **Database:** PostgreSQL (Neon Serverless)
- **ORM/Schema:** Drizzle ORM
- **Authentication:** Lucia Auth with Google OAuth
- **Validation:** Zod

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Neon account)

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
FRONTEND_URL="http://localhost:8080"
JWT_SECRET="your-jwt-secret"
```

### Running the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

## Database Migrations

This project uses a custom idempotent migration system built on top of Drizzle ORM.

### Migration Commands

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Apply pending migrations (safe to run multiple times) |
| `npm run db:generate` | Generate migration from schema changes (Drizzle Kit) |
| `npm run db:diff` | Show what changes would be applied (dry run) |
| `npm run db:push` | Push schema directly to DB (dev only, not recommended) |
| `npm run db:studio` | Open Drizzle Studio GUI |

### Running Migrations

```bash
npm run db:migrate
```

This will:
1. Create a `_migrations` table (if it doesn't exist) to track applied migrations
2. Check which migrations have already been applied
3. Run any pending `.sql` files from `db/migrations/` in order
4. Skip already applied migrations

### Idempotent Migrations

All migrations are written to be **idempotent** - they can be run multiple times without causing errors. This is achieved using:

- `CREATE TABLE IF NOT EXISTS` - For tables
- `CREATE SEQUENCE IF NOT EXISTS` - For sequences
- `CREATE INDEX IF NOT EXISTS` - For indexes
- `DO $$ BEGIN IF NOT EXISTS ... END $$;` - For constraints

### Creating New Migrations

1. Create a new SQL file in `backend/db/migrations/` with a sequential prefix:
   ```
   0001_add_new_feature.sql
   0002_another_change.sql
   ```

2. Write idempotent SQL. Example:

   ```sql
   -- Add a new column (idempotent)
   DO $$ BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'user' AND column_name = 'new_column'
       ) THEN
           ALTER TABLE "user" ADD COLUMN "new_column" TEXT;
       END IF;
   END $$;

   -- Add a new table (idempotent)
   CREATE TABLE IF NOT EXISTS "new_table" (
       "id" TEXT PRIMARY KEY NOT NULL,
       "name" TEXT NOT NULL
   );

   -- Add a foreign key constraint (idempotent)
   DO $$ BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'new_table_user_id_fkey'
       ) THEN
           ALTER TABLE "new_table" 
           ADD CONSTRAINT "new_table_user_id_fkey" 
           FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
       END IF;
   END $$;

   -- Add an index (idempotent)
   CREATE INDEX IF NOT EXISTS "idx_new_table_name" ON "new_table" ("name");
   ```

3. Run the migration:
   ```bash
   npm run db:migrate
   ```

### Schema Files

- `db/schema.ts` - Drizzle schema definitions (auto-generated via introspection)
- `db/relations.ts` - Drizzle relation definitions
- `db/migrate.ts` - Custom migration runner
- `db/migrations/*.sql` - SQL migration files

### Re-running a Migration (Testing)

If you need to re-run a migration (e.g., to test idempotency):

```sql
-- Connect to your database and run:
DELETE FROM _migrations WHERE name = '0000_ambitious_scorpion.sql';
```

Then run `npm run db:migrate` again. Since migrations are idempotent, this is safe.

## API Routes

### Authentication (`/api/auth`)
- `GET /google` - Initiate Google OAuth
- `GET /google/callback` - OAuth callback
- `GET /me` - Get current user (requires auth)
- `POST /logout` - Logout

### User (`/api/user`)
- `GET /preferences` - Get user preferences (requires auth)
- `PUT /preferences` - Update user preferences (requires auth)

### Collections (`/api/collections`)
- `GET /` - List user's collections (requires auth)
- `POST /` - Create collection (requires auth)
- `GET /:collectionId` - Get collection details (requires auth)
- `PUT /:collectionId` - Update collection (requires auth)
- `DELETE /:collectionId` - Delete collection (requires auth)
- `POST /:collectionId/movies` - Add movie to collection (requires auth)
- `DELETE /:collectionId/movies/:movieId` - Remove movie (requires auth)
- `POST /:collectionId/collaborators` - Add collaborator (requires auth)
- `DELETE /:collectionId/collaborators/:userId` - Remove collaborator (requires auth)

### Content (`/api/content`)
- `POST /` - Proxy requests to TMDB API

## Project Structure

```
backend/
├── api/
│   └── index.ts          # Express app entry point
├── controllers/
│   ├── collectionController.ts
│   ├── oauthController.ts
│   └── userController.ts
├── db/
│   ├── migrations/       # SQL migration files
│   ├── migrate.ts        # Migration runner
│   ├── relations.ts      # Drizzle relations
│   └── schema.ts         # Drizzle schema
├── lib/
│   ├── db.ts             # Database connection
│   ├── jwt.ts            # JWT utilities
│   ├── lucia.ts          # Lucia auth setup
│   ├── oauth.ts          # OAuth configuration
│   ├── types.ts          # TypeScript types
│   └── validators.ts     # Zod schemas
├── middleware/
│   ├── authMiddleware.ts
│   └── collectionAuthMiddleware.ts
├── routes/
│   ├── collectionRoutes.ts
│   ├── contentRoutes.ts
│   ├── oauthRoutes.ts
│   └── userRoutes.ts
├── drizzle.config.ts     # Drizzle Kit configuration
├── package.json
└── tsconfig.json
```
