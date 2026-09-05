import { afterAll, beforeAll, expect, test } from 'vitest';
import request from 'supertest';
import app from '../api/index.js';
import { sql } from '../lib/db.js';

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:8080';
const suffix = Date.now();

const ownerUser = {
    id: `test_owner_${suffix}`,
    email: `owner_${suffix}@example.com`,
    name: 'Test Owner',
    role: 'user',
};

const otherUser = {
    id: `test_other_${suffix}`,
    email: `other_${suffix}@example.com`,
    name: 'Test Other',
    role: 'user',
};

const adminUser = {
    id: `test_admin_${suffix}`,
    email: `admin_${suffix}@example.com`,
    name: 'Test Admin',
    role: 'admin',
};

const mediaType = 'movie';
const tmdbId = 990000 + Math.floor(Math.random() * 1000);

// TV shows used for season-scoped tests
const tvTmdbId = 790000 + Math.floor(Math.random() * 1000);
const legacyTvTmdbId = 780000 + Math.floor(Math.random() * 1000);

const authed = (
    req: request.Test,
    user: { id: string; role: string },
    withOrigin = true
) => {
    req.set('x-test-user-id', user.id);
    req.set('x-test-user-role', user.role);

    if (withOrigin) {
        req.set('Origin', frontendOrigin);
    }

    return req;
};

beforeAll(async () => {
    await sql`
        INSERT INTO "user" (id, name, email, email_verified, role)
        VALUES
            (${ownerUser.id}, ${ownerUser.name}, ${ownerUser.email}, true, ${ownerUser.role}),
            (${otherUser.id}, ${otherUser.name}, ${otherUser.email}, true, ${otherUser.role}),
            (${adminUser.id}, ${adminUser.name}, ${adminUser.email}, true, ${adminUser.role})
    `;
});

afterAll(async () => {
    await sql`DELETE FROM media_ratings WHERE tmdb_id IN (${tvTmdbId}, ${legacyTvTmdbId})`;
    await sql`DELETE FROM media_comments WHERE tmdb_id IN (${tvTmdbId}, ${legacyTvTmdbId})`;
    await sql`DELETE FROM media_ratings WHERE user_id IN (${ownerUser.id}, ${otherUser.id}, ${adminUser.id})`;
    await sql`DELETE FROM media_comments WHERE user_id IN (${ownerUser.id}, ${otherUser.id}, ${adminUser.id})`;
    await sql`DELETE FROM "user" WHERE id IN (${ownerUser.id}, ${otherUser.id}, ${adminUser.id})`;
});

test('blocks unauthenticated comment creation', async () => {
    const response = await request(app)
        .post(`/api/reviews/${mediaType}/${tmdbId}/comments`)
        .set('Origin', frontendOrigin)
        .send({ comment: 'Unauthed request' });

    expect(response.status).toBe(401);
});

test('enforces strict origin protection for writes', async () => {
    const response = await authed(
        request(app).put(`/api/reviews/${mediaType}/${tmdbId}/rating`).send({ rating: 8 }),
        ownerUser,
        false
    );

    expect(response.status).toBe(403);
});

test('validates rating boundaries', async () => {
    const response = await authed(
        request(app).put(`/api/reviews/${mediaType}/${tmdbId}/rating`).send({ rating: 11 }),
        ownerUser
    );

    expect(response.status).toBe(400);
});

test('keeps one rating per user per media via upsert constraint', async () => {
    const first = await authed(
        request(app).put(`/api/reviews/${mediaType}/${tmdbId}/rating`).send({ rating: 6 }),
        ownerUser
    );
    expect(first.status).toBe(200);

    const second = await authed(
        request(app).put(`/api/reviews/${mediaType}/${tmdbId}/rating`).send({ rating: 9 }),
        ownerUser
    );
    expect(second.status).toBe(200);

    const summary = await authed(
        request(app).get(`/api/reviews/${mediaType}/${tmdbId}/summary`),
        ownerUser
    );

    expect(summary.status).toBe(200);
    expect(summary.body.summary.ratingsCount).toBe(1);
    expect(summary.body.userRating).toBe(9);
});

