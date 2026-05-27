import express, { RequestHandler } from 'express';
import { getAllUsers, getCuratedItems, addCuratedItem, removeCuratedItem, getCollageItems, addCollageItem, removeCollageItem } from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/users', requireAuth as RequestHandler, requireAdmin as RequestHandler, getAllUsers as RequestHandler);
router.get('/curated-items', requireAuth as RequestHandler, requireAdmin as RequestHandler, getCuratedItems as RequestHandler);
router.post('/curated-items', requireAuth as RequestHandler, requireAdmin as RequestHandler, addCuratedItem as RequestHandler);
router.delete('/curated-items/:id', requireAuth as RequestHandler, requireAdmin as RequestHandler, removeCuratedItem as RequestHandler);
router.get('/collage-items', requireAuth as RequestHandler, requireAdmin as RequestHandler, getCollageItems as RequestHandler);
router.post('/collage-items', requireAuth as RequestHandler, requireAdmin as RequestHandler, addCollageItem as RequestHandler);
router.delete('/collage-items/:id', requireAuth as RequestHandler, requireAdmin as RequestHandler, removeCollageItem as RequestHandler);

export default router;
