import express, { RequestHandler } from 'express';
import {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    clearAllUserNotifications,
    saveSubscription,
    deleteSubscription,
    getVapidPublicKey,
} from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireTrustedOrigin } from '../middleware/originProtectionMiddleware.js';
import { createRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

const notificationReadLimiter = createRateLimit({
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'notifications-read',
});

const notificationWriteLimiter = createRateLimit({
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'notifications-write',
});

// Public
router.get('/vapid-public-key', getVapidPublicKey as RequestHandler);

// Authenticated read
router.get(
    '/',
    requireAuth as RequestHandler,
    notificationReadLimiter as RequestHandler,
    getNotifications as RequestHandler
);

router.get(
    '/unread-count',
    requireAuth as RequestHandler,
    notificationReadLimiter as RequestHandler,
    getUnreadNotificationCount as RequestHandler
);

// Authenticated write
router.patch(
    '/:notificationId/read',
    requireAuth as RequestHandler,
    requireTrustedOrigin as RequestHandler,
    notificationWriteLimiter as RequestHandler,
    markNotificationRead as RequestHandler
);

router.post(
    '/mark-all-read',
    requireAuth as RequestHandler,
    requireTrustedOrigin as RequestHandler,
    notificationWriteLimiter as RequestHandler,
    markAllNotificationsRead as RequestHandler
);

router.delete(
    '/:notificationId',
    requireAuth as RequestHandler,
    requireTrustedOrigin as RequestHandler,
    notificationWriteLimiter as RequestHandler,
    removeNotification as RequestHandler
);

router.post(
    '/clear-all',
    requireAuth as RequestHandler,
    requireTrustedOrigin as RequestHandler,
    notificationWriteLimiter as RequestHandler,
    clearAllUserNotifications as RequestHandler
);

router.post(
    '/push-subscription',
    requireAuth as RequestHandler,
    requireTrustedOrigin as RequestHandler,
    notificationWriteLimiter as RequestHandler,
    saveSubscription as RequestHandler
);

router.delete(
    '/push-subscription',
    requireAuth as RequestHandler,
    requireTrustedOrigin as RequestHandler,
    notificationWriteLimiter as RequestHandler,
    deleteSubscription as RequestHandler
);

export default router;
