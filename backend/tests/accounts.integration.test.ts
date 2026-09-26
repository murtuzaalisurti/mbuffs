import { afterAll, beforeAll, expect, test } from 'vitest';
import request from 'supertest';
import app from '../api/index.js';
import { auth } from '../lib/auth.js';
import { sql } from '../lib/db.js';
import { generateId } from '../lib/utils.js';

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:8080';
const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

// --- Test users ---
const admin = {
    id: `acct_admin_${suffix}`,
    email: `acct_admin_${suffix}@example.com`,
    name: 'Account Admin',
    role: 'admin',
};

const otherAdmin = {
    id: `acct_other_admin_${suffix}`,
    email: `acct_other_admin_${suffix}@example.com`,
    name: 'Other Admin',
    role: 'admin',
};

const regular = {
    id: `acct_regular_${suffix}`,
    email: `acct_regular_${suffix}@example.com`,
    name: 'Regular User',
    role: 'user',
};

// Owns a collection the leaver collaborates on
const owner = {
    id: `acct_owner_${suffix}`,
    email: `acct_owner_${suffix}@example.com`,
    name: 'Collection Owner',
    role: 'user',
};

// Deletes their own account
const leaver = {
    id: `acct_leaver_${suffix}`,
    email: `acct_leaver_${suffix}@example.com`,
    name: 'Leaving User',
    role: 'user',
};

// Signs up through Better Auth so sign-in can be exercised
const credentialEmail = `acct_credential_${suffix}@example.com`;
const credentialPassword = `Str0ng-pass-${suffix}`;
let credentialUserId: string;

let sharedCollectionId: string;
let leaverCollectionId: string;
const leaverMovieId = '550';

const authed = (req: request.Test, user: { id: string; role: string }) =>
    req.set('x-test-user-id', user.id).set('x-test-user-role', user.role).set('Origin', frontendOrigin);

const userExists = async (userId: string): Promise<boolean> => {
    const rows = await sql`SELECT 1 FROM "user" WHERE id = ${userId}`;
    return rows.length > 0;
};

const signInCredentialUser = () =>
    auth.api.signInEmail({ body: { email: credentialEmail, password: credentialPassword } });

beforeAll(async () => {
    await sql`
        INSERT INTO "user" (id, name, email, email_verified, role)
        VALUES
            (${admin.id}, ${admin.name}, ${admin.email}, true, ${admin.role}),
            (${otherAdmin.id}, ${otherAdmin.name}, ${otherAdmin.email}, true, ${otherAdmin.role}),
            (${regular.id}, ${regular.name}, ${regular.email}, true, ${regular.role}),
            (${owner.id}, ${owner.name}, ${owner.email}, true, ${owner.role}),
            (${leaver.id}, ${leaver.name}, ${leaver.email}, true, ${leaver.role})
    `;

    // `owner`'s collection, where `leaver` is an editor who added a title
    sharedCollectionId = generateId(21);
    await sql`
        INSERT INTO collections (id, name, owner_id, is_public, shareable_id, is_system)
        VALUES (${sharedCollectionId}, 'Shared', ${owner.id}, false, ${generateId(12)}, false)
    `;
    await sql`
        INSERT INTO collection_collaborators (id, collection_id, user_id, permission)
        VALUES (${generateId(21)}, ${sharedCollectionId}, ${leaver.id}, 'edit')
    `;
    await sql`
        INSERT INTO collection_movies (id, collection_id, movie_id, added_by_user_id)
        VALUES (${generateId(21)}, ${sharedCollectionId}, ${leaverMovieId}, ${leaver.id})
    `;

    // `leaver`'s own collection
    leaverCollectionId = generateId(21);
    await sql`
        INSERT INTO collections (id, name, owner_id, is_public, shareable_id, is_system)
        VALUES (${leaverCollectionId}, 'Mine', ${leaver.id}, false, ${generateId(12)}, false)
    `;

    const { user } = await auth.api.signUpEmail({
        body: { email: credentialEmail, password: credentialPassword, name: 'Credential User' },
    });
    credentialUserId = user.id;
});

afterAll(async () => {
    // collections, collaborators, sessions and accounts cascade on user delete
    await sql`
        DELETE FROM "user"
        WHERE id IN (${admin.id}, ${otherAdmin.id}, ${regular.id}, ${owner.id}, ${leaver.id}, ${credentialUserId})
    `;
});

// ---------------------------------------------------------------------------
// ADMIN: SUSPEND / UNSUSPEND
// ---------------------------------------------------------------------------

test('non-admins cannot suspend accounts', async () => {
    const res = await authed(request(app).post(`/api/admin/users/${regular.id}/suspend`).send({}), regular);
    expect(res.status).toBe(403);
});

