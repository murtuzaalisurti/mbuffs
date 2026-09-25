import { afterAll, beforeAll, expect, test } from 'vitest';
import request from 'supertest';
import app from '../api/index.js';
import { sql } from '../lib/db.js';
import { generateId } from '../lib/utils.js';

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:8080';
const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

// --- Test users ---
const owner = {
    id: `perm_owner_${suffix}`,
    email: `perm_owner_${suffix}@example.com`,
    name: 'Perm Owner',
    role: 'user',
};

const editor = {
    id: `perm_editor_${suffix}`,
    email: `perm_editor_${suffix}@example.com`,
    name: 'Perm Editor',
    role: 'user',
};

const viewer = {
    id: `perm_viewer_${suffix}`,
    email: `perm_viewer_${suffix}@example.com`,
    name: 'Perm Viewer',
    role: 'user',
};

const invitee = {
    id: `perm_invitee_${suffix}`,
    email: `perm_invitee_${suffix}@example.com`,
    name: 'Perm Invitee',
    role: 'user',
};

const ORIGINAL_NAME = 'Perm Collection';
const SYSTEM_NAME = `Perm System ${suffix}`;
const SEED_MOVIE_ID = '550';

// Regular collection shared with `editor` (edit) and `viewer` (view).
let collectionId: string;
// System collection (like Watched / Not Interested) owned by `owner`.
let systemCollectionId: string;

const authed = (
    req: request.Test,
    user: { id: string; role: string },
) => {
    req.set('x-test-user-id', user.id);
    req.set('x-test-user-role', user.role);
    req.set('Origin', frontendOrigin);
    return req;
};

const getCollectionRow = async (id: string) => {
    const rows = await sql`SELECT name, description, is_public FROM collections WHERE id = ${id}`;
    return rows[0] as { name: string; description: string | null; is_public: boolean } | undefined;
};

beforeAll(async () => {
    await sql`
        INSERT INTO "user" (id, name, email, email_verified, role)
        VALUES
            (${owner.id}, ${owner.name}, ${owner.email}, true, ${owner.role}),
            (${editor.id}, ${editor.name}, ${editor.email}, true, ${editor.role}),
            (${viewer.id}, ${viewer.name}, ${viewer.email}, true, ${viewer.role}),
            (${invitee.id}, ${invitee.name}, ${invitee.email}, true, ${invitee.role})
    `;

    collectionId = generateId(21);
    systemCollectionId = generateId(21);

    await sql`
        INSERT INTO collections (id, name, description, owner_id, is_public, shareable_id, is_system)
        VALUES
            (${collectionId}, ${ORIGINAL_NAME}, 'Permission tests', ${owner.id}, false, ${generateId(12)}, false),
            (${systemCollectionId}, ${SYSTEM_NAME}, 'System collection', ${owner.id}, false, ${generateId(12)}, true)
    `;

    await sql`
        INSERT INTO collection_collaborators (id, collection_id, user_id, permission)
        VALUES
            (${generateId(21)}, ${collectionId}, ${editor.id}, 'edit'),
            (${generateId(21)}, ${collectionId}, ${viewer.id}, 'view')
    `;

    await sql`
        INSERT INTO collection_movies (id, collection_id, movie_id, added_by_user_id, is_movie)
        VALUES
            (${generateId(21)}, ${collectionId}, ${SEED_MOVIE_ID}, ${owner.id}, true),
            (${generateId(21)}, ${systemCollectionId}, ${SEED_MOVIE_ID}, ${owner.id}, true)
    `;
});

afterAll(async () => {
    await sql`DELETE FROM collection_movies WHERE collection_id IN (${collectionId}, ${systemCollectionId})`;
    await sql`DELETE FROM collection_collaborators WHERE collection_id IN (${collectionId}, ${systemCollectionId})`;
    await sql`DELETE FROM collections WHERE id IN (${collectionId}, ${systemCollectionId})`;
    await sql`DELETE FROM "user" WHERE id IN (${owner.id}, ${editor.id}, ${viewer.id}, ${invitee.id})`;
});

// ---------------------------------------------------------------------------
// COLLECTION SETTINGS ARE OWNER-ONLY (matches the UI's owner-only Edit/Delete)
// ---------------------------------------------------------------------------

test('edit collaborator cannot rename the collection', async () => {
    const res = await authed(
        request(app).put(`/api/collections/${collectionId}`).send({ name: 'Renamed by editor' }),
        editor,
    );

    expect(res.status).toBe(403);
    expect((await getCollectionRow(collectionId))?.name).toBe(ORIGINAL_NAME);
});

test('edit collaborator cannot make the collection public', async () => {
    const res = await authed(
        request(app).put(`/api/collections/${collectionId}`).send({ is_public: true }),
        editor,
    );

    expect(res.status).toBe(403);
    expect((await getCollectionRow(collectionId))?.is_public).toBe(false);
});

