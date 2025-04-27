import { Request, Response } from 'express';
import { sql } from '../lib/db';
import { generateId } from 'lucia';
import { z } from 'zod';
import {
    createCollectionSchema,
    updateCollectionSchema,
    addMovieSchema,
    addCollaboratorSchema,
    updateCollaboratorSchema
} from '../lib/validators';

// --- Collection CRUD ---

// GET /api/collections (Get collections owned by or collaborated on by the user)
export const getUserCollections = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.sendStatus(401);

    try {
        // Fetch collections owned by the user OR where the user is a collaborator
        const collections = await sql`
            SELECT DISTINCT c.id, c.name, c.description, c.owner_id, c.created_at, c.updated_at,
                   u.username as owner_username, u.avatar_url as owner_avatar
            FROM collections c
            JOIN "user" u ON c.owner_id = u.id
            LEFT JOIN collection_collaborators cc ON c.id = cc.collection_id
            WHERE c.owner_id = ${userId} OR cc.user_id = ${userId}
            ORDER BY c.updated_at DESC
        `;
        res.status(200).json({ collections });
    } catch (error) {
        console.error('Error fetching user collections:', error);
        res.status(500).json({ message: 'Failed to fetch collections' });
    }
};

// GET /api/collections/:collectionId (Get specific collection details)
export const getCollectionById = async (req: Request, res: Response) => {
    const userId = req.user?.id; // Needed to check if current user is owner/collaborator for potential UI differences
    const { collectionId } = req.params;
    if (!userId) return res.sendStatus(401);

    try {
        // Fetch collection details including owner info
        const collectionResult = await sql`
            SELECT c.*, u.username as owner_username, u.avatar_url as owner_avatar
            FROM collections c
            JOIN "user" u ON c.owner_id = u.id
            WHERE c.id = ${collectionId}
        `;

        if (collectionResult.length === 0) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        const collection = collectionResult[0];

        // Fetch movies in the collection (consider pagination for large collections)
        const moviesResult = await sql`
            SELECT cm.movie_id, cm.added_at, u.username as added_by_username
            FROM collection_movies cm
            JOIN "user" u ON cm.added_by_user_id = u.id
            WHERE cm.collection_id = ${collectionId}
            ORDER BY cm.added_at DESC
        `;

        // Fetch collaborators
        const collaboratorsResult = await sql`
            SELECT cc.user_id, cc.permission, u.username, u.email, u.avatar_url
            FROM collection_collaborators cc
            JOIN "user" u ON cc.user_id = u.id
            WHERE cc.collection_id = ${collectionId}
        `;

        res.status(200).json({ 
            collection,
            movies: moviesResult, // TODO: Fetch full movie details from TMDB on frontend if needed
            collaborators: collaboratorsResult
        });

    } catch (error) {
        console.error(`Error fetching collection ${collectionId}:`, error);
        res.status(500).json({ message: 'Failed to fetch collection details' });
    }
};

// POST /api/collections (Create a new collection)
export const createCollection = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.sendStatus(401);

    try {
        const validation = createCollectionSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Validation failed', errors: validation.error.errors });
        }
        const { name, description } = validation.data;
        const newCollectionId = generateId(21); // Generate unique ID

        const result = await sql`
            INSERT INTO collections (id, name, description, owner_id)
            VALUES (${newCollectionId}, ${name}, ${description}, ${userId})
            RETURNING *
        `;

        res.status(201).json({ collection: result[0] });

    } catch (error) {
        console.error('Error creating collection:', error);
        res.status(500).json({ message: 'Failed to create collection' });
    }
};

