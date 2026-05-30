import { Request, Response, NextFunction } from 'express';
import { fetchAndSaveOmdbRatings, getImdbRatingsBatch } from '../services/omdbService.js';

export const getOmdbRatings = async (req: Request, res: Response, next: NextFunction) => {
    const { tmdbId, mediaType } = req.params;

    if (!tmdbId || !mediaType) {
        res.status(400).json({ error: 'Missing tmdbId or mediaType' });
        return;
    }

    if (mediaType !== 'movie' && mediaType !== 'tv') {
        res.status(400).json({ error: 'mediaType must be "movie" or "tv"' });
        return;
    }

    try {
        const data = await fetchAndSaveOmdbRatings(tmdbId, mediaType as 'movie' | 'tv');

        if (!data) {
            res.status(404).json({
                error: 'OMDB ratings not available for this title',
            });
            return;
        }

        res.json({
            tmdbId: data.tmdbId,
            mediaType: data.mediaType,
            imdbId: data.imdbId,
            imdbRating: data.imdbRating,
            imdbVotes: data.imdbVotes,
            rottenTomatoesRating: data.rottenTomatoesRating,
            metacriticRating: data.metacriticRating,
        });
    } catch (error) {
        console.error('[omdb] Error in getOmdbRatings:', error);
        next(error);
    }
};

const BATCH_MAX_ITEMS = 40;

export const getOmdbRatingsBatch = async (req: Request, res: Response, next: NextFunction) => {
    const { items } = req.body as { items?: Array<{ tmdbId: string; mediaType: string }> };

    if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'items array is required' });
        return;
    }

    const validItems = items
        .filter(i => i.tmdbId && (i.mediaType === 'movie' || i.mediaType === 'tv'))
        .slice(0, BATCH_MAX_ITEMS);

    if (validItems.length === 0) {
        res.json({ ratings: {} });
        return;
    }

    try {
        // DB-only lookup — no OMDB API calls to preserve the daily quota.
        // Ratings are populated when users visit detail pages.
        const ratingsMap = await getImdbRatingsBatch(
            validItems.map(i => ({ tmdbId: i.tmdbId, mediaType: i.mediaType as 'movie' | 'tv' }))
        );

        const ratings: Record<string, { imdbRating: number }> = {};
        for (const [key, rating] of ratingsMap) {
            ratings[key] = { imdbRating: rating };
        }

        res.json({ ratings });
    } catch (error) {
        console.error('[omdb] Error in getOmdbRatingsBatch:', error);
        next(error);
    }
};
