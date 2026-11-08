import express, { RequestHandler } from 'express';
import { fetchDetailsFromMoviesAPI, getMbuffPicks } from '../controllers/contentController.js';
import { getCollageItemsPublic } from '../controllers/adminController.js';
import { getWatchProvidersBatch } from '../controllers/watchProvidersController.js';
import { createRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// Each request fans out to up to 40 TMDB calls on a cache miss.
const watchProvidersLimiter = createRateLimit({
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyPrefix: 'watch-providers',
});

// Public route: per-title watch providers for a region, batched (streaming filter).
router.get(
    '/watch-providers',
    watchProvidersLimiter as RequestHandler,
    getWatchProvidersBatch as RequestHandler,
);

// Public route: used by logged-out homepage/search flows to fetch TMDB content.
router.post(
    '/',
    fetchDetailsFromMoviesAPI as RequestHandler,
);

// Public route: homepage collage poster data (no auth required).
router.get(
    '/collage',
    getCollageItemsPublic as RequestHandler,
);

// Public route: "mbuff picks" sidebar items (curated + community top-rated, max 5).
router.get(
    '/mbuff-picks',
    getMbuffPicks as RequestHandler,
);

export default router;
