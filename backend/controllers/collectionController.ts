import { Request, Response, NextFunction } from 'express';
import { sql } from '../lib/db.js';
import { generateId } from '../lib/utils.js';
import { z } from 'zod';
import {
    createCollectionSchema,
    updateCollectionSchema,
    addMovieSchema,
    addCollaboratorSchema,
    updateCollaboratorSchema
} from '../lib/validators.js';

import { 
    CollectionCollaborator, 
    CollectionMovieEntry, 
    CollectionSummary, 
    CollectionRow
} from '../lib/types.js'; 

interface CollectionDetailsResponse {
    collection: CollectionSummary;
    movies: CollectionMovieEntry[];
    collaborators: CollectionCollaborator[];
}

//modify collectionSummary type
export const getUserCollections = async (req: Request, res: Response, next: NextFunction) => {
    console.log("Fetching user collections", req.userId);
    const userId = req.userId;
    if (!userId) {
        res.sendStatus(401);
        return;
    }
    try {
        // Get collections with preview movie IDs (up to 4 per collection)
        // Using a subquery approach to avoid DISTINCT issues with JSON
        const collections = await sql`
            SELECT c.id, c.name, c.description, c.owner_id, c.created_at, c.updated_at,
                   u.username as owner_username, u.avatar_url as owner_avatar,
                   (
                       SELECT COALESCE(json_agg(movie_id), '[]'::json)
                       FROM (
                           SELECT movie_id
                           FROM collection_movies
                           WHERE collection_id = c.id
                           ORDER BY added_at DESC
                           LIMIT 4
                       ) sub
                   ) as preview_movie_ids
            FROM collections c
            JOIN "user" u ON c.owner_id = u.id
            WHERE c.id IN (
                SELECT DISTINCT col.id
                FROM collections col
                LEFT JOIN collection_collaborators cc ON col.id = cc.collection_id
                WHERE col.owner_id = ${userId} OR cc.user_id = ${userId}
            )
            ORDER BY c.updated_at DESC
        `;
        res.status(200).json({ collections: collections });
    } catch (error) {
        next(error);
    }
};

export const getCollectionById = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;
    const { collectionId } = req.params;
    if (!userId) {
        res.sendStatus(401);
        return;
    }
    try {
        const collectionResult = await sql`
            SELECT c.*, u.username as owner_username, u.avatar_url as owner_avatar
            FROM collections c
            JOIN "user" u ON c.owner_id = u.id
            WHERE c.id = ${collectionId}
        `;

        if (collectionResult.length === 0) {
            res.status(404).json({ message: 'Collection not found' });
            return;
        }
        const collectionData = collectionResult[0];
        
        const collectionSummary: CollectionSummary = {
             id: collectionData.id,
             name: collectionData.name,
             description: collectionData.description,
             owner_id: collectionData.owner_id,
             created_at: collectionData.created_at,
             updated_at: collectionData.updated_at,
             owner_username: collectionData.owner_username,
             owner_avatar: collectionData.owner_avatar,
        };

        const moviesResult = await sql`
            SELECT cm.movie_id, cm.is_movie, cm.added_at, u.username as added_by_username
            FROM collection_movies cm
            JOIN "user" u ON cm.added_by_user_id = u.id
            WHERE cm.collection_id = ${collectionId}
            ORDER BY cm.added_at DESC
        `;

        const collaboratorsResult = await sql`
            SELECT cc.user_id, cc.permission, u.username, u.email, u.avatar_url
            FROM collection_collaborators cc
            JOIN "user" u ON cc.user_id = u.id
            WHERE cc.collection_id = ${collectionId}
        `;
        
        const responseData: CollectionDetailsResponse = {
             collection: collectionSummary,
             movies: (moviesResult as (CollectionMovieEntry & { added_by_username: string | null })[]).map(m => ({ movie_id: m.movie_id, added_at: m.added_at, added_by_username: m.added_by_username, is_movie: m.is_movie })), 
             collaborators: collaboratorsResult as CollectionCollaborator[]
        };

        res.status(200).json(responseData);
    } catch (error) {
        next(error);
    }
};

