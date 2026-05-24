import { Request, Response, NextFunction } from 'express';
import {
    getNotificationsForUser,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    savePushSubscription,
    deletePushSubscription,
} from '../services/notificationService.js';
import { savePushSubscriptionSchema, notificationsPaginationSchema } from '../lib/validators.js';
import '../middleware/authMiddleware.js';

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const queryParsed = notificationsPaginationSchema.safeParse(req.query);
        if (!queryParsed.success) {
            return res.status(400).json({ message: 'Invalid query parameters', errors: queryParsed.error.issues });
        }

        const { cursor, limit } = queryParsed.data;
        const result = await getNotificationsForUser(req.userId, { limit, cursor });
        const unreadCount = await getUnreadCount(req.userId);

        res.status(200).json({ ...result, unreadCount });
    } catch (error) {
        next(error);
    }
};

export const getUnreadNotificationCount = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const count = await getUnreadCount(req.userId);
        res.status(200).json({ count });
    } catch (error) {
        next(error);
    }
};

export const markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const { notificationId } = req.params;
        if (!notificationId) {
            return res.status(400).json({ message: 'Notification ID is required' });
        }

        const updated = await markAsRead(notificationId, req.userId);
        if (!updated) {
            return res.status(404).json({ message: 'Notification not found or already read' });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const count = await markAllAsRead(req.userId);
        res.status(200).json({ success: true, count });
    } catch (error) {
        next(error);
    }
};

export const removeNotification = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const { notificationId } = req.params;
        if (!notificationId) {
            return res.status(400).json({ message: 'Notification ID is required' });
        }

        const deleted = await deleteNotification(notificationId, req.userId);
        if (!deleted) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const clearAllUserNotifications = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const count = await clearAllNotifications(req.userId);
        res.status(200).json({ success: true, count });
    } catch (error) {
        next(error);
    }
};

export const saveSubscription = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const validation = savePushSubscriptionSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Validation failed', errors: validation.error.issues });
        }

        const { endpoint, keys } = validation.data;
        await savePushSubscription(req.userId, endpoint, keys.p256dh, keys.auth);

        res.status(201).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const deleteSubscription = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const { endpoint } = req.body as { endpoint?: string };
        if (!endpoint) {
            return res.status(400).json({ message: 'Endpoint is required' });
        }

        await deletePushSubscription(endpoint);
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const getVapidPublicKey = async (_req: Request, res: Response) => {
    const key = process.env.VAPID_PUBLIC_KEY || '';
    res.status(200).json({ key });
};
