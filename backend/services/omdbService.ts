import { sql } from '../lib/db.js';
import { generateId } from '../lib/utils.js';
import { getImdbIdFromTmdb, getReleaseDateFromTmdb } from './imdbScraperService.js';

const OMDB_API_KEYS = [process.env.OMDB_API_KEY, process.env.OMDB_API_KEY_2].filter(Boolean) as string[];

export interface OmdbRatingsData {
    tmdbId: string;
    mediaType: 'movie' | 'tv';
    imdbId: string | null;
    title: string | null;
    year: string | null;
    imdbRating: number | null;
    imdbVotes: string | null;
    rottenTomatoesRating: number | null;
    metacriticRating: number | null;
    scrapedAt?: string | null;
}

interface OmdbApiResponse {
    Response: 'True' | 'False';
    Error?: string;
    Title?: string;
    Year?: string;
    imdbID?: string;
    imdbRating?: string;
    imdbVotes?: string;
    Metascore?: string;
    Ratings?: Array<{ Source: string; Value: string }>;
}

const OMDB_CACHE_SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const OMDB_CACHE_FAILURE_TTL_MS = 15 * 60 * 1000;
const OMDB_CACHE_MAX_ENTRIES = 500;

interface OmdbCacheEntry {
    data: OmdbRatingsData | null;
    expiresAt: number;
}

const omdbCache = new Map<string, OmdbCacheEntry>();
const omdbInFlight = new Map<string, Promise<OmdbRatingsData | null>>();

const RESCRAPE_THRESHOLD_NEW_CONTENT_DAYS = 7;
const NEW_CONTENT_AGE_THRESHOLD_DAYS = 180;

function needsRescrape(scrapedAt: string | null | undefined, releaseDate: Date | null): boolean {
    if (!scrapedAt) return true;

    const now = new Date();

    let isNewContent = true;
    if (releaseDate) {
        const daysSinceRelease = (now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24);
        isNewContent = daysSinceRelease < NEW_CONTENT_AGE_THRESHOLD_DAYS;
    }

    if (!isNewContent) return false;

    const lastScraped = new Date(scrapedAt);
    const daysSinceLastScrape = (now.getTime() - lastScraped.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastScrape >= RESCRAPE_THRESHOLD_NEW_CONTENT_DAYS;
}

function getCacheKey(tmdbId: string, mediaType: string): string {
    return `${mediaType}:${tmdbId}`;
}

function getCached(tmdbId: string, mediaType: string): OmdbRatingsData | null | undefined {
    const key = getCacheKey(tmdbId, mediaType);
    const entry = omdbCache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
        omdbCache.delete(key);
        return undefined;
    }
    return entry.data ? { ...entry.data } : null;
}

function setCache(tmdbId: string, mediaType: string, data: OmdbRatingsData | null, ttlMs: number): void {
    while (omdbCache.size >= OMDB_CACHE_MAX_ENTRIES) {
        const oldestKey = omdbCache.keys().next().value as string | undefined;
        if (!oldestKey) break;
        omdbCache.delete(oldestKey);
    }
    const key = getCacheKey(tmdbId, mediaType);
    omdbCache.set(key, {
        data: data ? { ...data } : null,
        expiresAt: Date.now() + ttlMs,
    });
}

function parseRottenTomatoesRating(ratings: Array<{ Source: string; Value: string }> | undefined): number | null {
    if (!ratings) return null;
    const rt = ratings.find(r => r.Source === 'Rotten Tomatoes');
    if (!rt) return null;
    const match = rt.Value.match(/^(\d+)%$/);
    return match ? parseInt(match[1], 10) : null;
}

function parseImdbRating(raw: string | undefined): number | null {
    if (!raw || raw === 'N/A') return null;
    const parsed = parseFloat(raw);
    return isNaN(parsed) ? null : parsed;
}

function parseMetacriticRating(raw: string | undefined): number | null {
    if (!raw || raw === 'N/A') return null;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? null : parsed;
}

async function fetchFromOmdbApi(
    params: { imdbId?: string; title?: string; year?: string; type?: 'movie' | 'series' }
): Promise<OmdbApiResponse | null> {
    if (OMDB_API_KEYS.length === 0) {
        console.error('[omdb] No OMDB API keys configured');
        return null;
    }

    const baseUrl = new URL('https://www.omdbapi.com/');
    if (params.imdbId) {
        baseUrl.searchParams.set('i', params.imdbId);
    } else if (params.title) {
        baseUrl.searchParams.set('t', params.title);
        if (params.year) baseUrl.searchParams.set('y', params.year);
        if (params.type) baseUrl.searchParams.set('type', params.type);
    } else {
        return null;
    }

    for (const apiKey of OMDB_API_KEYS) {
        const url = new URL(baseUrl.toString());
        url.searchParams.set('apikey', apiKey);

        try {
            const response = await fetch(url.toString());
            if (!response.ok) {
                console.warn(`[omdb] API request failed (status ${response.status}), trying next key`);
                continue;
            }
            const data = await response.json() as OmdbApiResponse;
            if (data.Response === 'False') {
                if (data.Error?.includes('limit')) {
                    console.warn(`[omdb] API key rate-limited: ${data.Error}, trying next key`);
                    continue;
                }
                console.warn(`[omdb] API returned error: ${data.Error}`);
                return null;
            }
            return data;
        } catch (error) {
            console.warn('[omdb] API request error, trying next key:', error);
            continue;
        }
    }

    console.error('[omdb] All API keys exhausted');
    return null;
}

