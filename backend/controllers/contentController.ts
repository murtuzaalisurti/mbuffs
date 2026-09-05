import { Request, Response, NextFunction } from 'express';
import { sql } from '../lib/db.js';
import '../middleware/authMiddleware.js';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL;

// Resolve whether adult items should be included for this request.
// Authenticated: user's show_adult_items preference (default false). Unauthenticated: false.
const resolveShowAdultItems = async (userId: string | null | undefined): Promise<boolean> => {
    if (!userId) return false;
    try {
        const result = await sql`SELECT show_adult_items FROM "user" WHERE id = ${userId}`;
        if (result.length === 0) return false;
        return result[0].show_adult_items ?? false;
    } catch (error) {
        console.error('Error resolving show_adult_items preference:', error);
        return false;
    }
};

// Strip include_adult from querystring-style endpoints like "/discover/movie?include_adult=true&..."
const stripIncludeAdultFromEndpoint = (endpoint: string): string => {
    const qIndex = endpoint.indexOf('?');
    if (qIndex === -1) return endpoint;
    const base = endpoint.slice(0, qIndex);
    const query = endpoint.slice(qIndex + 1);
    const filtered = query
        .split('&')
        .filter(pair => !/^include_adult=/i.test(pair))
        .join('&');
    return filtered ? `${base}?${filtered}` : base;
};

const fetchDetailsFromMoviesAPI = async (req: Request, res: Response, next: NextFunction) => {
    const { endpoint, params = {} } = req.body as { endpoint: string; params?: Record<string, unknown> };
    if (!TMDB_API_KEY) {
        throw new Error("TMDB API key (VITE_TMDB_API_KEY) is missing.");
    }

    const includeAdult = await resolveShowAdultItems(req.userId);

    const normalizedEndpoint = stripIncludeAdultFromEndpoint(endpoint);
    const url = new URL(`${TMDB_BASE_URL}${normalizedEndpoint}`);
    url.searchParams.append('api_key', TMDB_API_KEY);
    url.searchParams.append('language', 'en-US');
    Object.entries(params).forEach(([key, value]) => {
        if (key === 'include_adult') return; // server is authoritative
        url.searchParams.append(key, String(value));
    });
    url.searchParams.set('include_adult', includeAdult ? 'true' : 'false');

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            let errorData = { status_message: `HTTP error ${response.status}` };
             try {
                const jsonError = await response.json() as Promise<{ status_message: string }>;
                errorData = { ...errorData, ...jsonError };
            } catch (e) { /* Ignore JSON parsing error */ }
            console.error(`TMDB API Error (${response.status}) on ${endpoint}:`, errorData);
            throw new Error(errorData.status_message);
        }
        const responseData = await response.json() as Record<string, unknown>;

        // Defense-in-depth: many TMDB endpoints (trending, popular, recommendations/similar,
        // append_to_response, etc.) ignore include_adult. Post-filter list-shaped responses
        // on the per-item `adult` flag when the user has opted out. We intentionally do NOT
        // filter single-item detail responses — a user visiting an item's URL directly should
        // still load the page; the toggle only controls what gets listed/recommended.
        if (!includeAdult && responseData && typeof responseData === 'object') {
            const dropped = filterAdultFromTmdbResponse(responseData);
            console.log(
                `[adult-filter] proxy endpoint=${endpoint} user=${req.userId ?? 'anon'} includeAdult=false dropped=${JSON.stringify(dropped)}`
            );
        } else {
            console.log(
                `[adult-filter] proxy endpoint=${endpoint} user=${req.userId ?? 'anon'} includeAdult=${includeAdult} (no filtering)`
            );
        }

        return res.json(responseData);
    } catch (error) {
        console.error(`TMDB Network or unexpected error on ${endpoint}:`, error);
        next(error);
    }
}

// Recursively strip items with `adult: true` from known TMDB result shapes.
// Returns a per-field drop count so callers can log what was removed.
const filterAdultFromTmdbResponse = (data: Record<string, unknown>): Record<string, number> => {
    const dropped: Record<string, number> = {};
    const dropAdult = <T,>(arr: T[]): { kept: T[]; removed: number } => {
        const kept = arr.filter(
            (item) => !(item && typeof item === 'object' && (item as { adult?: boolean }).adult === true)
        );
        return { kept, removed: arr.length - kept.length };
    };

    if (Array.isArray((data as { results?: unknown }).results)) {
        const { kept, removed } = dropAdult((data as { results: unknown[] }).results);
        (data as { results: unknown[] }).results = kept;
        if (removed > 0) dropped.results = removed;
    }
    // Known appended sub-responses (append_to_response=recommendations,similar,...)
    for (const key of ['recommendations', 'similar'] as const) {
        const sub = (data as Record<string, unknown>)[key];
        if (sub && typeof sub === 'object') {
            const subDropped = filterAdultFromTmdbResponse(sub as Record<string, unknown>);
            for (const [k, v] of Object.entries(subDropped)) {
                dropped[`${key}.${k}`] = v;
            }
        }
    }
    // person/combined_credits has cast[] and crew[] with `adult` on each entry
    for (const key of ['cast', 'crew'] as const) {
        const sub = (data as Record<string, unknown>)[key];
        if (Array.isArray(sub)) {
            const { kept, removed } = dropAdult(sub);
            (data as Record<string, unknown>)[key] = kept;
            if (removed > 0) dropped[key] = removed;
        }
    }
    return dropped;
};

