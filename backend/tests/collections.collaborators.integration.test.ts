import { afterAll, beforeAll, expect, test } from 'vitest';
import request from 'supertest';
import app from '../api/index.js';
import { sql } from '../lib/db.js';
import { generateId } from '../lib/utils.js';

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:8080';
const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

// --- Test users ---
const owner = {
    id: `collab_owner_${suffix}`,
    email: `collab_owner_${suffix}@example.com`,
    name: 'Collab Owner',
    role: 'user',
};

const editor = {
    id: `collab_editor_${suffix}`,
    email: `collab_editor_${suffix}@example.com`,
    name: 'Collab Editor',
    role: 'user',
};

const viewer = {
    id: `collab_viewer_${suffix}`,
    email: `collab_viewer_${suffix}@example.com`,
    name: 'Collab Viewer',
    role: 'user',
};

const outsider = {
    id: `collab_outsider_${suffix}`,
    email: `collab_outsider_${suffix}@example.com`,
    name: 'Collab Outsider',
    role: 'user',
};

const invitee = {
    id: `collab_invitee_${suffix}`,
    email: `collab_invitee_${suffix}@example.com`,
    name: 'Collab Invitee',
    role: 'user',
};

const invitee2 = {
    id: `collab_invitee2_${suffix}`,
    email: `collab_invitee2_${suffix}@example.com`,
    name: 'Collab Invitee Two',
    role: 'user',
};

let collectionId: string;

const authed = (
    req: request.Test,
    user: { id: string; role: string },
    withOrigin = true,
) => {
    req.set('x-test-user-id', user.id);
    req.set('x-test-user-role', user.role);
    if (withOrigin) {
        req.set('Origin', frontendOrigin);
    }
    return req;
};

const collaboratorRowExists = async (userId: string): Promise<boolean> => {
    const rows = await sql`
        SELECT 1 FROM collection_collaborators
        WHERE collection_id = ${collectionId} AND user_id = ${userId}
    `;
    return rows.length > 0;
};

beforeAll(async () => {
    await sql`
        INSERT INTO "user" (id, name, email, email_verified, role)
        VALUES
            (${owner.id}, ${owner.name}, ${owner.email}, true, ${owner.role}),
            (${editor.id}, ${editor.name}, ${editor.email}, true, ${editor.role}),
            (${viewer.id}, ${viewer.name}, ${viewer.email}, true, ${viewer.role}),
            (${outsider.id}, ${outsider.name}, ${outsider.email}, true, ${outsider.role}),
            (${invitee.id}, ${invitee.name}, ${invitee.email}, true, ${invitee.role}),
            (${invitee2.id}, ${invitee2.name}, ${invitee2.email}, true, ${invitee2.role})
    `;

    // Collection owned by `owner`
    collectionId = generateId(21);
    await sql`
        INSERT INTO collections (id, name, description, owner_id, is_public, shareable_id, is_system)
        VALUES (${collectionId}, 'Collab Collection', 'Collaborator permission tests', ${owner.id}, false, ${generateId(12)}, false)
    `;

    // Existing collaborators: `editor` can edit, `viewer` can only view.
    await sql`
        INSERT INTO collection_collaborators (id, collection_id, user_id, permission)
        VALUES
            (${generateId(21)}, ${collectionId}, ${editor.id}, 'edit'),
            (${generateId(21)}, ${collectionId}, ${viewer.id}, 'view')
    `;
});

afterAll(async () => {
    await sql`DELETE FROM collection_collaborators WHERE collection_id = ${collectionId}`;
    await sql`DELETE FROM collections WHERE id = ${collectionId}`;
    await sql`DELETE FROM "user" WHERE id IN (${owner.id}, ${editor.id}, ${viewer.id}, ${outsider.id}, ${invitee.id}, ${invitee2.id})`;
});

// ---------------------------------------------------------------------------
// AUTHENTICATION
// ---------------------------------------------------------------------------

test('blocks unauthenticated collaborator creation', async () => {
    const res = await request(app)
        .post(`/api/collections/${collectionId}/collaborators`)
        .set('Origin', frontendOrigin)
        .send({ email: invitee2.email, permission: 'edit' });

    expect(res.status).toBe(401);
});

// ---------------------------------------------------------------------------
// ADD COLLABORATOR
// ---------------------------------------------------------------------------

test('owner can add a collaborator by email', async () => {
    const res = await authed(
        request(app)
            .post(`/api/collections/${collectionId}/collaborators`)
            .send({ email: invitee.email, permission: 'view' }),
        owner,
    );

    expect(res.status).toBe(201);
    expect(res.body.collaborator.user_id).toBe(invitee.id);
    expect(res.body.collaborator.permission).toBe('view');
    expect(await collaboratorRowExists(invitee.id)).toBe(true);
});

test('owner cannot add the collection owner as a collaborator', async () => {
    const res = await authed(
        request(app)
            .post(`/api/collections/${collectionId}/collaborators`)
            .send({ email: owner.email, permission: 'edit' }),
        owner,
    );

    expect(res.status).toBe(400);
});

