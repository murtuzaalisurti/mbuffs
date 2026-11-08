import { Request, Response, NextFunction } from 'express';

// Batched per-title watch providers for one region. The streaming filter on
// category pages uses this to check rent vs. buy per service, which TMDB's
// discover endpoint can't express (it applies monetization types independently
// of providers).

const MAX_ITEMS = 40;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const ITEM_PATTERN = /^(movie|tv):(\d{1,10})$/;

// Availability changes slowly; JustWatch data on TMDB refreshes about daily.
const PROVIDERS_TTL_MS = 24 * 60 * 60 * 1000;
const PROVIDERS_CACHE_MAX_ENTRIES = 5000;

// Cache misses fan out to TMDB; cap parallel calls per request so bursts stay
// under TMDB's rate limit (it resets connections when flooded).
const TMDB_CONCURRENCY = 8;

type RegionResults = Record<string, unknown>;

// Like Promise.all over `items`, with at most `limit` calls in flight. Keeps order.
const mapWithConcurrency = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await fn(items[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
};

// Stores every region per title, so other regions are served from the same entry.
const providersCache = new Map<string, { results: RegionResults; expiresAt: number }>();

const fetchTitleProviders = async (item: string): Promise<RegionResults | null> => {
    const cached = providersCache.get(item);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.results;
    }

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const TMDB_BASE_URL = process.env.TMDB_BASE_URL;
    if (!TMDB_API_KEY || !TMDB_BASE_URL) return null;

    const [mediaType, id] = item.split(':');
    try {
        const url = new URL(`${TMDB_BASE_URL}/${mediaType}/${id}/watch/providers`);
        url.searchParams.append('api_key', TMDB_API_KEY);
        const response = await fetch(url.toString());
        if (!response.ok) return null;

        const data = await response.json() as { results?: RegionResults };
        const results = data.results ?? {};
        if (providersCache.size >= PROVIDERS_CACHE_MAX_ENTRIES) {
            // Map keeps insertion order, so this evicts the oldest entry.
            const oldest = providersCache.keys().next().value;
            if (oldest !== undefined) providersCache.delete(oldest);
        }
        providersCache.set(item, { results, expiresAt: Date.now() + PROVIDERS_TTL_MS });
        return results;
    } catch (error) {
        console.error(`[watch-providers] Error fetching providers for ${item}:`, error);
        return null;
    }
};

// GET /api/content/watch-providers?region=IN&items=movie:123,tv:456
// Responds with { results: { "movie:123": {...} | null } } for the region.
// A title with no offers in the region maps to {}; a failed lookup maps to null.
export const getWatchProvidersBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const region = String(req.query.region ?? '').toUpperCase();
        if (!COUNTRY_CODE_PATTERN.test(region)) {
            res.status(400).json({ message: 'region must be a two-letter country code' });
            return;
        }

        const items = [...new Set(String(req.query.items ?? '').split(',').filter(Boolean))];
        if (items.length === 0 || items.length > MAX_ITEMS || !items.every((item) => ITEM_PATTERN.test(item))) {
            res.status(400).json({ message: `items must be 1-${MAX_ITEMS} entries like movie:123 or tv:456` });
            return;
        }

        const lookups = await mapWithConcurrency(items, TMDB_CONCURRENCY, fetchTitleProviders);
        const results: Record<string, unknown> = {};
        items.forEach((item, index) => {
            const regions = lookups[index];
            results[item] = regions ? (regions[region] ?? {}) : null;
        });

        // Same for every visitor, so let the CDN share it.
        res.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400');
        res.json({ results });
    } catch (error) {
        next(error);
    }
};