export const createCollection = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;
    if (!userId) { 
        res.sendStatus(401);
        return;
     }
    try {
        const validation = createCollectionSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ message: 'Validation failed', errors: validation.error.issues });
            return;
        }
        const { name, description } = validation.data;
        const newCollectionId = generateId(21);
        const newShareableId = generateId(12);

        const result = await sql`
            INSERT INTO collections (id, name, description, owner_id, shareable_id)
            VALUES (${newCollectionId}, ${name}, ${description}, ${userId}, ${newShareableId})
            RETURNING *
        `;

        res.status(201).json({ collection: result[0] as CollectionRow });
    } catch(error) {
        next(error);
    }
};

export const updateCollection = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;
    const { collectionId } = req.params;
    if (!userId) { 
        res.sendStatus(401);
        return;
     }
    try {
        const validation = updateCollectionSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ message: 'Validation failed', errors: validation.error.issues });
            return;
        }
        const { name, description } = validation.data;

        if (name === undefined && description === undefined) {
             res.status(400).json({ message: 'No update data provided' });
             return;
        }

        // Build the update dynamically using tagged template
        let result;
        if (name !== undefined && description !== undefined) {
            result = await sql`
                UPDATE collections 
                SET updated_at = CURRENT_TIMESTAMP, name = ${name}, description = ${description}
                WHERE id = ${collectionId}
                RETURNING *
            `;
        } else if (name !== undefined) {
            result = await sql`
                UPDATE collections 
                SET updated_at = CURRENT_TIMESTAMP, name = ${name}
                WHERE id = ${collectionId}
                RETURNING *
            `;
        } else {
            result = await sql`
                UPDATE collections 
                SET updated_at = CURRENT_TIMESTAMP, description = ${description}
                WHERE id = ${collectionId}
                RETURNING *
            `;
        }

        if (result.length === 0) {
            res.status(404).json({ message: 'Collection not found or no changes made' });
            return;
        }

        res.status(200).json({ collection: result[0] as CollectionRow });
    } catch(error) {
        next(error);
    }
};

export const deleteCollection = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;
    const { collectionId } = req.params;
    if (!userId) { 
        res.sendStatus(401);
        return;
    }
    try {
        const deleteResult = await sql`
            DELETE FROM collections
            WHERE id = ${collectionId} AND owner_id = ${userId}
            RETURNING id
        `;

        if (deleteResult.length === 0) {
            const exists = await sql`SELECT 1 FROM collections WHERE id = ${collectionId}`;
            if (exists.length > 0) {
                res.status(403).json({ message: 'Forbidden: Only the owner can delete this collection' });
            } else {
                res.status(404).json({ message: 'Collection not found' });
            }
            return;
        }

        res.status(204).send();
    } catch(error) {
        next(error);
    }
};

export const addMovieToCollection = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;
    const { collectionId } = req.params;
    if (!userId) { 
        res.sendStatus(401);
        return;
    }
    try {
        const validation = addMovieSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ message: 'Validation failed', errors: validation.error.issues });
            return;
        }
        const { movieId } = validation.data;
        const newEntryId = generateId(21);

        try {
            const result = await sql`
                INSERT INTO collection_movies (id, collection_id, movie_id, added_by_user_id)
                VALUES (${newEntryId}, ${collectionId}, ${movieId}, ${userId})
                RETURNING id, movie_id, added_at
            `;
            res.status(201).json({ movieEntry: result[0] as {id: string, movie_id: number, added_at: string} });
        } catch (insertError: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (insertError.code === '23505') { 
                res.status(409).json({ message: 'Movie already exists in this collection' });
            } else {
                next(insertError); 
            }
        }
    } catch (error) {
        next(error);
    }
};