test('allows a user to clear their rating', async () => {
    const response = await authed(
        request(app).delete(`/api/reviews/${mediaType}/${tmdbId}/rating`),
        ownerUser
    );

    expect(response.status).toBe(200);
    expect(response.body.summary.summary.ratingsCount).toBe(0);
    expect(response.body.summary.summary.averageRating).toBeNull();
    expect(response.body.summary.userRating).toBeNull();
});

test('supports replies and likes on review comments', async () => {
    const rootCommentResponse = await authed(
        request(app)
            .post(`/api/reviews/${mediaType}/${tmdbId}/comments`)
            .send({ comment: `Root comment ${Date.now()}` }),
        ownerUser
    );

    expect(rootCommentResponse.status).toBe(201);
    const rootCommentId = rootCommentResponse.body.comment.id as string;

    const replyResponse = await authed(
        request(app)
            .post(`/api/reviews/comments/${rootCommentId}/replies`)
            .send({ comment: `Reply comment ${Date.now()}` }),
        otherUser
    );

    expect(replyResponse.status).toBe(201);
    expect(replyResponse.body.comment.parentCommentId).toBe(rootCommentId);
    expect(replyResponse.body.comment.replyToCommentId).toBe(rootCommentId);

    const nestedReplyResponse = await authed(
        request(app)
            .post(`/api/reviews/comments/${replyResponse.body.comment.id}/replies`)
            .send({ comment: `Nested reply ${Date.now()}` }),
        adminUser
    );

    expect(nestedReplyResponse.status).toBe(201);
    expect(nestedReplyResponse.body.comment.parentCommentId).toBe(rootCommentId);
    expect(nestedReplyResponse.body.comment.replyToCommentId).toBe(replyResponse.body.comment.id);

    const likeRoot = await authed(
        request(app).put(`/api/reviews/comments/${rootCommentId}/likes`),
        ownerUser
    );

    expect(likeRoot.status).toBe(200);
    expect(likeRoot.body.likesCount).toBe(1);
    expect(likeRoot.body.likedByViewer).toBe(true);

    const likeReply = await authed(
        request(app).put(`/api/reviews/comments/${replyResponse.body.comment.id}/likes`),
        ownerUser
    );

    expect(likeReply.status).toBe(200);
    expect(likeReply.body.likesCount).toBe(1);

    const commentsList = await authed(
        request(app).get(`/api/reviews/${mediaType}/${tmdbId}/comments?limit=20`),
        ownerUser
    );

    expect(commentsList.status).toBe(200);

    const root = commentsList.body.comments.find((comment: { id: string }) => comment.id === rootCommentId);
    expect(root).toBeTruthy();
    expect(root.likesCount).toBe(1);
    expect(root.likedByViewer).toBe(true);
    expect(root.repliesCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(root.replies)).toBe(true);
    expect(root.replies.length).toBeGreaterThanOrEqual(2);

    const reply = root.replies.find((item: { id: string }) => item.id === replyResponse.body.comment.id);
    expect(reply).toBeTruthy();
    expect(reply.likesCount).toBe(1);
    expect(reply.likedByViewer).toBe(true);

    const nestedReply = root.replies.find((item: { id: string }) => item.id === nestedReplyResponse.body.comment.id);
    expect(nestedReply).toBeTruthy();
    expect(nestedReply.replyToCommentId).toBe(replyResponse.body.comment.id);

    const unlikeRoot = await authed(
        request(app).delete(`/api/reviews/comments/${rootCommentId}/likes`),
        ownerUser
    );

    expect(unlikeRoot.status).toBe(200);
    expect(unlikeRoot.body.likesCount).toBe(0);
    expect(unlikeRoot.body.likedByViewer).toBe(false);
});

