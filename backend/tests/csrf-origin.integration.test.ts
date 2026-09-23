import { afterAll, beforeAll, expect, test } from 'vitest';
import request from 'supertest';
import app from '../api/index.js';
import { sql } from '../lib/db.js';

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:8080';
const foreignOrigin = 'https://evil.example';
const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const user = {
    id: `csrf_user_${suffix}`,
    email: `csrf_user_${suffix}@example.com`,
    name: 'CSRF User',
    role: 'user',
};

// Collections created by tests, cleaned up afterwards.
const createdCollectionIds: string[] = [];

const withAuth = (req: request.Test) => {
    req.set('x-test-user-id', user.id);
    req.set('x-test-user-role', user.role);
    return req;
};

beforeAll(async () => {
    await sql`
        INSERT INTO "user" (id, name, email, email_verified, role)
        VALUES (${user.id}, ${user.name}, ${user.email}, true, ${user.role})
    `;
});

afterAll(async () => {
    if (createdCollectionIds.length > 0) {
        await sql`DELETE FROM collection_movies WHERE collection_id = ANY(${createdCollectionIds}::text[])`;
        await sql`DELETE FROM collection_collaborators WHERE collection_id = ANY(${createdCollectionIds}::text[])`;
        await sql`DELETE FROM collections WHERE id = ANY(${createdCollectionIds}::text[])`;
    }
    await sql`DELETE FROM "user" WHERE id = ${user.id}`;
});

// ---------------------------------------------------------------------------
// BLOCKED: foreign / missing origin
// ---------------------------------------------------------------------------

test('rejects a mutating request from a foreign origin', async () => {
    const res = await withAuth(request(app).post('/api/collections').send({ name: 'Blocked' }))
        .set('Origin', foreignOrigin);

    expect(res.status).toBe(403);
});

test('rejects a mutating request with no Origin or Referer', async () => {
    const res = await withAuth(request(app).post('/api/collections').send({ name: 'Blocked' }));

    expect(res.status).toBe(403);
});

test('rejects a foreign-origin bodyless toggle (classic CSRF target)', async () => {
    const res = await withAuth(request(app).post('/api/collections/watched/550/toggle'))
        .set('Origin', foreignOrigin);

    expect(res.status).toBe(403);
});

test('rejects a foreign-origin PUT to user preferences', async () => {
    const res = await withAuth(request(app).put('/api/user/preferences').send({ show_adult_items: true }))
        .set('Origin', foreignOrigin);

    expect(res.status).toBe(403);
});

test('rejects a foreign-origin POST to recommendation cache warming', async () => {
    const res = await withAuth(request(app).post('/api/recommendations/warm'))
        .set('Origin', foreignOrigin);

    expect(res.status).toBe(403);
});

// ---------------------------------------------------------------------------
// ALLOWED: trusted origin / referer
// ---------------------------------------------------------------------------

test('allows a mutating request from the trusted origin', async () => {
    const res = await withAuth(request(app).post('/api/collections').send({ name: 'CSRF Trusted Origin' }))
        .set('Origin', frontendOrigin);

    expect(res.status).toBe(201);
    createdCollectionIds.push(res.body.collection.id);
});

test('allows a mutating request with only a trusted Referer', async () => {
    const res = await withAuth(request(app).post('/api/collections').send({ name: 'CSRF Trusted Referer' }))
        .set('Referer', `${frontendOrigin}/collections`);

    expect(res.status).toBe(201);
    createdCollectionIds.push(res.body.collection.id);
});

test('rejects a foreign-origin DELETE even when authenticated', async () => {
    const collectionId = createdCollectionIds[0];

    const res = await withAuth(request(app).delete(`/api/collections/${collectionId}`))
        .set('Origin', foreignOrigin);

    expect(res.status).toBe(403);

    // Collection must still exist.
    const rows = await sql`SELECT 1 FROM collections WHERE id = ${collectionId}`;
    expect(rows.length).toBe(1);
});

// ---------------------------------------------------------------------------
// NOT AFFECTED: safe methods and the public content proxy
// ---------------------------------------------------------------------------

test('does not block safe GET requests without an Origin', async () => {
    const res = await withAuth(request(app).get('/api/collections'));

    expect(res.status).toBe(200);
});

test('exempts the public content proxy so server-to-server callers still work', async () => {
    // The Vercel OG functions POST here with no Origin header. Even if the
    // upstream TMDB call fails, the request must not be rejected as CSRF.
    const res = await request(app)
        .post('/api/content')
        .send({ endpoint: '/movie/550' });

    expect(res.status).not.toBe(403);
});
