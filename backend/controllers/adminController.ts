import { Request, Response, NextFunction } from 'express';
import { sql } from '../lib/db.js';
import { AdminUserResponse } from '../lib/types.js';
import { generateId } from '../lib/utils.js';

interface AdminUserRow {
    id: string;
    name: string;
    email: string;
    email_verified: boolean;
    image: string | null;
    username: string | null;
    avatar_url: string | null;
    first_name: string | null;
    last_name: string | null;
    role: string;
    created_at: string | Date;
    updated_at: string | Date;
    recommendations_enabled: boolean | null;
    recommendations_collection_id: string | null;
    category_recommendations_enabled: boolean | null;
    show_reddit_label: boolean | null;
}

interface CollectionCountRow {
    owner_id: string;
    collection_count: string | number;
}

interface AccountProviderRow {
    user_id: string;
    provider_id: string;
}

const toIsoString = (value: string | Date): string => {
    if (typeof value === 'string') {
        return value;
    }

    return value.toISOString();
};

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const usersResult = await sql`
            SELECT id, name, email, email_verified, image, username, avatar_url, first_name, last_name, role, created_at, updated_at, recommendations_enabled, recommendations_collection_id, category_recommendations_enabled, show_reddit_label
            FROM "user"
            ORDER BY created_at DESC
        `;

        const collectionCountsResult = await sql`
            SELECT owner_id, COUNT(*) as collection_count
            FROM collections
            GROUP BY owner_id
        `;

        const accountProvidersResult = await sql`
            SELECT user_id, provider_id
            FROM account
            ORDER BY created_at ASC
        `;

        const collectionCountByOwnerId = new Map<string, number>(
            (collectionCountsResult as CollectionCountRow[]).map((row) => [
                row.owner_id,
                Number(row.collection_count) || 0,
            ])
        );

        const providersByUserId = new Map<string, string[]>();
        for (const row of accountProvidersResult as AccountProviderRow[]) {
            const existing = providersByUserId.get(row.user_id) ?? [];
            if (!existing.includes(row.provider_id)) {
                existing.push(row.provider_id);
            }
            providersByUserId.set(row.user_id, existing);
        }

        const backendUrl = process.env.BETTER_AUTH_URL || 'http://localhost:5001';

        const users: AdminUserResponse[] = (usersResult as AdminUserRow[]).map((userRow) => ({
            id: userRow.id,
            name: userRow.name,
            email: userRow.email,
            emailVerified: Boolean(userRow.email_verified),
            image: userRow.image ?? null,
            username: userRow.username ?? null,
            avatarUrl: userRow.avatar_url ? `${backendUrl}/api/user/avatar/${userRow.id}` : null,
            firstName: userRow.first_name ?? null,
            lastName: userRow.last_name ?? null,
            role: userRow.role ?? 'user',
            createdAt: toIsoString(userRow.created_at),
            updatedAt: toIsoString(userRow.updated_at),
            recommendationsEnabled: userRow.recommendations_enabled ?? false,
            recommendationsCollectionId: userRow.recommendations_collection_id ?? null,
            categoryRecommendationsEnabled: userRow.category_recommendations_enabled ?? false,
            showRedditLabel: userRow.show_reddit_label ?? true,
            providers: providersByUserId.get(userRow.id) ?? [],
            collectionCount: collectionCountByOwnerId.get(userRow.id) ?? 0,
        }));

        res.status(200).json({ users, total: users.length });
    } catch (error) {
        console.error('Error fetching admin users:', error);
        next(error);
    }
};

export const getCuratedItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const items = await sql`
            SELECT
                ci.id, ci.tmdb_id, ci.media_type, ci.title, ci.poster_path,
                ci.added_by_user_id, ci.added_at,
                u.name as added_by_name
            FROM admin_curated_items ci
            LEFT JOIN "user" u ON ci.added_by_user_id = u.id
            ORDER BY ci.added_at DESC
        `;
        res.status(200).json({ items, total: items.length });
    } catch (error) {
        console.error('Error fetching curated items:', error);
        next(error);
    }
};

export const addCuratedItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tmdb_id, media_type, title, poster_path } = req.body;

        if (!tmdb_id || !media_type || !title) {
            res.status(400).json({ message: 'tmdb_id, media_type, and title are required' });
            return;
        }

        if (media_type !== 'movie' && media_type !== 'tv') {
            res.status(400).json({ message: "media_type must be 'movie' or 'tv'" });
            return;
        }

        const existing = await sql`
            SELECT id FROM admin_curated_items
            WHERE tmdb_id = ${String(tmdb_id)} AND media_type = ${media_type}
        `;

        if (existing.length > 0) {
            res.status(409).json({ message: 'Item already curated' });
            return;
        }

        const newId = generateId(21);
        const result = await sql`
            INSERT INTO admin_curated_items (id, tmdb_id, media_type, title, poster_path, added_by_user_id)
            VALUES (${newId}, ${String(tmdb_id)}, ${media_type}, ${title}, ${poster_path || null}, ${req.userId})
            RETURNING *
        `;

        res.status(201).json({ item: result[0] });
    } catch (error) {
        console.error('Error adding curated item:', error);
        next(error);
    }
};

export const removeCuratedItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        const result = await sql`
            DELETE FROM admin_curated_items WHERE id = ${id} RETURNING id
        `;

        if (result.length === 0) {
            res.status(404).json({ message: 'Curated item not found' });
            return;
        }

        res.status(200).json({ message: 'Removed' });
    } catch (error) {
        console.error('Error removing curated item:', error);
        next(error);
    }
};
