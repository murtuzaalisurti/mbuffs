import { Request, Response, NextFunction } from 'express';
import { sql } from '../lib/db.js';

type PermissionLevel = 'view' | 'edit';

// Helper function to check permissions
const checkPermission = async (userId: string, collectionId: string, requiredLevel: PermissionLevel): Promise<boolean> => {
    try {
        // First, check if the user is the owner
        const ownerCheck = await sql`
            SELECT 1 FROM collections WHERE id = ${collectionId} AND owner_id = ${userId}
        `;
        if (ownerCheck.length > 0) {
            return true; // Owner has all permissions
        }

        // If not the owner, check collaborator permissions
        const collaboratorCheck = await sql`
            SELECT permission FROM collection_collaborators
            WHERE collection_id = ${collectionId} AND user_id = ${userId}
        `;

        if (collaboratorCheck.length === 0) {
            return false; // Not a collaborator
        }

        const actualPermission = collaboratorCheck[0].permission as PermissionLevel;

        // Check if the actual permission meets the required level
        if (requiredLevel === 'view') {
            return true; // Both 'view' and 'edit' collaborators can view
        }
        if (requiredLevel === 'edit') {
            return actualPermission === 'edit'; // Only 'edit' collaborators can edit
        }

        return false; // Should not happen

    } catch (error) {
        console.error('Permission check error:', error);
        return false; // Deny access on error
    }
};

// Middleware factory to require specific permission level
export const requireCollectionPermission = (requiredLevel: PermissionLevel) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id; // User ID from Lucia's deserializeUser middleware
        const collectionId = req.params.collectionId; // Assuming collection ID is in route params

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: Authentication required' });
        }

        if (!collectionId) {
            return res.status(400).json({ message: 'Bad Request: Collection ID missing in request parameters' });
        }

        const hasPermission = await checkPermission(userId, collectionId, requiredLevel);

        if (!hasPermission) {
            return res.status(403).json({ message: `Forbidden: You do not have '${requiredLevel}' permission for this collection` });
        }

        // User has the required permission, proceed
        next();
    };
};
