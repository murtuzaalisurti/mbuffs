import { Request, Response, NextFunction } from 'express';
import { sql } from '../lib/db.js';
import { shareMediaSchema } from '../lib/validators.js';
import { createNotification } from '../services/notificationService.js';
import '../middleware/authMiddleware.js';

export const shareMedia = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const validation = shareMediaSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Validation failed', errors: validation.error.issues });
        }

        const { recipient_id, tmdb_id, media_type, title, poster_path, message } = validation.data;

        if (recipient_id === req.userId) {
            return res.status(400).json({ message: 'Cannot share with yourself' });
        }

        const recipientCheck = await sql`SELECT id FROM "user" WHERE id = ${recipient_id}`;
        if (recipientCheck.length === 0) {
            return res.status(404).json({ message: 'Recipient not found' });
        }

        const recentDuplicate = await sql`
            SELECT id FROM notifications
            WHERE recipient_id = ${recipient_id}
              AND sender_id = ${req.userId}
              AND type = 'media_share'
              AND payload::jsonb->>'tmdb_id' = ${String(tmdb_id)}
              AND payload::jsonb->>'media_type' = ${media_type}
              AND created_at > NOW() - INTERVAL '5 minutes'
            LIMIT 1
        `;

        if (recentDuplicate.length > 0) {
            return res.status(409).json({ message: 'You already shared this item recently' });
        }

        await createNotification({
            recipientId: recipient_id,
            senderId: req.userId,
            type: 'media_share',
            payload: { tmdb_id, media_type, title, poster_path, message: message || undefined },
        });

        res.status(201).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const getSuggestedUsers = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const users = await sql`
            SELECT DISTINCT u.id,
                   COALESCE(u.username, u.name) as name,
                   u.email,
                   COALESCE(u.image, u.avatar_url) as avatar_url
            FROM "user" u
            WHERE u.id != ${req.userId}
            AND (
                u.id IN (
                    SELECT cc.user_id FROM collection_collaborators cc
                    JOIN collections c ON cc.collection_id = c.id
                    WHERE c.owner_id = ${req.userId}
                )
                OR
                u.id IN (
                    SELECT c.owner_id FROM collections c
                    JOIN collection_collaborators cc ON cc.collection_id = c.id
                    WHERE cc.user_id = ${req.userId}
                )
                OR
                u.id IN (
                    SELECT cc2.user_id FROM collection_collaborators cc2
                    WHERE cc2.collection_id IN (
                        SELECT cc.collection_id FROM collection_collaborators cc
                        WHERE cc.user_id = ${req.userId}
                    )
                    AND cc2.user_id != ${req.userId}
                )
            )
            LIMIT 20
        `;

        res.status(200).json({ users });
    } catch (error) {
        next(error);
    }
};

export const searchUsers = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const q = String(req.query.q || '').trim();
        if (!q || q.length < 1) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const pattern = `%${q}%`;
        const users = await sql`
            SELECT u.id,
                   COALESCE(u.username, u.name) as name,
                   u.email,
                   COALESCE(u.image, u.avatar_url) as avatar_url
            FROM "user" u
            WHERE u.id != ${req.userId}
              AND (
                  u.name ILIKE ${pattern}
                  OR u.username ILIKE ${pattern}
                  OR u.email ILIKE ${pattern}
              )
            ORDER BY u.name ASC
            LIMIT 10
        `;

        res.status(200).json({ users });
    } catch (error) {
        next(error);
    }
};