// PUT /api/collections/:collectionId (Update collection details - name, description)
export const updateCollection = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { collectionId } = req.params;
    if (!userId) return res.sendStatus(401);

    try {
        const validation = updateCollectionSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Validation failed', errors: validation.error.errors });
        }
        const { name, description } = validation.data;

        // Check if there's anything to update
        if (name === undefined && description === undefined) {
             return res.status(400).json({ message: 'No update data provided' });
        }

        // Build the update query dynamically
        let updateQuery = sql`UPDATE collections SET `;
        const updates: any[] = [];
        const params: any[] = [];

        if (name !== undefined) {
            updates.push(sql`name = ${name}`);
            params.push(name);
        }
        if (description !== undefined) { // Allows setting description to null or a new value
            updates.push(sql`description = ${description}`);
             params.push(description);
        }
        updates.push(sql`updated_at = CURRENT_TIMESTAMP`); // Always update timestamp

        updateQuery = sql`${updateQuery} ${sql.join(updates, sql`, `)} WHERE id = ${collectionId} RETURNING *`;

        const result = await updateQuery;

        if (result.length === 0) {
            return res.status(404).json({ message: 'Collection not found or no changes made' });
        }

        res.status(200).json({ collection: result[0] });

    } catch (error) {
        console.error(`Error updating collection ${collectionId}:`, error);
        res.status(500).json({ message: 'Failed to update collection' });
    }
};

// DELETE /api/collections/:collectionId (Delete a collection - Owner only)
export const deleteCollection = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { collectionId } = req.params;
    if (!userId) return res.sendStatus(401);

    try {
        // Verify ownership before deleting
        const deleteResult = await sql`
            DELETE FROM collections
            WHERE id = ${collectionId} AND owner_id = ${userId}
            RETURNING id
        `;

        if (deleteResult.length === 0) {
            // Could be because it doesn't exist OR user isn't the owner
            // Check if collection exists to give a more specific error
            const exists = await sql`SELECT 1 FROM collections WHERE id = ${collectionId}`;
            if (exists.length > 0) {
                return res.status(403).json({ message: 'Forbidden: Only the owner can delete this collection' });
            } else {
                return res.status(404).json({ message: 'Collection not found' });
            }
        }

        res.status(204).send(); // No content on successful deletion

    } catch (error) {
        console.error(`Error deleting collection ${collectionId}:`, error);
        res.status(500).json({ message: 'Failed to delete collection' });
    }
};

// --- Movies within Collection ---

// POST /api/collections/:collectionId/movies (Add a movie)
export const addMovieToCollection = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { collectionId } = req.params;
    if (!userId) return res.sendStatus(401);

    try {
        const validation = addMovieSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Validation failed', errors: validation.error.errors });
        }
        const { movieId } = validation.data;
        const newEntryId = generateId(21);

        // Attempt to insert, handle potential unique constraint violation
        try {
            const result = await sql`
                INSERT INTO collection_movies (id, collection_id, movie_id, added_by_user_id)
                VALUES (${newEntryId}, ${collectionId}, ${movieId}, ${userId})
                RETURNING id, movie_id, added_at
            `;
            res.status(201).json({ movieEntry: result[0] });
        } catch (insertError: any) {
            // Check if it's a unique violation error (specific code depends on DB/driver)
            if (insertError.code === '23505') { // PostgreSQL unique violation code
                return res.status(409).json({ message: 'Movie already exists in this collection' });
            } else {
                throw insertError; // Re-throw other errors
            }
        }

    } catch (error) {
        console.error(`Error adding movie to collection ${collectionId}:`, error);
        res.status(500).json({ message: 'Failed to add movie to collection' });
    }
};

// DELETE /api/collections/:collectionId/movies/:movieId (Remove a movie)
export const removeMovieFromCollection = async (req: Request, res: Response) => {
    const userId = req.user?.id; // Needed for permission check via middleware
    const { collectionId, movieId } = req.params;
    if (!userId) return res.sendStatus(401);

    // Convert movieId param to number
    const movieIdNum = parseInt(movieId, 10);
    if (isNaN(movieIdNum)) {
        return res.status(400).json({ message: 'Invalid Movie ID format' });
    }

    try {
        const deleteResult = await sql`
            DELETE FROM collection_movies
            WHERE collection_id = ${collectionId} AND movie_id = ${movieIdNum}
            RETURNING id
        `;

        if (deleteResult.length === 0) {
            return res.status(404).json({ message: 'Movie not found in this collection' });
        }

        res.status(204).send();

    } catch (error) {
        console.error(`Error removing movie ${movieIdNum} from collection ${collectionId}:`, error);
        res.status(500).json({ message: 'Failed to remove movie from collection' });
    }
};