async function getTitleAndYearFromTmdb(
    tmdbId: string,
    mediaType: 'movie' | 'tv'
): Promise<{ title: string; year: string } | null> {
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const TMDB_BASE_URL = process.env.TMDB_BASE_URL;
    if (!TMDB_API_KEY || !TMDB_BASE_URL) return null;

    try {
        const endpoint = mediaType === 'movie'
            ? `${TMDB_BASE_URL}/movie/${tmdbId}`
            : `${TMDB_BASE_URL}/tv/${tmdbId}`;
        const url = new URL(endpoint);
        url.searchParams.set('api_key', TMDB_API_KEY);

        const response = await fetch(url.toString());
        if (!response.ok) return null;

        const data = await response.json() as {
            title?: string; name?: string;
            release_date?: string; first_air_date?: string;
        };
        const title = mediaType === 'movie' ? data.title : data.name;
        const dateStr = mediaType === 'movie' ? data.release_date : data.first_air_date;
        const year = dateStr ? dateStr.slice(0, 4) : '';

        if (!title) return null;
        return { title, year };
    } catch {
        return null;
    }
}

async function fetchOmdbRatingsUncached(
    tmdbId: string,
    mediaType: 'movie' | 'tv'
): Promise<OmdbRatingsData | null> {
    let imdbId: string | null = null;

    // Try to get IMDB ID from parental guidance table first
    try {
        const pgRow = await sql`
            SELECT imdb_id FROM parental_guidance
            WHERE tmdb_id = ${tmdbId} AND media_type = ${mediaType}
            LIMIT 1
        `;
        if (pgRow.length > 0 && pgRow[0].imdb_id) {
            imdbId = pgRow[0].imdb_id;
        }
    } catch { /* ignore */ }

    // Fall back to TMDB external IDs
    if (!imdbId) {
        imdbId = await getImdbIdFromTmdb(tmdbId, mediaType);
    }

    let omdbData: OmdbApiResponse | null = null;

    // Prefer fetching by IMDB ID for accuracy
    if (imdbId) {
        omdbData = await fetchFromOmdbApi({ imdbId });
    }

    // Fall back to title + year search
    if (!omdbData) {
        const tmdbInfo = await getTitleAndYearFromTmdb(tmdbId, mediaType);
        if (tmdbInfo) {
            omdbData = await fetchFromOmdbApi({
                title: tmdbInfo.title,
                year: tmdbInfo.year,
                type: mediaType === 'tv' ? 'series' : 'movie',
            });
        }
    }

    if (!omdbData) return null;

    const result: OmdbRatingsData = {
        tmdbId,
        mediaType,
        imdbId: omdbData.imdbID || imdbId,
        title: omdbData.Title || null,
        year: omdbData.Year || null,
        imdbRating: parseImdbRating(omdbData.imdbRating),
        imdbVotes: omdbData.imdbVotes && omdbData.imdbVotes !== 'N/A' ? omdbData.imdbVotes : null,
        rottenTomatoesRating: parseRottenTomatoesRating(omdbData.Ratings),
        metacriticRating: parseMetacriticRating(omdbData.Metascore),
    };

    console.log(`[omdb] Fetched ratings for ${mediaType} ${tmdbId}: IMDB=${result.imdbRating}, RT=${result.rottenTomatoesRating}%`);
    return result;
}

export async function getOmdbRatingsFromDb(
    tmdbId: string,
    mediaType: 'movie' | 'tv'
): Promise<OmdbRatingsData | null> {
    try {
        const result = await sql`
            SELECT
                tmdb_id AS "tmdbId",
                media_type AS "mediaType",
                imdb_id AS "imdbId",
                title,
                year,
                imdb_rating AS "imdbRating",
                imdb_votes AS "imdbVotes",
                rotten_tomatoes_rating AS "rottenTomatoesRating",
                metacritic_rating AS "metacriticRating",
                scraped_at AS "scrapedAt"
            FROM omdb_ratings
            WHERE tmdb_id = ${tmdbId} AND media_type = ${mediaType}
        `;
        if (result.length === 0) return null;

        const row = result[0];
        return {
            tmdbId: row.tmdbId,
            mediaType: row.mediaType as 'movie' | 'tv',
            imdbId: row.imdbId,
            title: row.title,
            year: row.year,
            imdbRating: row.imdbRating != null ? parseFloat(row.imdbRating) : null,
            imdbVotes: row.imdbVotes,
            rottenTomatoesRating: row.rottenTomatoesRating != null ? Number(row.rottenTomatoesRating) : null,
            metacriticRating: row.metacriticRating != null ? Number(row.metacriticRating) : null,
            scrapedAt: row.scrapedAt,
        };
    } catch (error) {
        console.error(`[omdb] Error reading DB for ${mediaType} ${tmdbId}:`, error);
        return null;
    }
}

