import { Request, Response, NextFunction } from 'express';
import { sql } from '../lib/db.js';
import {
    generateRecommendationsCached,
    generateCategoryRecommendationsCached,
    generateGenreRecommendationsCached,
    generatePersonalizedTheatricalReleasesCached,
    addRecommendationCollection,
    removeRecommendationCollection,
    setRecommendationCollections,
    expireRecommendationCache,
    invalidateRecommendationCache,
    getRecommendationCacheDebug,
    warmPersonalizedRecommendationCache
} from '../services/recommendationService.js';
import '../middleware/authMiddleware.js';

const DEFAULT_PAGED_RECOMMENDATION_LIMIT = 60;
const MAX_PAGED_RECOMMENDATION_LIMIT = 70;
const MAX_PAGED_RECOMMENDATION_PAGE = 100;

const ensureRecommendationDebugAccess = (req: Request): boolean => {
    return !!(req.user && (req.user as any).role === 'admin');
};

const parsePositiveInt = (value: unknown, fallback: number): number => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseRecommendationLimit = (value: unknown): number =>
    Math.min(parsePositiveInt(value, DEFAULT_PAGED_RECOMMENDATION_LIMIT), MAX_PAGED_RECOMMENDATION_LIMIT);

const parseRecommendationPage = (value: unknown): { page: number; error: string | null } => {
    if (value === undefined || value === null || value === '') {
        return { page: 1, error: null };
    }

    const pageString = String(value).trim();
    if (!/^\d+$/.test(pageString)) {
        return {
            page: 1,
            error: `page must be an integer between 1 and ${MAX_PAGED_RECOMMENDATION_PAGE}`
        };
    }

    const page = Number.parseInt(pageString, 10);
    if (page < 1 || page > MAX_PAGED_RECOMMENDATION_PAGE) {
        return {
            page: 1,
            error: `page must be between 1 and ${MAX_PAGED_RECOMMENDATION_PAGE}`
        };
    }

    return { page, error: null };
};

const parseRecommendationRegion = (value: unknown): { region?: string; error: string | null } => {
    if (value === undefined || value === null || value === '') {
        return { region: undefined, error: null };
    }

    const region = String(value).trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(region)) {
        return { error: 'region must be a 2-letter ISO 3166-1 code' };
    }

    return { region, error: null };
};

/**
 * GET /api/recommendations
 * Get personalized recommendations for the authenticated user
 * Supports pagination with ?limit=60&page=1
 */
export const getRecommendations = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const limit = parseRecommendationLimit(req.query.limit);
        const { page, error: pageError } = parseRecommendationPage(req.query.page);
        if (pageError) {
            return res.status(400).json({ message: pageError });
        }

        const recommendations = await generateRecommendationsCached(req.userId, limit, page);
        
        res.status(200).json(recommendations);
    } catch (error) {
        console.error("Error generating recommendations:", error);
        next(error);
    }
};

/**
 * GET /api/recommendations/categories
 * Get personalized category-based recommendations for the authenticated user
 * Supports ?mediaType=movie|tv&limit=10
 */
export const getCategoryRecommendations = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const mediaType = (req.query.mediaType as 'movie' | 'tv') || 'movie';
        const limit = parseInt(req.query.limit as string) || 10;
        
        if (mediaType !== 'movie' && mediaType !== 'tv') {
            return res.status(400).json({ message: "mediaType must be 'movie' or 'tv'" });
        }

        const recommendations = await generateCategoryRecommendationsCached(req.userId, mediaType, limit);
        
        res.status(200).json(recommendations);
    } catch (error) {
        console.error("Error generating category recommendations:", error);
        next(error);
    }
};

/**
 * GET /api/recommendations/genre/:genreId
 * Get personalized recommendations for a specific genre with pagination
 * Supports ?mediaType=movie|tv&limit=60&page=1
 */
export const getGenreRecommendations = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const genreId = parseInt(req.params.genreId, 10);
        const mediaType = (req.query.mediaType as 'movie' | 'tv') || 'movie';
        const limit = parseRecommendationLimit(req.query.limit);
        const { page, error: pageError } = parseRecommendationPage(req.query.page);

        if (isNaN(genreId)) {
            return res.status(400).json({ message: "Invalid genreId" });
        }

        if (pageError) {
            return res.status(400).json({ message: pageError });
        }

        if (mediaType !== 'movie' && mediaType !== 'tv') {
            return res.status(400).json({ message: "mediaType must be 'movie' or 'tv'" });
        }

        const recommendations = await generateGenreRecommendationsCached(req.userId, genreId, mediaType, limit, page);
        
        res.status(200).json(recommendations);
    } catch (error) {
        console.error("Error generating genre recommendations:", error);
        next(error);
    }
};

/**
 * GET /api/recommendations/theatrical
 * Get personalized theatrical releases (now playing movies)
 * Supports ?limit=60&page=1&region=US
 */
export const getTheatricalRecommendations = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const limit = parseRecommendationLimit(req.query.limit);
        const { page, error: pageError } = parseRecommendationPage(req.query.page);
        const { region, error: regionError } = parseRecommendationRegion(req.query.region);
        if (pageError) {
            return res.status(400).json({ message: pageError });
        }
        if (regionError) {
            return res.status(400).json({ message: regionError });
        }

        const recommendations = await generatePersonalizedTheatricalReleasesCached(req.userId, limit, page, region);
        
        res.status(200).json(recommendations);
    } catch (error) {
        console.error("Error generating theatrical recommendations:", error);
        next(error);
    }
};