// --- Collaborators ---

// POST /api/collections/:collectionId/collaborators (Add/invite a collaborator)
export const addCollaborator = async (req: Request, res: Response) => {
    const inviterId = req.user?.id; // User performing the action (owner)
    const { collectionId } = req.params;
    if (!inviterId) return res.sendStatus(401);

    try {
        const validation = addCollaboratorSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Validation failed', errors: validation.error.errors });
        }
        const { email, permission } = validation.data;

        // Find the user to invite by email
        const userToInvite = await sql`SELECT id FROM "user" WHERE email = ${email}`;
        if (userToInvite.length === 0) {
            return res.status(404).json({ message: `User with email ${email} not found` });
        }
        const inviteeId = userToInvite[0].id;

        // Check if trying to add the owner as a collaborator
        const ownerCheck = await sql`SELECT 1 FROM collections WHERE id = ${collectionId} AND owner_id = ${inviteeId}`;
        if (ownerCheck.length > 0) {
             return res.status(400).json({ message: 'Cannot add the collection owner as a collaborator' });
        }

        const newCollaboratorId = generateId(21);

        // Attempt to insert, handle potential unique constraint violation
        try {
            const result = await sql`
                INSERT INTO collection_collaborators (id, collection_id, user_id, permission)
                VALUES (${newCollaboratorId}, ${collectionId}, ${inviteeId}, ${permission})
                RETURNING id, user_id, permission, added_at
            `;
            
            // Fetch collaborator details for the response
            const collaboratorDetails = await sql`
                SELECT u.id, u.username, u.email, u.avatar_url, cc.permission
                FROM "user" u
                JOIN collection_collaborators cc ON u.id = cc.user_id
                WHERE cc.id = ${result[0].id}
            `;

            res.status(201).json({ collaborator: collaboratorDetails[0] });
        } catch (insertError: any) {
            if (insertError.code === '23505') { // Unique violation
                return res.status(409).json({ message: 'User is already a collaborator on this collection' });
            } else {
                throw insertError;
            }
        }

    } catch (error) {
        console.error(`Error adding collaborator to collection ${collectionId}:`, error);
        res.status(500).json({ message: 'Failed to add collaborator' });
    }
};

// PUT /api/collections/:collectionId/collaborators/:userId (Update collaborator permission - Owner only)
export const updateCollaboratorPermission = async (req: Request, res: Response) => {
    const { collectionId, userId: collaboratorUserId } = req.params;
    const requesterId = req.user?.id;
    if (!requesterId) return res.sendStatus(401);

    try {
        const validation = updateCollaboratorSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Validation failed', errors: validation.error.errors });
        }
        const { permission } = validation.data;

        const result = await sql`
            UPDATE collection_collaborators
            SET permission = ${permission}
            WHERE collection_id = ${collectionId} AND user_id = ${collaboratorUserId}
            RETURNING id, user_id, permission
        `;

        if (result.length === 0) {
            return res.status(404).json({ message: 'Collaborator not found on this collection' });
        }

        res.status(200).json({ collaborator: result[0] });

    } catch (error) {
        console.error(`Error updating collaborator ${collaboratorUserId} for collection ${collectionId}:`, error);
        res.status(500).json({ message: 'Failed to update collaborator permission' });
    }
};

// DELETE /api/collections/:collectionId/collaborators/:userId (Remove a collaborator - Owner only)
export const removeCollaborator = async (req: Request, res: Response) => {
    const { collectionId, userId: collaboratorUserId } = req.params;
     const requesterId = req.user?.id;
    if (!requesterId) return res.sendStatus(401);

    try {
        const deleteResult = await sql`
            DELETE FROM collection_collaborators
            WHERE collection_id = ${collectionId} AND user_id = ${collaboratorUserId}
            RETURNING id
        `;

        if (deleteResult.length === 0) {
            return res.status(404).json({ message: 'Collaborator not found on this collection' });
        }

        res.status(204).send();

    } catch (error) {
        console.error(`Error removing collaborator ${collaboratorUserId} from collection ${collectionId}:`, error);
        res.status(500).json({ message: 'Failed to remove collaborator' });
    }
};
