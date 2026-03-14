# mbuffs Backend

Express 5 + TypeScript API for mbuffs.

## Stack

- Node.js + TypeScript
- Express 5
- Better Auth (Google OAuth)
- Drizzle ORM + Neon Postgres
- Zod validation

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `backend/.env` from `backend/.env.example` and set:

- `DATABASE_URL`
- `FRONTEND_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TMDB_API_KEY`
- `TMDB_BASE_URL`
- `TMDB_IMAGE_BASE_URL`

## Run

Development:

```bash
npm run dev
```

Build (with migrations + Reddit scrape):

```bash
npm run build
```

Build without scrape:

```bash
npm run build:no-scrape
```

## Database Commands

- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:push`
- `npm run db:diff`
- `npm run db:studio`

## API Routes

### Auth

- `ALL /api/auth/*` - Better Auth handlers
- `GET /api/auth/me` - current user + app-specific fields

### User

- `GET /api/user/preferences`
- `PUT /api/user/preferences`

### Collections

- `GET /api/collections`
- `POST /api/collections`
- `GET /api/collections/:collectionId`
- `PUT /api/collections/:collectionId`
- `DELETE /api/collections/:collectionId`
- `POST /api/collections/:collectionId/movies`
- `DELETE /api/collections/:collectionId/movies/:movieId`
- `POST /api/collections/:collectionId/collaborators`
- `PUT /api/collections/:collectionId/collaborators/:userId`
- `DELETE /api/collections/:collectionId/collaborators/:userId`
- `GET/POST watched + not-interested system-collection routes`

### Content

- `POST /api/content` - TMDB proxy endpoint

### Recommendations

- `GET /api/recommendations`
- `GET /api/recommendations/categories`
- `GET /api/recommendations/theatrical`
- `GET /api/recommendations/genre/:genreId`
- `GET/POST/PUT/DELETE /api/recommendations/collections`
- `GET /api/recommendations/debug/cache`

### Ratings / Parental Guidance

- Routes mounted under `/api/ratings`

### Reddit

- Routes mounted under `/api/reddit`

## Project Layout

```txt
backend/
|-- api/index.ts
|-- controllers/
|-- routes/
|-- services/
|-- middleware/
|-- lib/
|-- db/
`-- scripts/
```
