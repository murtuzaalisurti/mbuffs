import { afterAll, beforeAll, expect, test } from 'vitest';
import request from 'supertest';
import app from '../api/index.js';
import { sql } from '../lib/db.js';
import { generateId } from '../lib/utils.js';

// Covers the on/off flow and caching without calling Groq: a stored profile whose
// fingerprint matches is served as-is, and too few comments and ratings never reach the provider.

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:8080';
const suffix = Date.now();

const tasteUser = {
    id: `test_taste_${suffix}`,
    email: `taste_${suffix}@example.com`,
    name: 'Test Taste',
    role: 'user',
};

const tmdbId = 960000 + Math.floor(Math.random() * 1000);

const authed = (req: request.Test) => {
    req.set('x-test-user-id', tasteUser.id);
    req.set('x-test-user-role', tasteUser.role);
    req.set('Origin', frontendOrigin);
    return req;
};

const addComments = async (count: number) => {
    for (let i = 0; i < count; i++) {
        await sql`
            INSERT INTO media_comments (id, user_id, media_type, tmdb_id, comment)
            VALUES (${generateId(21)}, ${tasteUser.id}, 'movie', ${tmdbId}, ${`Comment ${i} about pacing and tone`})
        `;
    }
};

beforeAll(async () => {
    await sql`
        INSERT INTO "user" (id, name, email, email_verified, role)
        VALUES (${tasteUser.id}, ${tasteUser.name}, ${tasteUser.email}, true, ${tasteUser.role})
    `;
});

afterAll(async () => {
    await sql`DELETE FROM media_comments WHERE user_id = ${tasteUser.id}`;
    await sql`DELETE FROM media_ratings WHERE user_id = ${tasteUser.id}`;
    await sql`DELETE FROM "user" WHERE id = ${tasteUser.id}`;
});

test('requires authentication', async () => {
    const response = await request(app).get('/api/user/stats/taste').set('Origin', frontendOrigin);
    expect(response.status).toBe(401);
});

test('is on by default', async () => {
    const response = await authed(request(app).get('/api/user/stats/taste?tz=UTC'));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ enabled: true, status: 'not_enough', commentCount: 0, ratingCount: 0 });
});

test('rejects a malformed on/off body', async () => {
    const response = await authed(request(app).put('/api/user/stats/taste').send({ enabled: 'yes' }));
    expect(response.status).toBe(400);
});

test('asks for more comments or ratings below the minimum', async () => {
    await addComments(2);
    const response = await authed(request(app).get('/api/user/stats/taste?tz=UTC'));
    expect(response.body).toMatchObject({ enabled: true, status: 'not_enough', commentCount: 2, ratingCount: 0, minSignals: 5 });
});

test('counts ratings toward the minimum', async () => {
    await sql`
        INSERT INTO media_ratings (id, user_id, media_type, tmdb_id, season_number, rating)
        VALUES (${generateId(21)}, ${tasteUser.id}, 'movie', ${tmdbId}, null, 9)
    `;
    const response = await authed(request(app).get('/api/user/stats/taste?tz=UTC'));
    expect(response.body).toMatchObject({ status: 'not_enough', commentCount: 2, ratingCount: 1 });
});

test('falls back to the stored profile when it cannot write a new one', async () => {
    await addComments(4);
    // A stale fingerprint forces a rewrite; with no GROQ_API_KEY in tests that fails,
    // so the last stored profile is served instead
    await sql`
        INSERT INTO user_taste_profiles (user_id, period, summary, comment_count, fingerprint, model)
        VALUES (${tasteUser.id}, 'all', 'You like quiet films.', 5, 'stale', 'test-model')
    `;
    const previousKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
        const response = await authed(request(app).get('/api/user/stats/taste?tz=UTC'));
        expect(response.body).toMatchObject({ status: 'ready', summary: 'You like quiet films.', commentCount: 6, ratingCount: 1 });
    } finally {
        if (previousKey !== undefined) process.env.GROQ_API_KEY = previousKey;
    }
});

test('opting out deletes stored profiles', async () => {
    const response = await authed(request(app).put('/api/user/stats/taste').send({ enabled: false }));
    expect(response.status).toBe(200);

    const rows = await sql`SELECT 1 FROM user_taste_profiles WHERE user_id = ${tasteUser.id}`;
    expect(rows).toHaveLength(0);
    const after = await authed(request(app).get('/api/user/stats/taste?tz=UTC'));
    expect(after.body.status).toBe('disabled');
});