export const removeMovieFromCollection = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;
    const { collectionId, movieId } = req.params;
    if (!userId) { 
        res.sendStatus(401);
        return;
    }
    try {
        // movie_id can be a number (for movies) or string with 'tv' suffix (for TV shows)
        const deleteResult = await sql`
            DELETE FROM collection_movies
            WHERE collection_id = ${collectionId} AND movie_id = ${movieId}
            RETURNING id
        `;

        if (deleteResult.length === 0) {
            res.status(404).json({ message: 'Movie not found in this collection' });
            return;
        }

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

export const addCollaborator = async (req: Request, res: Response, next: NextFunction) => {
    const inviterId = req.userId;
    const { collectionId } = req.params;
    if (!inviterId) { 
        res.sendStatus(401);
        return;
     }
    try {
        const validation = addCollaboratorSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ message: 'Validation failed', errors: validation.error.issues });
            return;
        }
        const { email, permission } = validation.data;

        const userToInvite = await sql`SELECT id FROM "user" WHERE email = ${email}`;
        if (userToInvite.length === 0) {
            res.status(404).json({ message: `User with email ${email} not found` });
            return;
        }
        const inviteeId = (userToInvite[0] as {id: string}).id;

        const ownerCheck = await sql`SELECT 1 FROM collections WHERE id = ${collectionId} AND owner_id = ${inviteeId}`;
        if (ownerCheck.length > 0) {
             res.status(400).json({ message: 'Cannot add the collection owner as a collaborator' });
             return;
        }

        const newCollaboratorId = generateId(21);

        try {
            const insertResult = await sql`
                INSERT INTO collection_collaborators (id, collection_id, user_id, permission)
                VALUES (${newCollaboratorId}, ${collectionId}, ${inviteeId}, ${permission})
                RETURNING id, user_id, permission, added_at
            `;
            
            const collaboratorDetails = await sql`
                SELECT u.id as user_id, cc.permission, u.username, u.email, u.avatar_url
                FROM "user" u
                JOIN collection_collaborators cc ON u.id = cc.user_id
                WHERE cc.id = ${(insertResult[0] as {id: string}).id}
            `;

            res.status(201).json({ collaborator: collaboratorDetails[0] as CollectionCollaborator });
        } catch (insertError: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (insertError.code === '23505') {
                res.status(409).json({ message: 'User is already a collaborator on this collection' });
            } else {
                next(insertError);
            }
        }
    } catch(error) {
        next(error);
    }
};

export const updateCollaboratorPermission = async (req: Request, res: Response, next: NextFunction) => {
    const { collectionId, userId: collaboratorUserId } = req.params;
    const requesterId = req.userId;
    if (!requesterId) { 
        res.sendStatus(401);
        return;
     }
    try {
        const validation = updateCollaboratorSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ message: 'Validation failed', errors: validation.error.issues });
            return;
        }
        const { permission } = validation.data;

        const result = await sql`
            UPDATE collection_collaborators
            SET permission = ${permission}
            WHERE collection_id = ${collectionId} AND user_id = ${collaboratorUserId}
            RETURNING id, user_id, permission
        `;

        if (result.length === 0) {
            res.status(404).json({ message: 'Collaborator not found on this collection' });
            return;
        }

        res.status(200).json({ collaborator: result[0] as {id: string, user_id: string, permission: string} });
    } catch(error) {
        next(error);
    }
};

export const removeCollaborator = async (req: Request, res: Response, next: NextFunction) => {
    const { collectionId, userId: collaboratorUserId } = req.params;
     const requesterId = req.userId;
    if (!requesterId) { 
        res.sendStatus(401);
        return;
    }
    try {
        const deleteResult = await sql`
            DELETE FROM collection_collaborators
            WHERE collection_id = ${collectionId} AND user_id = ${collaboratorUserId}
            RETURNING id
        `;

        if (deleteResult.length === 0) {
            res.status(404).json({ message: 'Collaborator not found on this collection' });
            return;
        }

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
