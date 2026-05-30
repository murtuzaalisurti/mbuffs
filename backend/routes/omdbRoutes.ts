import { Router } from 'express';
import { getOmdbRatings, getOmdbRatingsBatch } from '../controllers/omdbController.js';

const router = Router();

router.get('/:mediaType/:tmdbId', getOmdbRatings);
router.post('/batch', getOmdbRatingsBatch);

export default router;