// ============================================================================
// MBUFF PICKS (public): admin-curated items + community favorites (mbuff score > 8)
// ============================================================================

const MBUFF_PICKS_LIMIT = 6;
const MBUFF_PICKS_MIN_SCORE = 8;

interface MbuffPicksPoolItem {
    tmdb_id: string;
    media_type: 'movie' | 'tv';
    title: string | null;
    poster_path: string | null;
    score: number | null;
    source: 'curated' | 'top_rated';
}

interface CuratedPickRow {
    tmdb_id: string;
    media_type: string;
    title: string;
    poster_path: string | null;
}

interface ScoredPickRow {
    media_type: string;
    tmdb_id: number;
    score: string | number;
    ratings_count: number;
}

// The picks pool is identical for every visitor; recompute at most every 5 minutes.
const MBUFF_PICKS_POOL_TTL_MS = 5 * 60 * 1000;
let mbuffPicksPoolCache: { items: MbuffPicksPoolItem[]; expiresAt: number } | null = null;

// TMDB detail lookups for pool items missing a poster (titles/posters rarely change).
const MBUFF_PICKS_TMDB_TTL_MS = 60 * 60 * 1000;
const mbuffPicksTmdbCache = new Map<string, { title: string | null; poster_path: string | null; expiresAt: number }>();