test('outsider cannot add themselves as a collaborator (IDOR regression)', async () => {
    const res = await authed(
        request(app)
            .post(`/api/collections/${collectionId}/collaborators`)
            .send({ email: outsider.email, permission: 'edit' }),
        outsider,
    );

    expect(res.status).toBe(403);
    expect(await collaboratorRowExists(outsider.id)).toBe(false);
});

test('edit collaborator cannot add a collaborator', async () => {
    const res = await authed(
        request(app)
            .post(`/api/collections/${collectionId}/collaborators`)
            .send({ email: invitee2.email, permission: 'edit' }),
        editor,
    );

    expect(res.status).toBe(403);
    expect(await collaboratorRowExists(invitee2.id)).toBe(false);
});

test('view collaborator cannot add a collaborator', async () => {
    const res = await authed(
        request(app)
            .post(`/api/collections/${collectionId}/collaborators`)
            .send({ email: invitee2.email, permission: 'edit' }),
        viewer,
    );

    expect(res.status).toBe(403);
    expect(await collaboratorRowExists(invitee2.id)).toBe(false);
});

// ---------------------------------------------------------------------------
// UPDATE COLLABORATOR PERMISSION
// ---------------------------------------------------------------------------

test('outsider cannot update a collaborator permission', async () => {
    const res = await authed(
        request(app)
            .put(`/api/collections/${collectionId}/collaborators/${invitee.id}`)
            .send({ permission: 'edit' }),
        outsider,
    );

    expect(res.status).toBe(403);

    const rows = await sql`
        SELECT permission FROM collection_collaborators
        WHERE collection_id = ${collectionId} AND user_id = ${invitee.id}
    `;
    expect((rows[0] as { permission: string }).permission).toBe('view');
});

test('edit collaborator cannot update a collaborator permission', async () => {
    const res = await authed(
        request(app)
            .put(`/api/collections/${collectionId}/collaborators/${invitee.id}`)
            .send({ permission: 'edit' }),
        editor,
    );

    expect(res.status).toBe(403);
});

test('owner can update a collaborator permission', async () => {
    const res = await authed(
        request(app)
            .put(`/api/collections/${collectionId}/collaborators/${invitee.id}`)
            .send({ permission: 'edit' }),
        owner,
    );

    expect(res.status).toBe(200);
    expect(res.body.collaborator.permission).toBe('edit');
});

// ---------------------------------------------------------------------------
// REMOVE COLLABORATOR
// ---------------------------------------------------------------------------

test('outsider cannot remove a collaborator', async () => {
    const res = await authed(
        request(app).delete(`/api/collections/${collectionId}/collaborators/${invitee.id}`),
        outsider,
    );

    expect(res.status).toBe(403);
    expect(await collaboratorRowExists(invitee.id)).toBe(true);
});

test('edit collaborator cannot remove another collaborator', async () => {
    const res = await authed(
        request(app).delete(`/api/collections/${collectionId}/collaborators/${invitee.id}`),
        editor,
    );

    expect(res.status).toBe(403);
    expect(await collaboratorRowExists(invitee.id)).toBe(true);
});

test('collaborator can leave a collection (remove themselves)', async () => {
    const res = await authed(
        request(app).delete(`/api/collections/${collectionId}/collaborators/${editor.id}`),
        editor,
    );

    expect(res.status).toBe(204);
    expect(await collaboratorRowExists(editor.id)).toBe(false);
});

test('owner can remove a collaborator', async () => {
    const res = await authed(
        request(app).delete(`/api/collections/${collectionId}/collaborators/${invitee.id}`),
        owner,
    );

    expect(res.status).toBe(204);
    expect(await collaboratorRowExists(invitee.id)).toBe(false);
});

test('view collaborator can leave a collection', async () => {
    const res = await authed(
        request(app).delete(`/api/collections/${collectionId}/collaborators/${viewer.id}`),
        viewer,
    );

    expect(res.status).toBe(204);
    expect(await collaboratorRowExists(viewer.id)).toBe(false);
});

// ---------------------------------------------------------------------------
// NOT FOUND
// ---------------------------------------------------------------------------

test('returns 404 when managing collaborators on a non-existent collection', async () => {
    const missingCollectionId = generateId(21);

    const addRes = await authed(
        request(app)
            .post(`/api/collections/${missingCollectionId}/collaborators`)
            .send({ email: invitee2.email, permission: 'edit' }),
        owner,
    );
    expect(addRes.status).toBe(404);

    const updateRes = await authed(
        request(app)
            .put(`/api/collections/${missingCollectionId}/collaborators/${invitee2.id}`)
            .send({ permission: 'edit' }),
        owner,
    );
    expect(updateRes.status).toBe(404);

    const removeRes = await authed(
        request(app).delete(`/api/collections/${missingCollectionId}/collaborators/${invitee2.id}`),
        owner,
    );
    expect(removeRes.status).toBe(404);
});
