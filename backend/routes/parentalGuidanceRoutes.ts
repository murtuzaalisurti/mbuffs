import express, { RequestHandler } from 'express';
import { 
    getParentalGuidance, 
    getCertification, 
    getCombinedRatings,
    getScrapeStatus 
} from '../controllers/parentalGuidanceController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get certification (TMDB) for a movie/TV show
// GET /api/ratings/:mediaType/:tmdbId/certification?region=US
router.get(
    '/:mediaType/:tmdbId/certification',
    requireAuth as RequestHandler,
    getCertification as RequestHandler
);

// Get parental guidance (IMDB) for a movie/TV show
// GET /api/ratings/:mediaType/:tmdbId/parental-guidance
router.get(
    '/:mediaType/:tmdbId/parental-guidance',
    requireAuth as RequestHandler,
    getParentalGuidance as RequestHandler
);

// Get combined ratings (certification + parental guidance)
// GET /api/ratings/:mediaType/:tmdbId?region=US
router.get(
    '/:mediaType/:tmdbId',
    requireAuth as RequestHandler,
    getCombinedRatings as RequestHandler
);

// Get scrape status (for debugging/monitoring)
// GET /api/ratings/scrape/status
router.get(
    '/scrape/status',
    requireAuth as RequestHandler,
    getScrapeStatus as RequestHandler
);

export default router;
