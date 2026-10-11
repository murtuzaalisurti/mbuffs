import { Request, Response, NextFunction } from 'express';
import { sql } from '../lib/db.js';
import { userStatsQuerySchema } from '../lib/validators.js';
import { computeUserStats, WatchedEntry } from '../lib/userStats.js';
import { getMediaMetadata, mediaRefKey, parseStoredMediaId } from '../services/mediaMetadataService.js';
// Import to ensure Express Request extension is applied
import '../middleware/authMiddleware.js';

const WATCHED_COLLECTION_NAME = '__watched__';

/**
 * GET /api/user/stats?year=2026&tz=Asia/Kolkata
 * Viewing stats built from the user's watched list and ratings.
 * Omit `year` for all-time stats.
 */
export const getUserStats = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const parsed = userStatsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed', errors: parsed.error.issues });
    }
    const year = parsed.data.year ?? null;
    const timeZone = parsed.data.tz ?? 'UTC';

    try {
        const watchedRows = await sql`
            SELECT cm.movie_id, cm.added_at
            FROM collection_movies cm
            JOIN collections c ON cm.collection_id = c.id
            WHERE c.owner_id = ${req.userId}
              AND c.is_system = true
              AND c.name = ${WATCHED_COLLECTION_NAME}
        ` as { movie_id: string; added_at: string }[];

        const entries: WatchedEntry[] = [];
        for (const row of watchedRows) {
            const ref = parseStoredMediaId(String(row.movie_id));
            if (ref && row.added_at) entries.push({ ...ref, watchedAt: new Date(row.added_at).toISOString() });
        }

        // Show-level rating wins; a show rated only per season uses the season average
        const ratingRows = await sql`
            SELECT media_type, tmdb_id,
                   COALESCE(
                       MAX(rating) FILTER (WHERE season_number IS NULL),
                       ROUND(AVG(rating) FILTER (WHERE season_number IS NOT NULL), 1)
                   )::float AS rating
            FROM media_ratings
            WHERE user_id = ${req.userId}
            GROUP BY media_type, tmdb_id
        ` as { media_type: 'movie' | 'tv'; tmdb_id: number; rating: number }[];

        const ratings = new Map<string, number>();
        for (const row of ratingRows) {
            ratings.set(mediaRefKey({ mediaType: row.media_type, tmdbId: Number(row.tmdb_id) }), Number(row.rating));
        }

        const { metadata, pending } = await getMediaMetadata(entries);

        res.status(200).json(computeUserStats({
            entries,
            metadata,
            ratings,
            year,
            timeZone,
            metadataPending: pending,
        }));
    } catch (error) {
        next(error);
    }
};