test('enforces comment ownership and allows admin moderation delete', async () => {
    const createResponse = await authed(
        request(app)
            .post(`/api/reviews/${mediaType}/${tmdbId}/comments`)
            .send({ comment: `Owner comment ${Date.now()}` }),
        ownerUser
    );

    expect(createResponse.status).toBe(201);
    const commentId = createResponse.body.comment.id as string;

    const editByOther = await authed(
        request(app)
            .patch(`/api/reviews/comments/${commentId}`)
            .send({ comment: 'I should not be able to edit this' }),
        otherUser
    );

    expect(editByOther.status).toBe(403);

    const deleteByAdmin = await authed(
        request(app)
            .delete(`/api/reviews/comments/${commentId}`)
            .send({ reason: 'Moderation action' }),
        adminUser
    );

    expect(deleteByAdmin.status).toBe(204);

    const commentsList = await request(app).get(`/api/reviews/${mediaType}/${tmdbId}/comments?limit=20`);
    expect(commentsList.status).toBe(200);
    expect(commentsList.body.comments.some((comment: { id: string }) => comment.id === commentId)).toBe(false);
});

test('rejects seasonNumber for movies', async () => {
    const response = await authed(
        request(app).get(`/api/reviews/${mediaType}/${tmdbId}/summary?seasonNumber=1`),
        ownerUser
    );

    expect(response.status).toBe(400);
});

test('rates TV seasons independently from the overall show rating', async () => {
    const firstSeasonRating = await authed(
        request(app).put(`/api/reviews/tv/${tvTmdbId}/rating?seasonNumber=1`).send({ rating: 8 }),
        ownerUser
    );
    expect(firstSeasonRating.status).toBe(200);

    // Upsert: rating the same season again replaces it
    const updatedSeasonRating = await authed(
        request(app).put(`/api/reviews/tv/${tvTmdbId}/rating?seasonNumber=1`).send({ rating: 9 }),
        ownerUser
    );
    expect(updatedSeasonRating.status).toBe(200);

    const secondSeasonRating = await authed(
        request(app).put(`/api/reviews/tv/${tvTmdbId}/rating?seasonNumber=2`).send({ rating: 7 }),
        otherUser
    );
    expect(secondSeasonRating.status).toBe(200);

    // Overall show rating is stored separately from season ratings
    const overallRating = await authed(
        request(app).put(`/api/reviews/tv/${tvTmdbId}/rating`).send({ rating: 6 }),
        ownerUser
    );
    expect(overallRating.status).toBe(200);

    // Season summary is scoped to the season
    const seasonSummary = await authed(
        request(app).get(`/api/reviews/tv/${tvTmdbId}/summary?seasonNumber=1`),
        ownerUser
    );
    expect(seasonSummary.status).toBe(200);
    expect(seasonSummary.body.summary.averageRating).toBe(9);
    expect(seasonSummary.body.summary.ratingsCount).toBe(1);
    expect(seasonSummary.body.userRating).toBe(9);
    expect(seasonSummary.body.seasons).toBeUndefined();
    expect(seasonSummary.body.summary.seasonsRated).toBeUndefined();
});

test('aggregates season scores and overall ratings into the show-level mbuff score', async () => {
    const summary = await authed(
        request(app).get(`/api/reviews/tv/${tvTmdbId}/summary`),
        ownerUser
    );

    expect(summary.status).toBe(200);
    // Blend of all groups: (season 1: 9 + season 2: 7 + overall: 6) / 3 = 7.3
    expect(summary.body.summary.averageRating).toBe(7.3);
    expect(summary.body.summary.seasonsRated).toBe(2);
    expect(summary.body.summary.overallRatingsCount).toBe(1);
    expect(summary.body.summary.ratingsCount).toBe(3);
    expect(summary.body.userRating).toBe(6);

    const seasons = summary.body.seasons;
    expect(Array.isArray(seasons)).toBe(true);
    expect(seasons).toHaveLength(2);
    expect(seasons[0]).toMatchObject({ seasonNumber: 1, averageRating: 9, ratingsCount: 1 });
    expect(seasons[1]).toMatchObject({ seasonNumber: 2, averageRating: 7, ratingsCount: 1 });
});

