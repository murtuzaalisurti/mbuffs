import { afterAll, beforeAll, expect, test } from 'vitest';
import request from 'supertest';
import app from '../api/index.js';
import { sql } from '../lib/db.js';
import { generateId } from '../lib/utils.js';

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:8080';
const suffix = Date.now();

const statsUser = {
    id: `test_stats_${suffix}`,
    email: `stats_${suffix}@example.com`,
    name: 'Test Stats',
    role: 'user',
};

// Fake TMDB ids with metadata seeded up front, so the endpoint never calls TMDB
const base = 970000 + Math.floor(Math.random() * 1000) * 10;
const movieA = base + 1;
const movieB = base + 2;
const showA = base + 3;
const watchedCollectionId = generateId(21);

const authed = (req: request.Test) => {
    req.set('x-test-user-id', statsUser.id);
    req.set('x-test-user-role', statsUser.role);
    req.set('Origin', frontendOrigin);
    return req;
};

const seedMetadata = async (
    mediaType: 'movie' | 'tv',
    tmdbId: number,
    values: { title: string; releaseYear: number; runtime: number | null; genres: Array<{ id: number; name: string }>; director: string; language: string; voteCount: number }
) => {
    await sql`
        INSERT INTO media_metadata (
            media_type, tmdb_id, title, poster_path, release_year, runtime_minutes,
            genres, directors, top_cast, original_language, origin_countries, vote_count
        )
        VALUES (
            ${mediaType}, ${tmdbId}, ${values.title}, null, ${values.releaseYear}, ${values.runtime},
            ${JSON.stringify(values.genres)}::jsonb,
            ${JSON.stringify([{ id: 1, name: values.director, profilePath: null }])}::jsonb,
            ${JSON.stringify([{ id: 2, name: 'Shared Actor', profilePath: null }])}::jsonb,
            ${values.language}, '[]'::jsonb, ${values.voteCount}
        )
        ON CONFLICT (media_type, tmdb_id) DO NOTHING
    `;
};

beforeAll(async () => {
    await sql`
        INSERT INTO "user" (id, name, email, email_verified, role)
        VALUES (${statsUser.id}, ${statsUser.name}, ${statsUser.email}, true, ${statsUser.role})
    `;

    await seedMetadata('movie', movieA, { title: 'Movie A', releaseYear: 1994, runtime: 120, genres: [{ id: 18, name: 'Drama' }], director: 'Director One', language: 'en', voteCount: 25000 });
    await seedMetadata('movie', movieB, { title: 'Movie B', releaseYear: 2021, runtime: 95, genres: [{ id: 18, name: 'Drama' }, { id: 35, name: 'Comedy' }], director: 'Director One', language: 'ko', voteCount: 400 });
    await seedMetadata('tv', showA, { title: 'Show A', releaseYear: 2019, runtime: 45, genres: [{ id: 18, name: 'Drama' }], director: 'Creator', language: 'en', voteCount: 150 });

    await sql`
        INSERT INTO collections (id, name, description, owner_id, is_system)
        VALUES (${watchedCollectionId}, '__watched__', 'System collection for watched items', ${statsUser.id}, true)
    `;
    // movieB is watched just after midnight on Jan 1 in UTC+5:30, which is still Dec 31 in UTC
    await sql`
        INSERT INTO collection_movies (id, collection_id, movie_id, added_by_user_id, added_at)
        VALUES
            (${generateId(21)}, ${watchedCollectionId}, ${String(movieA)}, ${statsUser.id}, '2025-03-10T12:00:00Z'),
            (${generateId(21)}, ${watchedCollectionId}, ${String(movieB)}, ${statsUser.id}, '2025-12-31T19:00:00Z'),
            (${generateId(21)}, ${watchedCollectionId}, ${`${showA}tv`}, ${statsUser.id}, '2025-06-01T12:00:00Z')
    `;

    await sql`
        INSERT INTO media_ratings (id, user_id, media_type, tmdb_id, season_number, rating)
        VALUES
            (${generateId(21)}, ${statsUser.id}, 'movie', ${movieA}, null, 9),
            (${generateId(21)}, ${statsUser.id}, 'tv', ${showA}, 1, 6),
            (${generateId(21)}, ${statsUser.id}, 'tv', ${showA}, 2, 8)
    `;
});

