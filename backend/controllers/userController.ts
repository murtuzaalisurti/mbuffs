import { Request, Response, NextFunction } from 'express';
import { sql } from '../lib/db.js';
import { UserPreferences, UpdateUserPreferencesInput } from '../lib/types.js';
// Import to ensure Express Request extension is applied
import '../middleware/authMiddleware.js';

export const getUserPreferences = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const result = await sql`
            SELECT recommendations_enabled, recommendations_collection_id 
            FROM "user" 
            WHERE id = ${req.userId}
        `;

        if (result.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = result[0];
        const preferences: UserPreferences = {
            recommendations_enabled: user.recommendations_enabled ?? false,
            recommendations_collection_id: user.recommendations_collection_id ?? null,
        };

        res.status(200).json({ preferences });
    } catch (error) {
        console.error("Error fetching user preferences:", error);
        next(error);
    }
};

export const updateUserPreferences = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { recommendations_enabled, recommendations_collection_id } = req.body as UpdateUserPreferencesInput;

    try {
        // If a collection ID is provided, verify the user owns it or has access
        if (recommendations_collection_id !== undefined && recommendations_collection_id !== null) {
            const collectionCheck = await sql`
                SELECT id FROM collections 
                WHERE id = ${recommendations_collection_id} 
                AND (owner_id = ${req.userId} OR id IN (
                    SELECT collection_id FROM collection_collaborators WHERE user_id = ${req.userId}
                ))
            `;

            if (collectionCheck.length === 0) {
                return res.status(400).json({ 
                    message: "Invalid collection: You don't have access to this collection" 
                });
            }
        }

        // Build the update query dynamically
        const updates: string[] = [];
        const values: (boolean | string | null)[] = [];

        if (recommendations_enabled !== undefined) {
            updates.push('recommendations_enabled');
            values.push(recommendations_enabled);
        }

        if (recommendations_collection_id !== undefined) {
            updates.push('recommendations_collection_id');
            values.push(recommendations_collection_id);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }

        // Execute the update
        let result;
        if (updates.length === 2) {
            result = await sql`
                UPDATE "user" 
                SET recommendations_enabled = ${values[0] as boolean},
                    recommendations_collection_id = ${values[1] as string | null},
                    updated_at = NOW()
                WHERE id = ${req.userId}
                RETURNING recommendations_enabled, recommendations_collection_id
            `;
        } else if (updates[0] === 'recommendations_enabled') {
            result = await sql`
                UPDATE "user" 
                SET recommendations_enabled = ${values[0] as boolean},
                    updated_at = NOW()
                WHERE id = ${req.userId}
                RETURNING recommendations_enabled, recommendations_collection_id
            `;
        } else {
            result = await sql`
                UPDATE "user" 
                SET recommendations_collection_id = ${values[0] as string | null},
                    updated_at = NOW()
                WHERE id = ${req.userId}
                RETURNING recommendations_enabled, recommendations_collection_id
            `;
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedUser = result[0];
        const preferences: UserPreferences = {
            recommendations_enabled: updatedUser.recommendations_enabled ?? false,
            recommendations_collection_id: updatedUser.recommendations_collection_id ?? null,
        };

        res.status(200).json({ preferences });
    } catch (error) {
        console.error("Error updating user preferences:", error);
        next(error);
    }
};