/**
 * GET /api/recommendations/collections
 * Get user's recommendation source collections
 */
export const getRecommendationCollections = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const result = await sql`
            SELECT c.id, c.name, c.description, urc.added_at
            FROM user_recommendation_collections urc
            JOIN collections c ON urc.collection_id = c.id
            WHERE urc.user_id = ${req.userId}
            ORDER BY urc.added_at DESC
        `;

        res.status(200).json({ collections: result });
    } catch (error) {
        console.error("Error fetching recommendation collections:", error);
        next(error);
    }
};

/**
 * GET /api/recommendations/debug/cache
 * Debug cache visibility for a single authorized user
 */
export const getRecommendationCacheDebugHandler = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const hasDebugAccess = ensureRecommendationDebugAccess(req);
        if (!hasDebugAccess) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const cache = await getRecommendationCacheDebug(req.userId);
        res.status(200).json({
            cache,
            ttl_minutes: 30,
        });
    } catch (error) {
        console.error("Error fetching recommendation cache debug data:", error);
        next(error);
    }
};

/**
 * POST /api/recommendations/debug/cache/invalidate
 * Debug-only cache maintenance endpoint for authorized user.
 */
export const invalidateRecommendationCacheDebugHandler = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const hasDebugAccess = ensureRecommendationDebugAccess(req);
        if (!hasDebugAccess) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const rawMode = typeof req.body?.mode === 'string' ? req.body.mode.toLowerCase() : 'soft';
        if (rawMode !== 'soft' && rawMode !== 'hard') {
            return res.status(400).json({ message: "mode must be 'soft' or 'hard'" });
        }

        const mode = rawMode as 'soft' | 'hard';
        const warm = typeof req.body?.warm === 'boolean' ? req.body.warm : mode === 'soft';

        if (mode === 'hard') {
            await invalidateRecommendationCache(req.userId);
        } else {
            await expireRecommendationCache(req.userId);
        }

        if (warm) {
            warmPersonalizedRecommendationCache(req.userId);
        }

        const cache = await getRecommendationCacheDebug(req.userId);

        return res.status(200).json({
            message: mode === 'hard'
                ? 'Recommendation cache hard-invalidated'
                : 'Recommendation cache soft-expired',
            mode,
            warm_started: warm,
            cache,
            ttl_minutes: 30,
        });
    } catch (error) {
        console.error("Error invalidating recommendation cache via debug endpoint:", error);
        next(error);
    }
};

/**
 * POST /api/recommendations/collections
 * Add a collection to user's recommendation sources
 */
export const addRecommendationCollectionHandler = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { collection_id } = req.body;

    if (!collection_id) {
        return res.status(400).json({ message: "collection_id is required" });
    }

    try {
        const success = await addRecommendationCollection(req.userId, collection_id);
        
        if (!success) {
            return res.status(400).json({ 
                message: "Invalid collection: You don't have access to this collection" 
            });
        }

        res.status(201).json({ message: "Collection added to recommendation sources" });
    } catch (error) {
        console.error("Error adding recommendation collection:", error);
        next(error);
    }
};

/**
 * DELETE /api/recommendations/collections/:collectionId
 * Remove a collection from user's recommendation sources
 */
export const removeRecommendationCollectionHandler = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { collectionId } = req.params;

    try {
        await removeRecommendationCollection(req.userId, collectionId);
        res.status(200).json({ message: "Collection removed from recommendation sources" });
    } catch (error) {
        console.error("Error removing recommendation collection:", error);
        next(error);
    }
};

/**
 * PUT /api/recommendations/collections
 * Set all recommendation source collections (replaces existing)
 */
export const setRecommendationCollectionsHandler = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { collection_ids } = req.body;

    if (!Array.isArray(collection_ids)) {
        return res.status(400).json({ message: "collection_ids must be an array" });
    }

    try {
        const success = await setRecommendationCollections(req.userId, collection_ids);
        
        if (!success) {
            return res.status(400).json({ 
                message: "Invalid collections: You don't have access to one or more collections" 
            });
        }

        // Fetch and return the updated collections
        const result = await sql`
            SELECT c.id, c.name, c.description, urc.added_at
            FROM user_recommendation_collections urc
            JOIN collections c ON urc.collection_id = c.id
            WHERE urc.user_id = ${req.userId}
            ORDER BY urc.added_at DESC
        `;

        res.status(200).json({ collections: result });
    } catch (error) {
        console.error("Error setting recommendation collections:", error);
        next(error);
    }
};

/**
 * POST /api/recommendations/warm
 * Fire-and-forget cache warming for the authenticated user.
 * Triggers background generation of the main recommendation cache entries
 * so that subsequent fetches return instantly from warm cache.
 */
export const warmRecommendationCacheHandler = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        warmPersonalizedRecommendationCache(req.userId);
        res.status(202).json({ message: "Cache warming started" });
    } catch (error) {
        console.error("Error triggering recommendation cache warm:", error);
        next(error);
    }
};
