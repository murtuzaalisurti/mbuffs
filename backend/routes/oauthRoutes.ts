import express, { RequestHandler } from 'express'; // Import RequestHandler
import {
    googleLogin,
    googleCallback,
    logout,
    getCurrentUser
} from '../controllers/oauthController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
// Removed asyncHandler import

const router = express.Router();

// Cast handlers to RequestHandler
router.get('/google', googleLogin as RequestHandler);
router.get('/google/callback', googleCallback as RequestHandler);
router.post('/logout', requireAuth as RequestHandler, logout as RequestHandler); 
router.get('/me', requireAuth as RequestHandler, getCurrentUser as RequestHandler);

export default router;
