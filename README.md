# mbuffs

mbuffs is a full-stack movie discovery and collection hub built for film buffs. The project pairs a Vite + React front end with an Express/Lucia backend so you can explore TMDB content, build collaborative watchlists, and keep track of what you want to watch next.

The application is split into a modern SPA powered by React Query and shadcn/ui components, and an API layer that proxies TMDB requests, handles OAuth sign-in, and persists collections in Neon Postgres.

## Features
- Browse curated popular movies and TV selections with infinite scroll, skeleton loading states, and metadata pulled from TMDB.
- Search the TMDB catalog for both movies and television, with cached queries and helpful feedback for empty/error states.
- Create personal collections, add titles directly from integrated search, and view rich detail pages.
- Invite collaborators, manage permissions, and build shared lists together.
- Secure authentication with Lucia + Google OAuth, JWT-backed session tokens, and protected routes in the SPA.
- Responsive design built with Tailwind CSS, shadcn/ui, and React Router for seamless navigation.

## Tech Stack
- **Frontend:** Vite, React 18 + TypeScript, React Router, @tanstack/react-query, Tailwind CSS, shadcn/ui, lucide-react icons.
- **Backend:** Express 5, Lucia authentication, Neon serverless Postgres, Zod validation, JSON Web Tokens, Arctic OAuth helpers.
- **Integrations:** TMDB API proxied through the backend to keep keys server-side, Sonner + custom toast system for UX feedback.

## Architecture & Data Flow
- The front end stores the JWT issued after OAuth in `localStorage` and loads the active user through the `useAuth` hook (`src/hooks/useAuth.ts`).
- All collection management and TMDB requests flow through the backend (`backend/api/index.ts`), which exposes `/api/auth`, `/api/collections`, and `/api/content`.
- Collection data, collaborators, and shareable IDs live in Neon Postgres via the SQL helpers in `backend/lib/db.ts`.
- React Query caches responses and drives optimistic updates for collection creation, collaborator management, and infinite scroll experiences.

## Project Structure
```
.
|-- src/                # Vite/React application
|   |-- pages/          # Route-level screens (Index, Search, Collections, CollectionDetail, MovieDetail, NotFound)
|   |-- components/     # UI primitives and composed components (Navbar, MovieGrid, dialogs, etc.)
|   |-- hooks/          # Reusable hooks including authentication and debounced search
|   `-- lib/            # API client and shared types
|-- backend/            # Express + Lucia API
|   |-- api/            # Server bootstrap and entrypoint
|   |-- controllers/    # Request handlers for collections, auth, content proxy
|   |-- middleware/     # Auth guards, collection permission checks
|   |-- routes/         # Express route definitions
|   `-- lib/            # Database client, validators, and shared types
`-- public/             # Static assets served by Vite
```

## Getting Started

### Prerequisites
- Node.js 20+ (recommended) and npm (or bun if you prefer; a `bun.lockb` is provided).
- TMDB API key.
- Google OAuth credentials configured for the backend redirect flow.
- Neon (or compatible Postgres) database URL.

### Installation
```sh
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### Environment Configuration
1. Copy `.env.example` to `.env` in the project root and supply:
   - `VITE_BACKEND_URL` pointing at your backend (e.g. `http://localhost:5000/api`).
   - `VITE_TMDB_API_KEY` for client-side read-only features (fallback for public endpoints).
2. Copy `backend/.env.example` to `backend/.env` and fill in:
   - `DATABASE_URL` (Neon Postgres connection string).
   - `FRONTEND_URL` (usually `http://localhost:5173` during development).
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
   - `JWT_SECRET`, `TMDB_API_KEY`, and any optional OAuth provider credentials.

### Running Locally
```sh
# Terminal 1 - start the backend API
cd backend
npm run dev

# Terminal 2 - start the Vite development server
npm run dev
```
The frontend defaults to `http://localhost:5173` and expects the API at `VITE_BACKEND_URL`. Update either port as needed.

### Useful Commands
- `npm run build` / `npm run preview` (frontend) - build and preview the SPA.
- `npm run lint` - run ESLint across the frontend codebase.
- `npm run build` (in `backend/`) - compile the Express API for deployment.
- `npm run start` (in `backend/`) - run the compiled backend.

## Backend Endpoints
- `POST /api/auth/google` & `/callback` - Google OAuth handshake handled by Lucia.
- `GET /api/auth/me` - return the authenticated user derived from the JWT.
- `GET/POST /api/collections` - list and create collections for the current user.
- `GET/PUT/DELETE /api/collections/:collectionId` - manage a single collection, including collaborators and metadata.
- `POST /api/collections/:collectionId/movies` - add movies/TV to a collection (with permission checks).
- `POST /api/content` - proxy TMDB requests; accepts an `endpoint` parameter and optional TMDB query params.

## Next Steps
- Extend the media detail view with cast, crew, and watch providers.
- Add collection sharing via the generated `shareable_id`.
- Automate database migrations and seed scripts for onboarding.

---

# mbuffs

https://github.com/user-attachments/assets/100beab4-f980-42ae-855e-b45dd12575a9

