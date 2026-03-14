import express, { RequestHandler } from 'express';
import { fetchDetailsFromMoviesAPI } from '../controllers/contentController.js';

const router = express.Router();

// Public route: used by logged-out homepage/search flows to fetch TMDB content.
router.post(
    '/',
    fetchDetailsFromMoviesAPI as RequestHandler,
);

export default router;
