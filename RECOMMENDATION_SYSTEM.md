# Recommendation System — Complete Technical Documentation

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Backend: Recommendation Service](#backend-recommendation-service)
  - [Cached Entry Points](#cached-entry-points)
  - [Recommendation Pool Generation](#recommendation-pool-generation)
  - [Candidate Retrieval](#candidate-retrieval)
  - [Scoring Pipeline](#scoring-pipeline)
  - [Multi-Objective Ranking](#multi-objective-ranking)
  - [Diversity Reranking](#diversity-reranking)
  - [Contextual Bandit Policy](#contextual-bandit-policy)
  - [Profile Jitter](#profile-jitter)
  - [Pagination](#pagination)
  - [Cold Start Path](#cold-start-path)
  - [Genre Recommendations](#genre-recommendations)
  - [Theatrical Releases](#theatrical-releases)
  - [Category Recommendations](#category-recommendations)
- [Caching System](#caching-system)
  - [Server-Side (PostgreSQL)](#server-side-postgresql)
  - [Client-Side (React Query)](#client-side-react-query)
- [Cache Invalidation](#cache-invalidation)
  - [Server-Side Invalidation](#server-side-invalidation)
  - [Client-Side Invalidation](#client-side-invalidation)
- [Cache Warming](#cache-warming)
- [Frontend: For You Page](#frontend-for-you-page)
- [Frontend: Category Detail Page](#frontend-category-detail-page)
- [Watched & Not Interested System](#watched--not-interested-system)
- [Reddit Integration](#reddit-integration)
- [Adult Content Filtering](#adult-content-filtering)
- [Performance Optimizations](#performance-optimizations)
- [Key Files Reference](#key-files-reference)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend framework | React 19 + TypeScript |
| Build tool | Vite |
| Data fetching / caching | TanStack React Query v5 |
| Routing | React Router v7 |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL (Neon Serverless) |
| ORM | Drizzle ORM |
| External API | TMDB (The Movie Database) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                  │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐  │
│  │  ForYou.tsx   │    │ CategoryDetail.tsx│    │    MovieCard.tsx   │  │
│  │              │    │                  │    │                   │  │
│  │ useInfinite  │    │ useInfiniteQuery │    │ toggleWatched     │  │
│  │ Query        │    │ (personalized OR │    │ toggleNotInterest │  ���
│  │              │    │  default TMDB)   │    │                   │  │
│  └──────┬───────┘    └────────┬─────────┘    └────────┬──────────┘  │
│         │                     │                        │            │
│  ┌──────▼─────────────────────▼────────────────────────▼──────────┐ │
│  │                  React Query Cache                              │ │
│  │  ['recommendations', 'all', userId, 60]                        │ │
│  │  ['recommendations', 'categories', userId, 'overview', ...]    │ │
│  │  ['recommendations', 'categories', userId, 'genre', ...]       │ │
│  │  ['watchedBatch', ...sortedMediaIds]                           │ │
│  │  ['notInterestedBatch', ...sortedMediaIds]                     │ │
│  └──────────────────────────┬─────────────────────────────────────┘ │
│                             │ HTTP                                   │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────────┐
│                        BACKEND                                      │
│                             │                                       │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │            recommendationController.ts                         │  │
│  │  GET /api/recommendations                                     │  │
│  │  GET /api/recommendations/categories                          │  │
│  │  GET /api/recommendations/genre/:genreId                      │  │
│  │  GET /api/recommendations/theatrical                          │  │
│  │  POST /api/recommendations/warm                               │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                       │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │             recommendationService.ts (~3785 lines)             │  │
│  │                                                                │  │
│  │  getCachedRecommendationResult()                               │  │
│  │    ├─ active fresh → return immediately                        │  │
│  │    ├─ active stale → return stale + background promote/regen   │  │
│  │    └─ active missing → DB claim → generate active → return     │  │
│  │                                                                │  │
│  │  generateRecommendationPool()                                  │  │
│  │    1. Retrieve candidates (TMDB graph + directors + actors)    │  │
│  │    2. Apply Reddit boosts                                      │  │
│  │    3. Multi-objective ranking (CTR, CVR, engagement)           │  │
│  │    4. Diversity reranking (Jaccard, genre caps, quality)       │  │
│  │    5. Contextual bandit (Thompson sampling)                    │  │
│  │    6. Profile jitter (deterministic shuffle)                   │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                       │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │              PostgreSQL (Neon Serverless)                       │  │
│  │                                                                │  │
│  │  recommendation_cache    (server-side cache layer)             │  │
│  │  user_recommendation_collections  (source collections)         │  │
│  │  collections + collection_movies  (watched/not-interested)     │  │
│  │  reddit_recommendations  (pre-scraped Reddit data)             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### `recommendation_cache`

Server-side cache for computed recommendation results.

```
backend/db/schema.ts:223-240
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | UUID |
| `user_id` | text (FK → user) | Owner |
| `cache_key` | text | SHA-256 hash of `{endpoint, params, version}` |
| `slot` | text | `'active'` or `'staging'` |
| `payload_json` | text | Stringified recommendation result |
| `cache_version` | text | Current: `'v9'` |
| `expires_at` | timestamp | TTL expiry (30 minutes from write) |
| `generation_started_at` | timestamp (nullable) | DB-level generation lock timestamp |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Last update time |

**Constraints:** Unique on `(user_id, cache_key, slot)`. Index on `user_id`. FK cascade on delete.

### `user_recommendation_collections`

Junction table linking users to their recommendation source collections.

```
backend/db/schema.ts:199-218
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | UUID |
| `user_id` | text (FK → user) | Owner |
| `collection_id` | text (FK → collections) | Source collection |
| `added_at` | timestamp | When added |

**Constraints:** Unique on `(user_id, collection_id)`. Indexes on both FKs.

### `collections`

Stores all collections, including system ones (`__watched__`, `__not_interested__`).

```
backend/db/schema.ts:121-140
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | Collection ID |
| `name` | varchar(255) | Name (or system name like `__watched__`) |
| `description` | text | Optional |
| `is_public` | boolean | Default false |
| `owner_id` | text (FK → user) | Owner |
| `is_system` | boolean | `true` for watched/not-interested |
| `shareable_id` | text (unique) | Sharing link ID |

### `collection_movies`

Items within a collection.

```
backend/db/schema.ts:172-194
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | Entry ID |
| `collection_id` | text (FK → collections) | Parent collection |
| `movie_id` | varchar | TMDB ID. TV shows: `"12345tv"`, movies: `"12345"` |
| `added_by_user_id` | text (FK → user) | Who added it |
| `added_at` | timestamp | When added |
| `is_movie` | boolean | Media type flag |

**Constraints:** Unique on `(collection_id, movie_id)`.

### `reddit_recommendations`

Pre-scraped Reddit data (populated at build time via `scripts/scrapeReddit.mjs`).

```
backend/db/schema.ts:287-306
```

Indexed on `tmdb_id`, `media_type`, `subreddit`.

---

## API Endpoints

### Recommendation Endpoints

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| GET | `/api/recommendations` | `getRecommendations` | For You personalized feed |
| GET | `/api/recommendations/categories` | `getCategoryRecommendations` | Category overview (genre buckets) |
| GET | `/api/recommendations/genre/:genreId` | `getGenreRecommendations` | Genre-specific paginated recs |
| GET | `/api/recommendations/theatrical` | `getTheatricalRecommendations` | Personalized now-playing |
| GET | `/api/recommendations/collections` | `getRecommendationCollections` | User's source collections |
| POST | `/api/recommendations/collections` | `addRecommendationCollectionHandler` | Add source collection |
| PUT | `/api/recommendations/collections` | `setRecommendationCollectionsHandler` | Replace all source collections |
| DELETE | `/api/recommendations/collections/:id` | `removeRecommendationCollectionHandler` | Remove source collection |
| POST | `/api/recommendations/warm` | `warmRecommendationCacheHandler` | Fire-and-forget cache warming |
| GET | `/api/recommendations/debug/cache` | `getRecommendationCacheDebugHandler` | Cache debug (restricted) |
| POST | `/api/recommendations/debug/cache/invalidate` | `invalidateRecommendationCacheDebugHandler` | Debug-only soft/hard invalidate + optional warm |

**Source:** `backend/controllers/recommendationController.ts`

**Pagination limits:**
- Default limit: 60
- Max limit: 70 (`MAX_PAGED_RECOMMENDATION_LIMIT`)
- Max page: 100 (`MAX_PAGED_RECOMMENDATION_PAGE`)

### Watched / Not Interested Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/collections/watched/:mediaId` | Single watched status |
| POST | `/api/collections/watched/batch` | Batch watched status |
| POST | `/api/collections/watched/:mediaId/toggle` | Toggle watched |
| GET | `/api/collections/watched/items` | All watched items |
| GET | `/api/collections/not-interested/:mediaId` | Single not-interested status |
| POST | `/api/collections/not-interested/batch` | Batch not-interested status |
| POST | `/api/collections/not-interested/:mediaId/toggle` | Toggle not-interested |
| GET | `/api/collections/not-interested/items` | All not-interested items |

**Source:** `backend/controllers/collectionController.ts`

---

## Backend: Recommendation Service

**File:** `backend/services/recommendationService.ts` (~3785 lines)

### Cached Entry Points

All public-facing functions use a caching wrapper. The actual generation functions are never called directly by controllers.

| Export | Cache Endpoint | Params | Behavior |
|--------|---------------|--------|----------|
| `generateRecommendationsCached(userId, limit, page)` | — | — | Calls `generateRecommendations` directly (no per-page cache; the pool is cached) |
| `generateCategoryRecommendationsCached(userId, mediaType, limit)` | — | — | Calls `generateCategoryRecommendations` directly; category rows are derived cheaply from the cached pool per request |
| `generateGenreRecommendationsCached(userId, genreId, mediaType, limit, page)` | `'genre'` | `{genreId, mediaType, limit, page}` | Caches each genre+page combo |
| `generatePersonalizedTheatricalReleasesCached(userId, limit, page)` | `'theatrical'` | `{limit, page}` | Caches each theatrical page |
| `getOrGenerateRecommendationPoolCached(userId)` | `'for_you_pool'` | `{}` | Caches the full ranked pool |

**Source:** Exported cached wrappers at the bottom of `recommendationService.ts`.

All cached functions wrap with `withRecommendationContext(userId, fn)` to propagate the user's `show_adult_items` preference through the call tree via `AsyncLocalStorage`.

### Recommendation Pool Generation

**Function:** `generateRecommendationPool(userId)` — Line 1974

This is the core function. It builds a shared, fully-ranked candidate pool used by both **For You** and **Categories**.

**Strategy:**

```
1. Check recommendations_enabled flag
2. Get source collections (user_recommendation_collections)
3. If no source collections → fall back to watched history (last 12 items)
4. If no watched history either → cold start path
5. Get exclusion set (source collection items + system collection items)
6. Sample up to 20 source items (deterministic sampling)
7. For each sampled item, fetch in parallel:
   - TMDB details (genre profiling)
   - TMDB credits (director + writer + actor profiling)
   - TMDB recommendations
   - TMDB similar
8. Build profiles: genre scores, director scores (top 2 with count ≥ 2), writer scores (top 2 with count ≥ 2), actor scores (top 2 with count ≥ 2)
9. Process TMDB recommendations/similar → candidate map
10. Fetch director works (top 3 per director, filtered by top 3 genres)
11. Fetch writer works (top 3 per writer, filtered by top 3 genres)
12. Fetch actor works (top 3 per actor, filtered by top 3 genres)
13. Inject Reddit primary candidates (min 2 mentions, min score 50, up to 100)
14. Apply Reddit signal boosts to entire pool
15. Apply multi-objective ranking
16. Apply diversity reranking
17. Apply contextual bandit
18. Apply profile jitter
19. Return full ranked pool
```

### Candidate Retrieval

**Channels:**

| Channel | Source | Description |
|---------|--------|-------------|
| `tmdb_graph` | TMDB recommendations + similar API | Primary retrieval from source items |
| `director_discover` | TMDB discover by crew ID | Top directors (count ≥ 2), filtered by genre |
| `writer_discover` | TMDB discover by crew ID | Top writers (count ≥ 2), filtered by genre |
| `actor_discover` | TMDB discover by cast ID | Top actors (count ≥ 2), filtered by genre |
| `discover_supplement` | TMDB discover API | Genre-specific discover (used in genre recs) |
| `trending_explore` | TMDB trending/all/week | Cold start trending fill |
| `cold_start_seed` | Watched history seeds | Fallback when no source collections |
| `reddit_primary` | Reddit recommendations DB | High-mention Reddit items not in TMDB graph |
| `reddit_signal` | Reddit recommendations DB | Boost signal applied to existing candidates |

### Scoring Pipeline

**Initial candidate scoring (during retrieval):**

```typescript
baseScore     = vote_average * 10                    // 0-100
popularityScore = min(popularity / 10, 50)           // 0-50
genreBoost    = genreMatchScore * 5                  // varies
sourceBoost   = sources * 20                         // per additional source
directorBoost = director.count * 5                   // for director channel
writerBoost   = writer.count * 5                     // for writer channel
actorBoost    = actor.count * 3                      // for actor channel
primaryBoost  = 100                                  // for genre-specific primary recs
combinedScore = base + popularity + genre + source + director + writer + actor + primary
```

### Multi-Objective Ranking

**Function:** `applyMultiObjectiveRanking()` — Line 705

Three objectives with dynamic weights based on engagement signals:

**Weight calculation:**
- `longTermWeight`: 0.30 if watchedCount ≥ 30, else 0.24
- `cvrWeight`: 0.40 if watchRate ≥ 0.6, else 0.35
- `ctrWeight`: 1 - longTermWeight - cvrWeight (clamped 0.2–0.5)

**CTR Score (Click-Through Rate proxy):**
```
0.35 * popularityNorm +
0.25 * voteCountNorm +
0.20 * sourceNorm +
0.20 * redditNorm
```

**CVR Score (Conversion Rate proxy):**
```
0.40 * genreAffinityNorm +
0.30 * creativeAffinityNorm +
0.15 * actorAffinityNorm +
0.15 * ratingNorm
```

**Long-Term Engagement Score:**
```
0.45 * freshnessScore +
0.35 * noveltyScore +
0.20 * ratingNorm
```

**Final ranking score:**
```
rankingScore = retrievalNorm * 45 + objectiveScore * 165
```

**Normalization functions:**
- `logNormalize(value, maxRef)`: `log1p(value) / log1p(maxRef)`, clamped [0,1]
- Popularity: maxRef = 600
- Vote count: maxRef = 12000
- Source: `/5`, clamped
- Reddit: `/100`, clamped
- Creative affinity: `(director_boost + writer_boost) / 32`, clamped
- Actor: `/20`, clamped

**Freshness scoring (line 534):**
| Age | Score |
|-----|-------|
| ≤ 1 year | 1.0 |
| ≤ 3 years | 0.85 |
| ≤ 8 years | 0.6 |
| ≤ 15 years | 0.35 |
| > 15 years | 0.2 |
| Unknown | 0.35 |

**Novelty scoring:**
```
novelty = 1 - (sourceNorm * 0.5 + popularityNorm * 0.35 + voteCountNorm * 0.15)
```

### Diversity Reranking

**Function:** `rerankCandidatesWithConstraints()` ��� Line 852

Greedy selection algorithm that picks the best candidate at each step, accounting for:

1. **Similarity penalty:** Jaccard index on genres (0.6 weight) + release year proximity (0.25) + popularity proximity (0.15). Max similarity across already-selected items, multiplied by 28.

2. **Genre repetition cap:** Max 3 of the same primary genre in the first 18 items. Penalty: +18 if exceeded.

3. **Quality floor:** Items with rating < 6 AND vote_count < 120 get +10 penalty.

4. **Freshness boost:** `freshnessScore * 9` added.

5. **Novelty boost:** `noveltyBoost * 0.35` added.

```
rerankScore = candidateScore + noveltyBoost + freshnessBoost - diversityPenalty
```

### Contextual Bandit Policy

**Function:** `applyContextualBanditPolicy()` — Line 951

Thompson sampling with per-arm (retrieval channel) statistics.

**Exploration rate:**
- Base rate from engagement signals: 0.08–0.24 (higher for users with less signal or lower watch rate)
- On page > 2: reduced by 0.04 (clamped 0.05–0.18)
- Exploration slots: `round(limit * explorationRate)`, min 1, max `floor(limit/2)`

**Bandit scoring for explore pool:**
```
banditScore = armMean + uncertainty * 0.35 + armUCB * 0.2 + exploratoryArmBonus + stableJitter
```

Where:
- `armMean`: average ranking score for this retrieval channel
- `uncertainty`: `(1 - voteCountNorm) * 0.45 + (1 - popularityNorm) * 0.35 + (1 - sourceNorm) * 0.2`
- `armUCB`: `sqrt(log(windowSize + 1) / (armCount + 1))` (UCB1 formula)
- `exploratoryArmBonus`: +0.05 for `trending_explore` and `discover_supplement`
- `stableJitter`: deterministic hash-based, max 0.004

**Interleaving:** Promoted candidates are inserted at positions `2, 6, 10, ...` (formula: `2 + index * 4`) in the exploitation window. Each gets a bandit boost of `8 + uncertainty * 10`.

### Profile Jitter

**Function:** `applyProfileJitter()` — Line 670

Deterministic shuffle to prevent stale-feeling rankings while maintaining consistency per user.

As of cache version `v9`, the profile token also includes a time epoch:

```typescript
epoch = floor(Date.now() / (RECOMMENDATION_CACHE_TTL_MINUTES * 60 * 1000))
```

This rotates deterministic jitter every 30-minute cache window, so users see subtle ordering changes on each refresh cycle.

```
jitterBase = (hash(profileToken + candidateKey) - 0.5) * 2    // [-1, 1]
jitter = jitterBase * magnitude * (0.35 + uncertainty * 0.65)  // magnitude default: 4
updatedScore = score + jitter
```

High-uncertainty items get more jitter. The hash ensures the same user sees the same order for a given profile state.

### Presentation Shuffle

**Function:** `applyPresentationShuffle()`

Request-time shuffle used for presentation freshness after the expensive recommendation pool has already been generated and cached.

This is separate from `applyProfileJitter()`:
- `applyProfileJitter()` is part of pool generation and is cached with the pool.
- `applyPresentationShuffle()` runs after reading the cached pool, so the visible order can change without regenerating TMDB/Reddit/ranking work.

The shuffle epoch rotates every minute:

```typescript
RECOMMENDATION_PRESENTATION_SHUFFLE_WINDOW_MS = 60 * 1000
epoch = floor(Date.now() / RECOMMENDATION_PRESENTATION_SHUFFLE_WINDOW_MS)
```

For You uses:

```typescript
applyPresentationShuffle(
  pool.candidates,
  `${userId}:for-you:presentation:${epoch}`,
  45
)
```

Categories use:

```typescript
applyPresentationShuffle(
  pool.candidates,
  `${userId}:categories:presentation:${mediaType}:${epoch}`,
  45
)
```

The presentation shuffle uses a stronger jitter than profile jitter and less damping for confident items:

```typescript
jitterBase = (hash(profileToken + candidateKey) - 0.5) * 2    // [-1, 1]
jitter = jitterBase * magnitude * (0.75 + uncertainty * 0.25) // magnitude: 45
presentationScore = cachedScore + jitter
```

This is intentionally strong enough to rotate items that would otherwise stay pinned at the top due to large score gaps, while still preserving a quality-weighted ordering because the cached recommendation score remains the base.

### Pagination

Two pagination approaches:

1. **`paginateOrderedCandidates()`** (line 640): Simple slice on pre-ordered candidates. Used after the full pipeline has run.

2. **`paginateTopCandidates()`** (line 424): Uses a min-heap (`selectTopKByScore`) to efficiently extract top-K candidates from an unordered set without sorting the entire array.

### Cold Start Path

**Function:** `generateColdStartRecommendations()` — Line 1718

Triggered when user has no source collections and no watched history.

1. Fetch up to 8 recent watched items, sample 6 deterministically
2. For each seed: fetch details + TMDB recommendations + similar
3. Build genre profile from seed details
4. Fetch trending (2-6 pages of `/trending/all/week`)
5. Merge seed-based and trending candidates
6. Run full pipeline: Reddit boost → multi-objective ranking → diversity rerank → bandit → jitter
7. Paginate and return

### Genre Recommendations

**Function:** `generateGenreRecommendations()` — Line 2849

Hybrid approach:

1. **Primary (personalized):** Sample up to 20 source items of matching media type → fetch TMDB recommendations/similar → filter to target genre → score with `primaryBoost = 100`
2. **Supplement (TMDB discover):** Fetch discover results sorted by `vote_average.desc` with `vote_count.gte=100` and `vote_average.gte=6.0` → add as secondary candidates (no primary boost)
3. Run full pipeline on combined candidates
4. Total results estimated as `max(candidateCount, discoverTotalResults)`

### Theatrical Releases

**Function:** `generatePersonalizedTheatricalReleases()` — Line 3145

1. Build genre/director/writer/actor profiles from source movies (sample 10)
2. Fetch TMDB `/movie/now_playing` (3-12 pages depending on how many are needed)
3. Score each theatrical item against user profile: genre affinity + director match + writer match + actor match + rating + popularity
4. Run full pipeline
5. Paginate

### Category Recommendations

**Function:** `generateCategoryRecommendations()` — Line 2637

Not a separate retrieval. Instead:

1. Fetch the same shared pool from `getOrGenerateRecommendationPoolCached()`
2. Apply request-time presentation shuffle to the cached pool, using a 1-minute epoch
3. Filter pool to requested media type
4. Build genre list, sorted by: source collection genre affinity first, then recommendation frequency
5. For each genre: fill a row from the shuffled pool (items that include that genre), deduplicating across rows
6. Each genre row gets up to `limit` items (default 10 for overview, 50 for category page)

Categories intentionally do not cache the already-sliced final category rows. Caching final rows would store only the first `limit` items per genre and discard alternates, making presentation shuffle ineffective. The expensive source data is still cached in `for_you_pool`; category rows are cheap to derive from that cached pool on each request.

Duplicate prevention: category generation uses a shared `usedItemKeys` set across all rows in a single response. Once an item appears in one category row, later category rows skip it, so the same movie/show should not appear in multiple category sections for that response.

---

## Caching System

### Server-Side (PostgreSQL)

**Table:** `recommendation_cache`

**Constants:**
```typescript
RECOMMENDATION_CACHE_VERSION = 'v9'
RECOMMENDATION_CACHE_TTL_MINUTES = 30
RECOMMENDATION_CACHE_EXPIRED_RETENTION_MINUTES = 60 * 24  // 24 hours
RECOMMENDATION_CACHE_STAGING_RETENTION_MINUTES = 60 * 2    // 2 hours
RECOMMENDATION_CACHE_CLEANUP_INTERVAL_MS = 1000 * 60 * 15  // 15 minutes
RECOMMENDATION_CACHE_GENERATION_LOCK_TIMEOUT_MINUTES = 10
RECOMMENDATION_CACHE_WAIT_AFTER_LOCK_MS = 1500
RECOMMENDATION_PRESENTATION_SHUFFLE_WINDOW_MS = 60 * 1000
```

**Cache key generation:**
```typescript
function buildRecommendationCacheKey(endpoint, params) {
    const serialized = JSON.stringify({ endpoint, params, version: 'v9' });
    return createHash('sha256').update(serialized).digest('hex');
}
```

**Dual-slot model:**
- `active` slot = what requests read immediately
- `staging` slot = next candidate payload generated in background
- `generation_started_at` = DB-level lock timestamp for cross-invocation coordination

**Background scheduling (`scheduleBackground`):**
- Uses `waitUntil()` from `@vercel/functions` on Vercel (with safe fallback logging)
- Keeps async cache refresh/cleanup alive after response is sent

**Lookup pattern — `getCachedRecommendationResult()`:**

```
1. Trigger background cleanup if due
2. Read active slot for (userId, cacheKey)
3. If active is fresh:
   → return active payload immediately
4. If active exists but is stale:
   → return stale active payload immediately
   → schedule background refresh:
      a) try promote ready staging
      b) else generate staging (DB lock on staging)
      c) promote staging -> active
5. If active is missing:
   → try claim generation on active slot (DB lock)
   → if claimed: generate synchronously, write active, return
   → if not claimed: wait 1.5s, re-read active, return if found
   → fallback: generate synchronously and write active
```

This guarantees request-path latency stays low during regeneration: stale active data is served while refresh happens in background.

**DB lock mechanism — `tryClaimGeneration()`:**

`INSERT ... ON CONFLICT (user_id, cache_key, slot) DO UPDATE ... WHERE generation_started_at IS NULL OR older than 10 minutes`

- Works across Vercel serverless invocations (unlike in-memory locks)
- Auto-recovers if a worker crashes (lock timeout)

**Race-safe promotion — `tryPromoteStaging()`:**

Promotion now uses upsert semantics (`INSERT ... ON CONFLICT ... DO UPDATE`) into `active`, then deletes promoted `staging` row.

This avoids duplicate-key races under concurrent requests.

**Background cleanup — `cleanupRecommendationCacheInBackground()`:**

Runs at most every 15 minutes. Deletes rows where:
- `cache_version <> 'v9'` (old versions)
- `expires_at < NOW() - 24 hours` (long-expired)
- `slot = 'staging' AND updated_at < NOW() - 2 hours` (stale staging rows)

Cleanup is also scheduled via `scheduleBackground()` so it does not block request handling.

**Debug visibility:** `GET /api/recommendations/debug/cache` now includes `slot` and `generation_started_at` per entry.

### Client-Side (React Query)

**Query key structure:**

```
FOR YOU:
  ['recommendations', 'all', userId, 60]

CATEGORIES OVERVIEW:
  ['recommendations', 'categories', userId, 'overview', mediaType, limit]

GENRE (PAGINATED):
  ['recommendations', 'categories', userId, 'genre', mediaType, genreId, limit]

THEATRICAL (PAGINATED):
  ['recommendations', 'categories', userId, 'theatrical', limit]

USER PREFERENCES:
  ['user', 'preferences', userId]

WATCHED BATCH:
  ['watchedBatch', ...sortedMediaIds]

NOT INTERESTED BATCH:
  ['notInterestedBatch', ...sortedMediaIds]
```

**Stale times:**

| Query | Stale Time |
|-------|-----------|
| For You recommendations | 5 minutes |
| Category overview | 10 minutes |
| Genre list | 1 hour |
| Watched batch | 30 seconds |
| Not interested batch | 30 seconds |
| User preferences | 5 minutes |

**Source:** `src/lib/recommendationQueries.ts`

---

## Cache Invalidation

### Server-Side Invalidation

Four invalidation functions in `recommendationService.ts`:

| Function | Strategy | Description |
|----------|----------|-------------|
| `invalidateRecommendationCache(userId)` | **Hard delete** | Deletes all cache rows (both `active` and `staging`) for the user |
| `expireRecommendationCache(userId)` | **Soft expire + staging purge** | Expires `active` rows (`expires_at = NOW() - 1s`) and deletes `staging` rows |
| `invalidateRecommendationCacheByCollection(collectionId)` | **Hard delete** | Deletes all rows for users who use this collection as a recommendation source |
| `expireRecommendationCacheByCollection(collectionId)` | **Soft expire + staging purge** | Expires `active` rows and deletes `staging` rows for affected users |

**Trigger map:**

| Event | Location | Invalidation Strategy |
|-------|----------|----------------------|
| Toggle watched | `collectionController.ts:667-668, 677-678` | `expireRecommendationCache` + `warmPersonalizedRecommendationCache` |
| Toggle not interested | `collectionController.ts:832-833, 841-842` | `expireRecommendationCache` + `warmPersonalizedRecommendationCache` |
| Add recommendation collection | `recommendationService.ts` | `expireRecommendationCache` + `warmPersonalizedRecommendationCache` |
| Remove recommendation collection | `recommendationService.ts` | `expireRecommendationCache` + `warmPersonalizedRecommendationCache` |
| Set recommendation collections (replace all) | `recommendationService.ts` | `expireRecommendationCache` + `warmPersonalizedRecommendationCache` |
| Add movie to collection | `collectionController.ts` | `expireRecommendationCacheByCollection` |
| Remove movie from collection | `collectionController.ts` | `expireRecommendationCacheByCollection` |
| Delete collection | `collectionController.ts` | Pre-fetch affected recommendation users, then `expireRecommendationCache` for those users |
| Update preferences: `show_adult_items` | `userController.ts` | `invalidateRecommendationCache` + optional warm (strict correctness) |
| Update preferences: recommendations flags | `userController.ts` | `expireRecommendationCache` + optional warm |

**Design choice:**
- Watched/not-interested toggles use **soft expire** so requests keep serving stale `active` cache while regeneration runs in background.
- Source collection content changes (add/remove items, delete source collection) use **soft expire** to avoid user-visible latency.
- Source selection changes (adding/removing/replacing recommendation source collections) also use **soft expire** to keep reload/scroll latency low.
- `show_adult_items` preference changes still use **hard delete** to avoid serving stale responses with the wrong adult-content policy.
- This keeps infinite scroll responsive during regeneration: users get immediate responses from expired `active` cache until refreshed `active` is promoted.

### Client-Side Invalidation

**In `MovieCard.tsx` — on watched toggle success (line 114-121):**
```typescript
queryClient.invalidateQueries({ queryKey: ['watched'], refetchType: 'none' });
queryClient.invalidateQueries({ queryKey: ['watchedBatch'], refetchType: 'none' });
queryClient.invalidateQueries({ queryKey: ['collections', 'watched', 'items'] });
warmRecommendations();  // fire-and-forget POST /api/recommendations/warm
```

**On not-interested toggle success (line 164-168):**
```typescript
queryClient.invalidateQueries({ queryKey: ['notInterested'], refetchType: 'none' });
queryClient.invalidateQueries({ queryKey: ['notInterestedBatch'], refetchType: 'none' });
queryClient.invalidateQueries({ queryKey: ['collections', 'not-interested', 'items'] });
warmRecommendations();
```

**`refetchType: 'none'`** — marks queries as stale without triggering immediate refetch. The data is already updated optimistically via `setQueryData`.

**Optimistic updates in MovieCard (line 83-135):**
- `onMutate`: saves previous data, immediately writes new watched/not-interested state via `setQueryData` + `setWatchedStatusBatchQueryData()` / `setNotInterestedStatusBatchQueryData()`
- `onError`: rolls back to previous data
- `onSettled`: invalidates queries (marks stale for next access)

---

## Cache Warming

### Server-Side Warming

**Function:** `warmPersonalizedRecommendationCache(userId)`

```typescript
function warmPersonalizedRecommendationCache(userId: string): void {
    scheduleBackground(
        Promise.allSettled([
            getOrGenerateRecommendationPoolCached(userId),
            generatePersonalizedTheatricalReleasesCached(userId, 60, 1),
            generatePersonalizedTheatricalReleasesCached(userId, 60, 2),
        ])
    );
}
```

Generates in parallel:
1. Full recommendation pool (shared by For You + Categories)
2. Theatrical releases page 1
3. Theatrical releases page 2

Category overview responses are not warmed as final cached payloads. They are derived from the warmed `for_you_pool` on request so presentation shuffle can rotate visible rows without recomputing the expensive pool.

Fire-and-forget with Vercel-aware lifetime extension via `waitUntil()`. Duplicate generation is prevented by DB-level generation locks.

### Client-Side Prefetch

**Hook:** `useRecommendationPrefetch()` — `src/hooks/useRecommendationPrefetch.ts`

Runs once on app init when user is authenticated:

```
Phase 1: POST /api/recommendations/warm (fire-and-forget)
Phase 2: Check preferences (recommendations_enabled?)
Phase 3: If enabled, prefetch first page of For You
Phase 4: If category recommendations are enabled, prefetch:
         - categories overview (movie + tv, limit 50)
         - theatrical personalized page 1
```

- Uses `hasPrefetchedRef` guard to prevent re-runs
- Resets on logout so it re-triggers on next login
- Returns `warmRecommendations()` function for use by MovieCard after feedback changes

---

## Frontend: For You Page

**File:** `src/pages/ForYou.tsx` (285 lines)

### Data Flow

```
1. useAuth() → get user
2. useQuery(preferences) → check recommendations_enabled
3. If disabled → show enable CTA with link to /profile
4. If enabled → useInfiniteQuery(getSharedForYouInfiniteQueryOptions)
   - Query key: ['recommendations', 'all', userId, 60]
   - Initial page: 1, items per page: 60
   - getNextPageParam: page < total_pages ? page + 1 : undefined
5. Deduplicate: dedupeForYouRecommendations(allPages.flatMap(p => p.results))
6. Get media IDs: movie.id or "movie.idtv" for TV shows
7. useWatchedStatus(mediaIds) → watchedMap
8. useNotInterestedStatus(mediaIds) → notInterestedMap
9. Filter: excludeFeedbackRecommendations(movies, watchedMap, notInterestedMap)
10. Render grid: 2-6 columns responsive
```

### Infinite Scroll

**Implementation:**
- `IntersectionObserver` with `rootMargin: '0px 0px 1200px 0px'` (preload 1200px before viewport)
- Lock mechanism: `fetchLockRef` (boolean) + `fetchPromiseRef` (promise) prevent concurrent fetches
- `safeFetchNextPage()` checks: `hasNextPage && !isFetchingNextPage && !lock && !inFlightPromise`
- Cleanup on unmount: disconnect observer, null out refs

**Loading states:**
- Initial: 24 skeleton cards (`INITIAL_LOADING_SKELETON_COUNT`)
- Infinite scroll: 12 skeleton cards (`INFINITE_SCROLL_SKELETON_COUNT`), rendered inside the same grid

### Empty states:
- No recommendations yet → "Select source collections in your profile settings"
- Recommendations disabled → Enable CTA with sparkles icon

---

## Frontend: Category Detail Page

**File:** `src/pages/CategoryDetail.tsx` (297 lines)

### Two Modes

**Personalized mode** — when `recommendations_enabled && category_recommendations_enabled`:
- Category overview: `GET /api/recommendations/categories?mediaType=movie|tv&limit=50`
- Genre-specific: infinite query via `getSharedPersonalizedGenreInfiniteQueryOptions`
- Theatrical: infinite query via `getSharedPersonalizedTheatricalInfiniteQueryOptions`
- Shows "Personalized" badge with sparkles
- Merges category overview seed results with paged results: `mergePreviewWithPagedRecommendations()`
- Filters out watched/not-interested items

**Default mode** — when personalization is off:
- Movies: `fetchMoviesByGenreApi(genreId, page)` → TMDB discover
- TV: `fetchTvByGenreApi(genreId, page)` → TMDB discover
- Theatrical: `fetchNowPlayingMoviesApi(page)` → TMDB now_playing
- No watched/not-interested filtering
- No personalized badge

### Infinite Scroll

- `IntersectionObserver` with `rootMargin: '200px'` (smaller preload than For You)
- No lock mechanism (simpler implementation)
- 6 skeleton cards during fetch, 18 during initial load

### Route Params

- `mediaType`: `'movie'` | `'tv'`
- `genreId`: numeric genre ID, or `'now-playing'` for theatrical releases

---

## Watched & Not Interested System

### System Collections

Two hidden system collections per user:
- `__watched__` — items the user has seen
- `__not_interested__` — items the user doesn't want recommended

Created on first use (lazy). `is_system = true` flag hides them from normal collection UI.

### Media ID Format

- Movies: `"12345"` (numeric string)
- TV shows: `"12345tv"` (numeric + "tv" suffix)

**Determined by:** `getRecommendationMediaId()` in `recommendationQueries.ts:89-95`

```typescript
const isTV = mediaType === 'tv' || recommendation.media_type === 'tv' || !!recommendation.first_air_date;
return isTV ? `${recommendation.id}tv` : String(recommendation.id);
```

### Batch Fetching

Both watched and not-interested use batch hooks to prevent N+1:

- `useWatchedStatus(mediaIds)` → `POST /api/collections/watched/batch` with sorted mediaIds as query key
- `useNotInterestedStatus(mediaIds)` → `POST /api/collections/not-interested/batch`
- Both use `keepPreviousData` (now `placeholderData: keepPreviousData`) to prevent flashing during infinite scroll expansion

### Filtering

```typescript
// recommendationQueries.ts:97-105
excludeFeedbackRecommendations(recommendations, watchedMap, notInterestedMap)
// Returns items where !watchedMap[mediaId] && !notInterestedMap[mediaId]
```

Filtering happens entirely on the client side — the server returns all candidates regardless of watched/not-interested status. The exclusion set is used during *pool generation* (server side) to avoid recommending items that are already in source collections or system collections, but the final client-side filter catches toggles that happen after cache generation.

---

## Reddit Integration

### Data Source

Pre-scraped at build time (`scripts/scrapeReddit.mjs`) into `reddit_recommendations` table. The recommendation service reads this static data.

### Two integration points:

**1. Reddit Signal Boost (line 315)**

Applied to ALL candidates after retrieval:
```
boost = mentions * 30 + (sentiment === 'positive' ? 20 : 0)
boost = min(boost, 200)
```

Adds `reddit_popular` reason code and `reddit_signal` retrieval channel.

**2. Reddit Primary Candidates (line 2452)**

Items with high Reddit mentions that aren't already in the TMDB-sourced pool:
- Min 2 mentions, min score 50, up to 100 candidates
- Injected directly into the candidate pool with `reddit_primary` channel
- Get their own scoring: `base + popularity + redditBoost`

### Normalization in ranking

Reddit boost is normalized to `/100` (not `/200`) in CTR score. This is intentional — "movies reach max CTR influence at boost=100" (comment at line 732-733).

---

## Adult Content Filtering

**Mechanism:** `AsyncLocalStorage` context per request.

```typescript
// Line 15-34
const recommendationContext = new AsyncLocalStorage<RecommendationContext>();

async function withRecommendationContext(userId, fn) {
    const includeAdult = await resolveShowAdultItems(userId);
    return recommendationContext.run({ includeAdult }, fn);
}
```

- `resolveShowAdultItems(userId)`: reads `show_adult_items` from user table
- `getIncludeAdult()`: reads from `AsyncLocalStorage` store (default: false)
- `fetchTMDB()`: sets `include_adult` param on every TMDB API call AND filters `adult: true` results from responses when `includeAdult === false`

---

## Performance Optimizations

| Optimization | Location | Impact |
|-------------|----------|--------|
| Shared recommendation pool | `getOrGenerateRecommendationPoolCached` | For You + Categories share one pool, avoiding duplicate TMDB calls |
| Stale-while-revalidate | `getCachedRecommendationResult` | Stale `active` payload is returned immediately while refresh runs in background |
| Dual-slot cache + DB lock | `tryClaimGeneration`, `tryPromoteStaging` | Cross-invocation lock safety on Vercel and race-safe slot promotion |
| Deterministic sampling | `deterministicSample()` | Consistent source item selection without randomness-induced cache thrashing |
| Min-heap top-K | `selectTopKByScore()` | O(n log k) pagination without sorting entire array |
| Client prefetch on auth | `useRecommendationPrefetch` | Recommendations ready before user navigates |
| Batch status queries | `useWatchedStatus` / `useNotInterestedStatus` | One request per page, not per item |
| `keepPreviousData` | Watched/not-interested hooks | No flicker on infinite scroll expansion |
| Optimistic updates | `MovieCard.tsx` mutations | Instant UI feedback before server confirms |
| Intersection Observer preload | For You: 1200px, Category: 200px | Next page starts loading before user scrolls to bottom |
| Fetch lock + promise ref | ForYou infinite scroll | Prevents duplicate concurrent page fetches |
| Background cleanup | `cleanupRecommendationCacheInBackground` + `scheduleBackground` | Old-version/expired/stale-staging rows cleaned every 15 min without blocking requests |
| Profile jitter determinism | `hashToUnitInterval(seed)` | Same user sees same order until profile changes |

---

## Key Files Reference

### Frontend

| File | Lines | Description |
|------|-------|-------------|
| `src/pages/ForYou.tsx` | 285 | For You page with infinite scroll |
| `src/pages/CategoryDetail.tsx` | 297 | Category detail (personalized / default modes) |
| `src/pages/RecommendationCacheDebug.tsx` | ~163 | Cache debug UI (admin only) |
| `src/lib/recommendationQueries.ts` | 229 | Query keys, stale times, dedup, filter, merge utilities |
| `src/lib/api.ts` | ~1035 | API client functions |
| `src/hooks/useRecommendationPrefetch.ts` | 90 | Cache warming hook |
| `src/hooks/useWatchedStatus.ts` | 38 | Batch watched status hook |
| `src/hooks/useNotInterestedStatus.ts` | 37 | Batch not-interested status hook |
| `src/components/MovieCard.tsx` | ~200 | Card with toggle mutations + optimistic updates |

### Backend

| File | Lines | Description |
|------|-------|-------------|
| `backend/services/recommendationService.ts` | ~3785 | Core recommendation engine (dual-slot cache, ranking pipeline) |
| `backend/controllers/recommendationController.ts` | 340 | HTTP endpoint handlers |
| `backend/controllers/collectionController.ts` | 849 | Watched/not-interested + collection CRUD |
| `backend/db/schema.ts` | ~403 | Database schema (Drizzle) |
| `backend/lib/waitUntilHelper.ts` | ~15 | Vercel-aware background scheduling helper |
| `backend/db/migrations/0018_add_cache_dual_slot.sql` | ~21 | Adds `slot` + `generation_started_at`, updates cache unique constraint |
| `backend/routes/recommendationRoutes.ts` | ~20 | Route definitions |
| `backend/routes/collectionRoutes.ts` | ~30 | Collection route definitions |
| `backend/services/redditService.ts` | — | Reddit data access layer |