test('admins cannot suspend themselves or other admins', async () => {
    const self = await authed(request(app).post(`/api/admin/users/${admin.id}/suspend`).send({}), admin);
    expect(self.status).toBe(400);

    const other = await authed(request(app).post(`/api/admin/users/${otherAdmin.id}/suspend`).send({}), admin);
    expect(other.status).toBe(403);
});

test('suspending an unknown user returns 404', async () => {
    const res = await authed(request(app).post(`/api/admin/users/missing_${suffix}/suspend`).send({}), admin);
    expect(res.status).toBe(404);
});

test('suspending revokes sessions and blocks sign-in until unsuspended', async () => {
    // A live session to be revoked
    await signInCredentialUser();
    const before = await sql`SELECT COUNT(*)::int AS count FROM session WHERE user_id = ${credentialUserId}`;
    expect(before[0].count).toBeGreaterThan(0);

    const suspend = await authed(
        request(app).post(`/api/admin/users/${credentialUserId}/suspend`).send({ reason: '  Spam  ' }),
        admin,
    );
    expect(suspend.status).toBe(200);
    expect(suspend.body.suspensionReason).toBe('Spam');
    expect(suspend.body.suspendedAt).toBeTruthy();

    const after = await sql`SELECT COUNT(*)::int AS count FROM session WHERE user_id = ${credentialUserId}`;
    expect(after[0].count).toBe(0);

    await expect(signInCredentialUser()).rejects.toMatchObject({ body: { code: 'ACCOUNT_SUSPENDED' } });

    const list = await authed(request(app).get('/api/admin/users'), admin);
    const listed = list.body.users.find((u: { id: string }) => u.id === credentialUserId);
    expect(listed.suspendedAt).toBeTruthy();
    expect(listed.suspensionReason).toBe('Spam');

    const unsuspend = await authed(request(app).post(`/api/admin/users/${credentialUserId}/unsuspend`), admin);
    expect(unsuspend.status).toBe(200);

    const signedIn = await signInCredentialUser();
    expect(signedIn.user.id).toBe(credentialUserId);
});

test('rejects a non-string suspension reason', async () => {
    const res = await authed(
        request(app).post(`/api/admin/users/${regular.id}/suspend`).send({ reason: 42 }),
        admin,
    );
    expect(res.status).toBe(400);
});

// ---------------------------------------------------------------------------
// SELF-SERVICE ACCOUNT DELETION
// ---------------------------------------------------------------------------

test('account deletion requires the matching email', async () => {
    const missing = await authed(request(app).delete('/api/user/account').send({}), leaver);
    expect(missing.status).toBe(400);

    const wrong = await authed(request(app).delete('/api/user/account').send({ confirmEmail: owner.email }), leaver);
    expect(wrong.status).toBe(400);
    expect(await userExists(leaver.id)).toBe(true);
});

test('account deletion requires authentication', async () => {
    const res = await request(app)
        .delete('/api/user/account')
        .set('Origin', frontendOrigin)
        .send({ confirmEmail: leaver.email });
    expect(res.status).toBe(401);
});

test('a user can delete their own account; items they added elsewhere are kept', async () => {
    const res = await authed(
        request(app).delete('/api/user/account').send({ confirmEmail: leaver.email.toUpperCase() }),
        leaver,
    );
    expect(res.status).toBe(204);

    expect(await userExists(leaver.id)).toBe(false);

    const ownCollection = await sql`SELECT 1 FROM collections WHERE id = ${leaverCollectionId}`;
    expect(ownCollection.length).toBe(0);

    const membership = await sql`SELECT 1 FROM collection_collaborators WHERE user_id = ${leaver.id}`;
    expect(membership.length).toBe(0);

    const kept = await sql`
        SELECT added_by_user_id FROM collection_movies
        WHERE collection_id = ${sharedCollectionId} AND movie_id = ${leaverMovieId}
    `;
    expect(kept.length).toBe(1);
    expect(kept[0].added_by_user_id).toBeNull();

    // The collection page still lists a title whose author is gone
    const details = await authed(request(app).get(`/api/collections/${sharedCollectionId}`), owner);
    expect(details.status).toBe(200);
    const entry = details.body.movies.find((m: { movie_id: string }) => String(m.movie_id) === leaverMovieId);
    expect(entry).toBeDefined();
    expect(entry.added_by_user_id).toBeNull();
});

// ---------------------------------------------------------------------------
// ADMIN: DELETE
// ---------------------------------------------------------------------------

test('admins cannot delete other admins', async () => {
    const res = await authed(request(app).delete(`/api/admin/users/${otherAdmin.id}`), admin);
    expect(res.status).toBe(403);
    expect(await userExists(otherAdmin.id)).toBe(true);
});

test('admins can delete a user account', async () => {
    const res = await authed(request(app).delete(`/api/admin/users/${regular.id}`), admin);
    expect(res.status).toBe(204);
    expect(await userExists(regular.id)).toBe(false);
});
