import express, { RequestHandler } from 'express';
import { getUserPreferences, updateUserPreferences, uploadAvatar, getAvatar, removeAvatar, deleteOwnAccount } from '../controllers/userController.js';
import { getUserStats, getUserTasteProfile, updateUserTasteProfile } from '../controllers/statsController.js';
import { createRateLimit } from '../middleware/rateLimitMiddleware.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Taste profile reads can call the AI provider; keep them modest
const tasteProfileLimiter = createRateLimit({
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'taste-profile',
});

// GET /api/user/preferences - Get user's recommendation preferences
router.get('/preferences', requireAuth as RequestHandler, getUserPreferences as RequestHandler);

// PUT /api/user/preferences - Update user's recommendation preferences
router.put('/preferences', requireAuth as RequestHandler, updateUserPreferences as RequestHandler);

// POST /api/user/avatar - Upload avatar (base64 in JSON body)
router.post('/avatar', requireAuth as RequestHandler, uploadAvatar as RequestHandler);

// DELETE /api/user/avatar - Remove avatar
router.delete('/avatar', requireAuth as RequestHandler, removeAvatar as RequestHandler);

// GET /api/user/stats - Viewing stats (all time, or ?year=YYYY), bucketed in ?tz=
router.get('/stats', requireAuth as RequestHandler, getUserStats as RequestHandler);

// GET /api/user/stats/taste - AI taste profile from the user's comments and ratings
router.get('/stats/taste', requireAuth as RequestHandler, tasteProfileLimiter as RequestHandler, getUserTasteProfile as RequestHandler);

// PUT /api/user/stats/taste - Turn the taste profile on or off ({ enabled })
router.put('/stats/taste', requireAuth as RequestHandler, updateUserTasteProfile as RequestHandler);

// DELETE /api/user/account - Permanently delete the signed-in user's account and data
router.delete('/account', requireAuth as RequestHandler, deleteOwnAccount as RequestHandler);

// GET /api/user/avatar/:userId - Serve avatar image (public)
router.get('/avatar/:userId', getAvatar as RequestHandler);

export default router;