async function saveOmdbRatings(data: OmdbRatingsData): Promise<boolean> {
    try {
        const id = generateId(15);
        await sql`
            INSERT INTO omdb_ratings (
                id, tmdb_id, media_type, imdb_id, title, year,
                imdb_rating, imdb_votes, rotten_tomatoes_rating, metacritic_rating,
                scraped_at, updated_at
            ) VALUES (
                ${id}, ${data.tmdbId}, ${data.mediaType}, ${data.imdbId}, ${data.title}, ${data.year},
                ${data.imdbRating}, ${data.imdbVotes}, ${data.rottenTomatoesRating}, ${data.metacriticRating},
                NOW(), NOW()
            )
            ON CONFLICT (tmdb_id, media_type) DO UPDATE SET
                imdb_id = COALESCE(EXCLUDED.imdb_id, omdb_ratings.imdb_id),
                title = COALESCE(EXCLUDED.title, omdb_ratings.title),
                year = COALESCE(EXCLUDED.year, omdb_ratings.year),
                imdb_rating = COALESCE(EXCLUDED.imdb_rating, omdb_ratings.imdb_rating),
                imdb_votes = COALESCE(EXCLUDED.imdb_votes, omdb_ratings.imdb_votes),
                rotten_tomatoes_rating = COALESCE(EXCLUDED.rotten_tomatoes_rating, omdb_ratings.rotten_tomatoes_rating),
                metacritic_rating = COALESCE(EXCLUDED.metacritic_rating, omdb_ratings.metacritic_rating),
                updated_at = NOW()
        `;
        return true;
    } catch (error) {
        console.error(`[omdb] Error saving ratings for ${data.mediaType} ${data.tmdbId}:`, error);
        return false;
    }
}

export async function fetchAndSaveOmdbRatings(
    tmdbId: string,
    mediaType: 'movie' | 'tv'
): Promise<OmdbRatingsData | null> {
    // Check in-memory cache first
    const cached = getCached(tmdbId, mediaType);
    if (cached !== undefined) return cached;

    // Deduplicate in-flight requests
    const cacheKey = getCacheKey(tmdbId, mediaType);
    const inFlight = omdbInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const promise = (async (): Promise<OmdbRatingsData | null> => {
        // Check DB
        const existing = await getOmdbRatingsFromDb(tmdbId, mediaType);

        // Check if re-fetch is needed based on content age
        const releaseDate = await getReleaseDateFromTmdb(tmdbId, mediaType);
        if (existing && !needsRescrape(existing.scrapedAt, releaseDate)) {
            setCache(tmdbId, mediaType, existing, OMDB_CACHE_SUCCESS_TTL_MS);
            return existing;
        }

        // Fetch from OMDB API
        const fresh = await fetchOmdbRatingsUncached(tmdbId, mediaType);
        if (!fresh) {
            setCache(tmdbId, mediaType, existing, existing ? OMDB_CACHE_SUCCESS_TTL_MS : OMDB_CACHE_FAILURE_TTL_MS);
            return existing;
        }

        await saveOmdbRatings(fresh);
        setCache(tmdbId, mediaType, fresh, OMDB_CACHE_SUCCESS_TTL_MS);
        return fresh;
    })();

    omdbInFlight.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        omdbInFlight.delete(cacheKey);
    }
}

/**
 * Batch-fetch IMDB ratings from the DB for a list of TMDB IDs.
 * Returns a map of "mediaType:tmdbId" -> imdbRating (number).
 * Only returns entries that have a non-null imdb_rating.
 */
export async function getImdbRatingsBatch(
    items: Array<{ tmdbId: string; mediaType: 'movie' | 'tv' }>
): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (items.length === 0) return result;

    const tmdbIds = items.map(i => i.tmdbId);

    try {
        const rows = await sql`
            SELECT tmdb_id, media_type, imdb_rating
            FROM omdb_ratings
            WHERE tmdb_id = ANY(${tmdbIds}::text[])
              AND imdb_rating IS NOT NULL
        `;

        for (const row of rows as Array<{ tmdb_id: string; media_type: string; imdb_rating: string }>) {
            const rating = parseFloat(row.imdb_rating);
            if (!isNaN(rating)) {
                result.set(`${row.media_type}:${row.tmdb_id}`, rating);
            }
        }
    } catch (error) {
        console.error('[omdb] Error batch-fetching IMDB ratings:', error);
    }

    return result;
}