test('view collaborator cannot update the collection', async () => {
    const res = await authed(
        request(app).put(`/api/collections/${collectionId}`).send({ description: 'Changed by viewer' }),
        viewer,
    );

    expect(res.status).toBe(403);
    expect((await getCollectionRow(collectionId))?.description).toBe('Permission tests');
});

test('edit collaborator cannot delete the collection', async () => {
    const res = await authed(request(app).delete(`/api/collections/${collectionId}`), editor);

    expect(res.status).toBe(403);
    expect(await getCollectionRow(collectionId)).toBeDefined();
});

test('owner can update collection settings', async () => {
    const res = await authed(
        request(app).put(`/api/collections/${collectionId}`).send({ description: 'Updated by owner' }),
        owner,
    );

    expect(res.status).toBe(200);
    expect((await getCollectionRow(collectionId))?.description).toBe('Updated by owner');
});

test('edit collaborator can still add items', async () => {
    const res = await authed(
        request(app).post(`/api/collections/${collectionId}/movies`).send({ movieId: '680', mediaType: 'movie' }),
        editor,
    );

    expect(res.status).toBe(201);
});

// ---------------------------------------------------------------------------
// SYSTEM COLLECTIONS ARE ONLY MANAGED THROUGH THEIR TOGGLE ENDPOINTS
// ---------------------------------------------------------------------------

test('owner cannot rename a system collection', async () => {
    const res = await authed(
        request(app).put(`/api/collections/${systemCollectionId}`).send({ name: 'Renamed system' }),
        owner,
    );

    expect(res.status).toBe(403);
    expect((await getCollectionRow(systemCollectionId))?.name).toBe(SYSTEM_NAME);
});

test('owner cannot make a system collection public', async () => {
    const res = await authed(
        request(app).put(`/api/collections/${systemCollectionId}`).send({ is_public: true }),
        owner,
    );

    expect(res.status).toBe(403);
    expect((await getCollectionRow(systemCollectionId))?.is_public).toBe(false);
});

test('owner cannot delete a system collection', async () => {
    const res = await authed(request(app).delete(`/api/collections/${systemCollectionId}`), owner);

    expect(res.status).toBe(403);
    expect(await getCollectionRow(systemCollectionId)).toBeDefined();
});

test('owner cannot add or remove system collection items via the generic routes', async () => {
    const addRes = await authed(
        request(app).post(`/api/collections/${systemCollectionId}/movies`).send({ movieId: '680', mediaType: 'movie' }),
        owner,
    );
    expect(addRes.status).toBe(403);

    const removeRes = await authed(
        request(app).delete(`/api/collections/${systemCollectionId}/movies/${SEED_MOVIE_ID}`),
        owner,
    );
    expect(removeRes.status).toBe(403);
});

test('bulk actions cannot target or read from a system collection', async () => {
    const intoSystem = await authed(
        request(app)
            .post(`/api/collections/${collectionId}/movies/bulk`)
            .send({ action: 'copy', movieIds: [SEED_MOVIE_ID], targetCollectionId: systemCollectionId }),
        owner,
    );
    expect(intoSystem.status).toBe(403);

    const fromSystem = await authed(
        request(app)
            .post(`/api/collections/${systemCollectionId}/movies/bulk`)
            .send({ action: 'remove', movieIds: [SEED_MOVIE_ID] }),
        owner,
    );
    expect(fromSystem.status).toBe(403);

    const items = await sql`SELECT 1 FROM collection_movies WHERE collection_id = ${systemCollectionId}`;
    expect(items.length).toBe(1);
});

test('owner cannot add collaborators to a system collection', async () => {
    const res = await authed(
        request(app)
            .post(`/api/collections/${systemCollectionId}/collaborators`)
            .send({ email: invitee.email, permission: 'view' }),
        owner,
    );

    expect(res.status).toBe(403);
});

// ---------------------------------------------------------------------------
// MEDIA MEMBERSHIP (which of my collections contain a title)
// ---------------------------------------------------------------------------

test('membership lists owned collections containing the item, excluding system collections', async () => {
    const res = await authed(request(app).get(`/api/collections/membership/${SEED_MOVIE_ID}`), owner);

    expect(res.status).toBe(200);
    expect(res.body.membership[collectionId]).toEqual({ hasMedia: true, addedByUserId: owner.id });
    expect(res.body.membership[systemCollectionId]).toBeUndefined();
});

test('membership includes shared collections and reports absent items', async () => {
    const res = await authed(request(app).get('/api/collections/membership/999999999'), viewer);

    expect(res.status).toBe(200);
    expect(res.body.membership[collectionId]).toEqual({ hasMedia: false, addedByUserId: null });
});

test('membership does not include collections the user cannot access', async () => {
    const res = await authed(request(app).get(`/api/collections/membership/${SEED_MOVIE_ID}`), invitee);

    expect(res.status).toBe(200);
    expect(res.body.membership).toEqual({});
});

test('membership requires authentication', async () => {
    const res = await request(app).get(`/api/collections/membership/${SEED_MOVIE_ID}`);

    expect(res.status).toBe(401);
});
