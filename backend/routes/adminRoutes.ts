import express, { RequestHandler } from 'express';
import { getAllUsers, getCuratedItems, addCuratedItem, removeCuratedItem } from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/users', requireAuth as RequestHandler, requireAdmin as RequestHandler, getAllUsers as RequestHandler);
router.get('/curated-items', requireAuth as RequestHandler, requireAdmin as RequestHandler, getCuratedItems as RequestHandler);
router.post('/curated-items', requireAuth as RequestHandler, requireAdmin as RequestHandler, addCuratedItem as RequestHandler);
router.delete('/curated-items/:id', requireAuth as RequestHandler, requireAdmin as RequestHandler, removeCuratedItem as RequestHandler);

export default router;
