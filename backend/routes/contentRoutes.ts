import express, { RequestHandler } from 'express';
import { fetchDetailsFromMoviesAPI } from '../controllers/contentController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post(
    '/',
    requireAuth as RequestHandler,
    fetchDetailsFromMoviesAPI as RequestHandler,
);

export default router;
