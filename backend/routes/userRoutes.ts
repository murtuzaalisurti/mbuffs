import express, { RequestHandler } from 'express';
import { getUserPreferences, updateUserPreferences } from '../controllers/userController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/user/preferences - Get user's recommendation preferences
router.get('/preferences', requireAuth as RequestHandler, getUserPreferences as RequestHandler);

// PUT /api/user/preferences - Update user's recommendation preferences
router.put('/preferences', requireAuth as RequestHandler, updateUserPreferences as RequestHandler);

export default router;
