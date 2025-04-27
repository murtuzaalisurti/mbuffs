import express from 'express';
import {
    googleLogin,
    googleCallback,
    logout,
    getCurrentUser
} from '../controllers/oauthController';
import { requireAuth } from '../middleware/authMiddleware'; // Use the correct middleware

const router = express.Router();

// --- Google OAuth Routes ---
router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);

// --- General Auth Routes ---
router.post('/logout', requireAuth, logout); // Protect logout route
router.get('/me', requireAuth, getCurrentUser); // Protect get user route

// Add routes for other providers (e.g., GitHub) here if needed
// router.get('/github', githubLogin);
// router.get('/github/callback', githubCallback);

export default router;