const fetchMbuffPickTmdbDetails = async (
    mediaType: 'movie' | 'tv',
    tmdbId: string
): Promise<{ title: string | null; poster_path: string | null } | null> => {
    const cacheKey = `${mediaType}:${tmdbId}`;
    const cached = mbuffPicksTmdbCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return { title: cached.title, poster_path: cached.poster_path };
    }

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const TMDB_BASE_URL = process.env.TMDB_BASE_URL;
    if (!TMDB_API_KEY || !TMDB_BASE_URL) return null;

    try {
        const url = new URL(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}`);
        url.searchParams.append('api_key', TMDB_API_KEY);
        url.searchParams.append('language', 'en-US');

        const response = await fetch(url.toString());
        if (!response.ok) return null;

        const data = await response.json() as Record<string, unknown>;
        const details = {
            title: (data.title as string | undefined) ?? (data.name as string | undefined) ?? null,
            poster_path: (data.poster_path as string | null) ?? null,
        };
        mbuffPicksTmdbCache.set(cacheKey, { ...details, expiresAt: Date.now() + MBUFF_PICKS_TMDB_TTL_MS });
        return details;
    } catch (error) {
        console.error(`[mbuff-picks] Error fetching TMDB details for ${mediaType}/${tmdbId}:`, error);
        return null;
    }
};

const getMbuffPicksPool = async (): Promise<MbuffPicksPoolItem[]> => {
    if (mbuffPicksPoolCache && mbuffPicksPoolCache.expiresAt > Date.now()) {
        return mbuffPicksPoolCache.items;
    }

    // Movie mbuff score = average of its (single) ratings group.
    // TV show mbuff score = average of the per-season group scores + the overall
    // group score, matching the review summary aggregation.
    const scoredRows = (await sql`
        WITH group_scores AS (
            SELECT
                media_type,
                tmdb_id,
                COALESCE(season_number, -1) AS rating_group,
                ROUND(AVG(rating)::numeric, 1) AS group_score,
                COUNT(*)::int AS group_ratings_count
            FROM media_ratings
            GROUP BY media_type, tmdb_id, COALESCE(season_number, -1)
        )
        SELECT
            media_type,
            tmdb_id,
            ROUND(AVG(group_score)::numeric, 1) AS score,
            SUM(group_ratings_count)::int AS ratings_count
        FROM group_scores
        GROUP BY media_type, tmdb_id
        HAVING ROUND(AVG(group_score)::numeric, 1) > ${MBUFF_PICKS_MIN_SCORE}
        ORDER BY score DESC, ratings_count DESC
        LIMIT 25
    `) as ScoredPickRow[];

    const curatedRows = (await sql`
        SELECT tmdb_id, media_type, title, poster_path
        FROM admin_curated_items
        ORDER BY added_at DESC
    `) as CuratedPickRow[];

    const scoreByItem = new Map<string, number>();
    for (const row of scoredRows) {
        scoreByItem.set(`${row.media_type}:${row.tmdb_id}`, Number(row.score));
    }

    const pool: MbuffPicksPoolItem[] = [
        ...curatedRows.map((row) => ({
            tmdb_id: String(row.tmdb_id),
            media_type: row.media_type as 'movie' | 'tv',
            title: row.title,
            poster_path: row.poster_path,
            score: scoreByItem.get(`${row.media_type}:${row.tmdb_id}`) ?? null,
            source: 'curated' as const,
        })),
        ...scoredRows.map((row) => ({
            tmdb_id: String(row.tmdb_id),
            media_type: row.media_type as 'movie' | 'tv',
            title: null,
            poster_path: null,
            score: Number(row.score),
            source: 'top_rated' as const,
        })),
    ];

    mbuffPicksPoolCache = { items: pool, expiresAt: Date.now() + MBUFF_PICKS_POOL_TTL_MS };
    return pool;
};

// Fisher–Yates shuffle (returns a new array).
const shuffle = <T,>(items: T[]): T[] => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export const getMbuffPicks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const excludeTmdbId = req.query.exclude_tmdb_id ? String(req.query.exclude_tmdb_id) : null;
        const excludeMediaType = req.query.exclude_media_type === 'movie' || req.query.exclude_media_type === 'tv'
            ? (req.query.exclude_media_type as 'movie' | 'tv')
            : null;

        const pool = await getMbuffPicksPool();

        // Curated entries win for items present in both lists (they still
        // carry their mbuff score, if any). Falls back to curated-only when
        // there are no items scoring above the threshold.
        const curatedPool = shuffle(pool.filter((item) => item.source === 'curated'));
        const curatedKeys = new Set(curatedPool.map((item) => `${item.media_type}:${item.tmdb_id}`));
        const topRatedPool = shuffle(pool.filter(
            (item) => item.source === 'top_rated' && !curatedKeys.has(`${item.media_type}:${item.tmdb_id}`)
        ));

        const isExcluded = (item: MbuffPicksPoolItem) =>
            Boolean(
                excludeTmdbId &&
                excludeMediaType &&
                item.tmdb_id === excludeTmdbId &&
                item.media_type === excludeMediaType
            );
        const itemKey = (item: MbuffPicksPoolItem) => `${item.media_type}:${item.tmdb_id}`;

        // Fresh selection on every request: shuffle the entire candidate pool
        // so any eligible item can surface, not just the highest-scored ones.
        const candidates = shuffle([...curatedPool, ...topRatedPool]);
        const selected: MbuffPicksPoolItem[] = [];
        for (const item of candidates) {
            if (selected.length >= MBUFF_PICKS_LIMIT) break;
            if (isExcluded(item)) continue;
            selected.push(item);
        }

        // When both sources exist, make sure each is represented in the picks.
        const ensureSourceRepresented = (sourceItems: MbuffPicksPoolItem[]) => {
            if (sourceItems.length === 0) return;
            if (selected.some((item) => item.source === sourceItems[0].source)) return;
            const replacement = sourceItems.find(
                (item) => !isExcluded(item) && !selected.some((s) => itemKey(s) === itemKey(item))
            );
            if (!replacement) return;
            if (selected.length >= MBUFF_PICKS_LIMIT) {
                selected[selected.length - 1] = replacement;
            } else {
                selected.push(replacement);
            }
        };
        ensureSourceRepresented(curatedPool);
        ensureSourceRepresented(topRatedPool);

        // Fill in missing titles/posters from TMDB (top-rated items store neither).
        const enriched = await Promise.all(selected.map(async (item) => {
            if (item.title && item.poster_path) return item;
            const details = await fetchMbuffPickTmdbDetails(item.media_type, item.tmdb_id);
            return {
                ...item,
                title: item.title ?? details?.title ?? null,
                poster_path: item.poster_path ?? details?.poster_path ?? null,
            };
        }));

        const withMetadata = enriched.filter((item) => item.title && item.poster_path);

        res.status(200).json({ items: withMetadata, total: withMetadata.length });
    } catch (error) {
        console.error('Error fetching mbuff picks:', error);
        next(error);
    }
};

export {
    fetchDetailsFromMoviesAPI
};
