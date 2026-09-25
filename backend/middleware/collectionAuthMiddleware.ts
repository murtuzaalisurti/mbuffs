import { Request, Response, NextFunction } from 'express';
import { sql } from '../lib/db.js';

type PermissionLevel = 'view' | 'edit';

// System collections (Watched / Not Interested) are managed only through their
// dedicated toggle endpoints. The UI never exposes them to the generic
// collection routes, so those routes must not allow modifying them either.
const SYSTEM_COLLECTION_FORBIDDEN_MESSAGE = 'Forbidden: System collections cannot be modified directly';

// Helper function to check permissions
const checkPermission = async (userId: string | null | undefined, collectionId: string, requiredLevel: PermissionLevel): Promise<{ exists: boolean; hasPermission: boolean; isSystem: boolean }> => {
    try {
        const collectionCheck = await sql`
            SELECT owner_id, is_public, is_system
            FROM collections
            WHERE id = ${collectionId}
            LIMIT 1
        `;

        if (collectionCheck.length === 0) {
            return { exists: false, hasPermission: false, isSystem: false };
        }

        const collection = collectionCheck[0] as { owner_id: string; is_public: boolean | null; is_system: boolean | null };
        const isSystem = Boolean(collection.is_system);

        if (requiredLevel === 'edit' && isSystem) {
            return { exists: true, hasPermission: false, isSystem };
        }

        if (requiredLevel === 'view' && Boolean(collection.is_public)) {
            return { exists: true, hasPermission: true, isSystem };
        }

        if (!userId) {
            return { exists: true, hasPermission: false, isSystem };
        }

        if (collection.owner_id === userId) {
            return { exists: true, hasPermission: true, isSystem }; // Owner has all permissions
        }

        const collaboratorCheck = await sql`
            SELECT permission FROM collection_collaborators
            WHERE collection_id = ${collectionId} AND user_id = ${userId}
        `;

        if (collaboratorCheck.length === 0) {
            return { exists: true, hasPermission: false, isSystem };
        }

        const actualPermission = collaboratorCheck[0].permission as PermissionLevel;

        if (requiredLevel === 'view') {
            return { exists: true, hasPermission: true, isSystem }; // Both 'view' and 'edit' collaborators can view
        }

        if (requiredLevel === 'edit') {
            return { exists: true, hasPermission: actualPermission === 'edit', isSystem };
        }

        return { exists: true, hasPermission: false, isSystem };

    } catch (error) {
        console.error('Permission check error:', error);
        return { exists: true, hasPermission: false, isSystem: false }; // Deny access on error
    }
};

// Ownership check used by collaborator-management endpoints.
// Collaborator management is owner-only (matches the UI), so this is stricter
// than requireCollectionPermission('edit').
export const checkCollectionOwnership = async (
    userId: string | null | undefined,
    collectionId: string,
): Promise<{ exists: boolean; isOwner: boolean; isSystem: boolean }> => {
    try {
        const collectionCheck = await sql`
            SELECT owner_id, is_system
            FROM collections
            WHERE id = ${collectionId}
            LIMIT 1
        `;

        if (collectionCheck.length === 0) {
            return { exists: false, isOwner: false, isSystem: false };
        }

        const { owner_id: ownerId, is_system: isSystem } = collectionCheck[0] as { owner_id: string; is_system: boolean | null };
        return { exists: true, isOwner: Boolean(userId) && ownerId === userId, isSystem: Boolean(isSystem) };
    } catch (error) {
        console.error('Ownership check error:', error);
        return { exists: true, isOwner: false, isSystem: false }; // Deny access on error
    }
};

// Middleware factory to require that the requester owns the collection.
// Owner-only actions (editing collection settings, deleting, managing
// collaborators) never apply to system collections.
export const requireCollectionOwner = (
    forbiddenMessage = 'Forbidden: Only the collection owner can manage collaborators',
) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const collectionId = req.params.collectionId;

        if (!collectionId) {
            return res.status(400).json({ message: 'Bad Request: Collection ID missing in request parameters' });
        }

        if (!req.userId) {
            return res.status(401).json({ message: 'Unauthorized: Authentication required' });
        }

        const { exists, isOwner, isSystem } = await checkCollectionOwnership(req.userId, collectionId);

        if (!exists) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        if (!isOwner) {
            return res.status(403).json({ message: forbiddenMessage });
        }

        if (isSystem) {
            return res.status(403).json({ message: SYSTEM_COLLECTION_FORBIDDEN_MESSAGE });
        }

        next();
    };
};

// Middleware factory that allows the collection owner OR the target user
// themselves. Used for removing a collaborator so members can leave a collection.
export const requireCollectionOwnerOrSelf = () => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const collectionId = req.params.collectionId;
        const targetUserId = req.params.userId;

        if (!collectionId) {
            return res.status(400).json({ message: 'Bad Request: Collection ID missing in request parameters' });
        }

        if (!req.userId) {
            return res.status(401).json({ message: 'Unauthorized: Authentication required' });
        }

        const { exists, isOwner, isSystem } = await checkCollectionOwnership(req.userId, collectionId);

        if (!exists) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        if (isSystem) {
            return res.status(403).json({ message: SYSTEM_COLLECTION_FORBIDDEN_MESSAGE });
        }

        if (isOwner || (targetUserId && req.userId === targetUserId)) {
            return next();
        }

        return res.status(403).json({ message: 'Forbidden: Only the collection owner can manage collaborators' });
    };
};

// Middleware factory to require specific permission level
export const requireCollectionPermission = (requiredLevel: PermissionLevel) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.userId;
        const collectionId = req.params.collectionId;

        if (!collectionId) {
            return res.status(400).json({ message: 'Bad Request: Collection ID missing in request parameters' });
        }

        const permissionResult = await checkPermission(userId, collectionId, requiredLevel);

        if (!permissionResult.exists) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        if (!permissionResult.hasPermission) {
            if (requiredLevel === 'edit' && permissionResult.isSystem) {
                return res.status(403).json({ message: SYSTEM_COLLECTION_FORBIDDEN_MESSAGE });
            }
            if (!userId && requiredLevel === 'view') {
                return res.status(401).json({ message: 'Unauthorized: Authentication required' });
            }
            return res.status(403).json({ message: `Forbidden: You do not have '${requiredLevel}' permission for this collection` });
        }

        // User has the required permission, proceed
        next();
    };
};