test('deletes a season rating without touching the overall rating', async () => {
    const response = await authed(
        request(app).delete(`/api/reviews/tv/${tvTmdbId}/rating?seasonNumber=2`),
        otherUser
    );

    expect(response.status).toBe(200);
    // The delete response is scoped to season 2, so it reports that season's summary
    expect(response.body.summary.summary.averageRating).toBeNull();
    expect(response.body.summary.userRating).toBeNull();

    // Show-level summary: season 1 (9) + overall (6) blend to 7.5
    const overall = await authed(
        request(app).get(`/api/reviews/tv/${tvTmdbId}/summary`),
        ownerUser
    );
    expect(overall.body.summary.averageRating).toBe(7.5);
    expect(overall.body.summary.seasonsRated).toBe(1);
    expect(overall.body.summary.overallRatingsCount).toBe(1);
    expect(overall.body.summary.ratingsCount).toBe(2);
    expect(overall.body.userRating).toBe(6);
});

test('scores shows from overall ratings alone before any season is rated', async () => {
    await authed(
        request(app).put(`/api/reviews/tv/${legacyTvTmdbId}/rating`).send({ rating: 9 }),
        ownerUser
    );
    await authed(
        request(app).put(`/api/reviews/tv/${legacyTvTmdbId}/rating`).send({ rating: 7 }),
        otherUser
    );

    const summary = await authed(
        request(app).get(`/api/reviews/tv/${legacyTvTmdbId}/summary`),
        ownerUser
    );

    expect(summary.status).toBe(200);
    expect(summary.body.summary.averageRating).toBe(8);
    expect(summary.body.summary.ratingsCount).toBe(2);
    expect(summary.body.summary.seasonsRated).toBe(0);
    expect(summary.body.summary.overallRatingsCount).toBe(2);
    expect(summary.body.seasons).toEqual([]);
});

test('scopes comments to seasons and replies inherit the season', async () => {
    const seasonComment = await authed(
        request(app)
            .post(`/api/reviews/tv/${tvTmdbId}/comments?seasonNumber=1`)
            .send({ comment: `Season comment ${Date.now()}` }),
        ownerUser
    );

    expect(seasonComment.status).toBe(201);
    expect(seasonComment.body.comment.seasonNumber).toBe(1);

    const showComment = await authed(
        request(app)
            .post(`/api/reviews/tv/${tvTmdbId}/comments`)
            .send({ comment: `Show comment ${Date.now()}` }),
        ownerUser
    );

    expect(showComment.status).toBe(201);
    expect(showComment.body.comment.seasonNumber).toBeNull();

    const reply = await authed(
        request(app)
            .post(`/api/reviews/comments/${seasonComment.body.comment.id}/replies`)
            .send({ comment: `Season reply ${Date.now()}` }),
        otherUser
    );

    expect(reply.status).toBe(201);
    expect(reply.body.comment.seasonNumber).toBe(1);
    expect(reply.body.comment.parentCommentId).toBe(seasonComment.body.comment.id);

    const seasonComments = await authed(
        request(app).get(`/api/reviews/tv/${tvTmdbId}/comments?seasonNumber=1`),
        ownerUser
    );

    expect(seasonComments.status).toBe(200);
    expect(seasonComments.body.comments.some((comment: { id: string }) => comment.id === seasonComment.body.comment.id)).toBe(true);
    expect(seasonComments.body.comments.some((comment: { id: string }) => comment.id === showComment.body.comment.id)).toBe(false);

    const showComments = await authed(
        request(app).get(`/api/reviews/tv/${tvTmdbId}/comments`),
        ownerUser
    );

    expect(showComments.body.comments.some((comment: { id: string }) => comment.id === showComment.body.comment.id)).toBe(true);
    expect(showComments.body.comments.some((comment: { id: string }) => comment.id === seasonComment.body.comment.id)).toBe(false);
});