afterAll(async () => {
    await sql`DELETE FROM media_ratings WHERE user_id = ${statsUser.id}`;
    await sql`DELETE FROM media_metadata WHERE tmdb_id IN (${movieA}, ${movieB}, ${showA})`;
    await sql`DELETE FROM collections WHERE owner_id = ${statsUser.id}`;
    await sql`DELETE FROM "user" WHERE id = ${statsUser.id}`;
});

test('requires authentication', async () => {
    const response = await request(app).get('/api/user/stats').set('Origin', frontendOrigin);
    expect(response.status).toBe(401);
});

test('rejects an invalid year or time zone', async () => {
    const badYear = await authed(request(app).get('/api/user/stats?year=abc'));
    expect(badYear.status).toBe(400);

    const badZone = await authed(request(app).get('/api/user/stats?tz=Not/AZone'));
    expect(badZone.status).toBe(400);
});

test('returns all-time stats from watched items, metadata and ratings', async () => {
    const response = await authed(request(app).get('/api/user/stats?tz=UTC'));

    expect(response.status).toBe(200);
    const stats = response.body;
    expect(stats.year).toBeNull();
    expect(stats.availableYears).toEqual([2025]);
    expect(stats.metadataPending).toBe(0);
    expect(stats.totals).toMatchObject({
        titles: 3,
        movies: 2,
        shows: 1,
        movieMinutes: 215,
        moviesWithRuntime: 2,
        ratedTitles: 2,
        // movieA = 9, showA = season average 7
        averageRating: 8,
    });
    expect(stats.languageCount).toBe(2);
    expect(stats.topGenres[0]).toMatchObject({ id: 18, name: 'Drama', count: 3 });
    expect(stats.topDirectors[0]).toMatchObject({ name: 'Director One', count: 2 });
    expect(stats.topActors[0]).toMatchObject({ name: 'Shared Actor', count: 3 });
    expect(stats.decades).toEqual([
        { decade: 1990, count: 1 },
        { decade: 2010, count: 1 },
        { decade: 2020, count: 1 },
    ]);
    expect(stats.topRated.map((item: { tmdbId: number }) => item.tmdbId)).toEqual([movieA, showA]);
    // movieB (400 < 1000 movie votes) and showA (150 < 300 TV votes) are under the radar
    expect(stats.niche).toMatchObject({ underTheRadarPercent: 67, titlesWithVotes: 3 });
    expect(stats.niche.deepestCut).toMatchObject({ tmdbId: showA, voteCount: 150 });
    // One title per decade: the tie goes to the most recent decade
    expect(stats.timeMachine).toMatchObject({ era: { decade: 2020, percent: 33 }, newestYear: 2021 });
    expect(stats.timeMachine.oldest).toMatchObject({ tmdbId: movieA, releaseYear: 1994 });
});

test('buckets the year and months in the requested time zone', async () => {
    const utc = await authed(request(app).get('/api/user/stats?year=2025&tz=UTC'));
    expect(utc.status).toBe(200);
    expect(utc.body.totals.titles).toBe(3);
    expect(utc.body.timeline).toHaveLength(12);
    expect(utc.body.timeline[11]).toEqual({ period: '2025-12', movies: 1, shows: 0 });

    const india = await authed(request(app).get('/api/user/stats?year=2025&tz=Asia/Kolkata'));
    expect(india.status).toBe(200);
    expect(india.body.availableYears).toEqual([2026, 2025]);
    expect(india.body.totals.titles).toBe(2);
    expect(india.body.timeline[11]).toEqual({ period: '2025-12', movies: 0, shows: 0 });
});
