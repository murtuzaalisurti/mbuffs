import express, { RequestHandler } from 'express';
import { shareMedia, getSuggestedUsers, searchUsers } from '../controllers/shareController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireTrustedOrigin } from '../middleware/originProtectionMiddleware.js';
import { createRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

const shareWriteLimiter = createRateLimit({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'share-write',
});

router.post(
    '/',
    requireAuth as RequestHandler,
    requireTrustedOrigin as RequestHandler,
    shareWriteLimiter as RequestHandler,
    shareMedia as RequestHandler
);

router.get(
    '/suggested-users',
    requireAuth as RequestHandler,
    getSuggestedUsers as RequestHandler
);

router.get(
    '/search-users',
    requireAuth as RequestHandler,
    searchUsers as RequestHandler
);

export default router;
