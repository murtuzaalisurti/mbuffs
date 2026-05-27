import express, { RequestHandler } from 'express';
import { fetchDetailsFromMoviesAPI } from '../controllers/contentController.js';
import { getCollageItemsPublic } from '../controllers/adminController.js';

const router = express.Router();

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

export default router;
