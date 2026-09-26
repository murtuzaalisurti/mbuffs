import { afterAll, beforeAll, expect, test } from 'vitest';
import request from 'supertest';
import { createEmailVerificationToken } from 'better-auth/api';
import app from '../api/index.js';
import { auth } from '../lib/auth.js';
import { sql } from '../lib/db.js';

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:8080';
const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

// Email/password user
const email = `pw_user_${suffix}@example.com`;
const originalPassword = `Orig1nal-pass-${suffix}`;
let userId: string;

// Google-only user (no password yet)
const googleUser = {
    id: `pw_google_${suffix}`,
    email: `pw_google_${suffix}@example.com`,
    name: 'Google Only',
};

const resetRedirect = `${frontendOrigin}/reset-password`;

// Unverified email/password user for the send-verification-email checks
const unverifiedEmail = `pw_unverified_${suffix}@example.com`;
let unverifiedUserId: string;
let unverifiedCookie: string;

const signIn = (userEmail: string, password: string) =>
    auth.api.signInEmail({ body: { email: userEmail, password } });

const sessionCookieFrom = (headers: Headers) =>
    headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');

const sessionCount = async (id: string): Promise<number> => {
    const rows = await sql`SELECT COUNT(*)::int AS count FROM session WHERE user_id = ${id}`;
    return rows[0].count as number;
};

// The token is stored before the email is sent, so read it back instead of
// intercepting the email.
const latestResetToken = async (id: string): Promise<string> => {
    const rows = await sql`
        SELECT identifier FROM verification
        WHERE value = ${id} AND identifier LIKE 'reset-password:%'
        ORDER BY created_at DESC
        LIMIT 1
    `;
    expect(rows.length).toBe(1);
    return String(rows[0].identifier).slice('reset-password:'.length);
};

beforeAll(async () => {
    const { user } = await auth.api.signUpEmail({
        body: { email, password: originalPassword, name: 'Password User' },
    });
    userId = user.id;

    const unverified = await auth.api.signUpEmail({
        body: { email: unverifiedEmail, password: `Unver1fied-pass-${suffix}`, name: 'Unverified User' },
        returnHeaders: true,
    });
    unverifiedUserId = unverified.response.user.id;
    unverifiedCookie = sessionCookieFrom(unverified.headers);

    await sql`
        INSERT INTO "user" (id, name, email, email_verified, role)
        VALUES (${googleUser.id}, ${googleUser.name}, ${googleUser.email}, true, 'user')
    `;
    await sql`
        INSERT INTO account (id, user_id, account_id, provider_id)
        VALUES (${`pw_google_acct_${suffix}`}, ${googleUser.id}, ${`google-sub-${suffix}`}, 'google')
    `;
});

afterAll(async () => {
    await sql`DELETE FROM verification WHERE value IN (${userId}, ${googleUser.id})`;
    // sessions and accounts cascade on user delete
    await sql`DELETE FROM "user" WHERE id IN (${userId}, ${googleUser.id}, ${unverifiedUserId})`;
});

// ---------------------------------------------------------------------------
// FORGOT / RESET PASSWORD
// ---------------------------------------------------------------------------

test('reset request for an unknown email looks the same as for a real one', async () => {
    const result = await auth.api.requestPasswordReset({
        body: { email: `nobody_${suffix}@example.com`, redirectTo: resetRedirect },
    });
    expect(result.status).toBe(true);
});

test('the emailed link redirects to the frontend with the token, or INVALID_TOKEN', async () => {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: resetRedirect } });
    const token = await latestResetToken(userId);

    const valid = await request(app)
        .get(`/api/auth/reset-password/${token}`)
        .query({ callbackURL: resetRedirect });
    expect(valid.status).toBe(302);
    expect(valid.headers.location).toBe(`${resetRedirect}?token=${token}`);

    const invalid = await request(app)
        .get('/api/auth/reset-password/not-a-real-token')
        .query({ callbackURL: resetRedirect });
    expect(invalid.status).toBe(302);
    expect(invalid.headers.location).toBe(`${resetRedirect}?error=INVALID_TOKEN`);
});

test('resetting sets the new password, signs out every device, and burns the token', async () => {
    await signIn(email, originalPassword);
    expect(await sessionCount(userId)).toBeGreaterThan(0);

    await auth.api.requestPasswordReset({ body: { email, redirectTo: resetRedirect } });
    const token = await latestResetToken(userId);
    const newPassword = `N3w-pass-${suffix}`;

    const result = await auth.api.resetPassword({ body: { newPassword, token } });
    expect(result.status).toBe(true);
    expect(await sessionCount(userId)).toBe(0);

    await expect(signIn(email, originalPassword)).rejects.toThrow();
    const signedIn = await signIn(email, newPassword);
    expect(signedIn.user.id).toBe(userId);

    // Single use
    await expect(
        auth.api.resetPassword({ body: { newPassword: `An0ther-pass-${suffix}`, token } }),
    ).rejects.toMatchObject({ body: { code: 'INVALID_TOKEN' } });
});

test('a Google-only user can add a password through a reset link', async () => {
    await auth.api.requestPasswordReset({ body: { email: googleUser.email, redirectTo: resetRedirect } });
    const token = await latestResetToken(googleUser.id);
    const password = `G00gle-pass-${suffix}`;

    await auth.api.resetPassword({ body: { newPassword: password, token } });

    const providers = await sql`SELECT provider_id FROM account WHERE user_id = ${googleUser.id} ORDER BY provider_id`;
    expect(providers.map((row) => row.provider_id)).toEqual(['credential', 'google']);

    const signedIn = await signIn(googleUser.email, password);
    expect(signedIn.user.id).toBe(googleUser.id);
});

// ---------------------------------------------------------------------------
// CHANGE PASSWORD
// ---------------------------------------------------------------------------

test('change password needs the current password and can sign out other devices', async () => {
    const currentPassword = `Ch4nge-pass-${suffix}`;
    await auth.api.requestPasswordReset({ body: { email, redirectTo: resetRedirect } });
    await auth.api.resetPassword({ body: { newPassword: currentPassword, token: await latestResetToken(userId) } });

    await signIn(email, currentPassword); // another device
    const { headers } = await auth.api.signInEmail({
        body: { email, password: currentPassword },
        returnHeaders: true,
    });
    const cookie = sessionCookieFrom(headers);
    expect(await sessionCount(userId)).toBe(2);

    await expect(
        auth.api.changePassword({
            body: { currentPassword: 'wrong-password', newPassword: `Wh4tever-${suffix}` },
            headers: new Headers({ cookie }),
        }),
    ).rejects.toMatchObject({ body: { code: 'INVALID_PASSWORD' } });

    const changedPassword = `Ch4nged-pass-${suffix}`;
    await auth.api.changePassword({
        body: { currentPassword, newPassword: changedPassword, revokeOtherSessions: true },
        headers: new Headers({ cookie }),
    });

    // Only the fresh session issued to the device that made the change remains
    expect(await sessionCount(userId)).toBe(1);
    const signedIn = await signIn(email, changedPassword);
    expect(signedIn.user.id).toBe(userId);
});

// ---------------------------------------------------------------------------
// EMAIL VERIFICATION
// ---------------------------------------------------------------------------

test('signed-out callers cannot request verification emails (inbox/quota abuse regression)', async () => {
    const res = await request(app)
        .post('/api/auth/send-verification-email')
        .set('Origin', frontendOrigin)
        .send({ email: unverifiedEmail });
    expect(res.status).toBe(401);
});

test('a signed-in user can request a verification email only for their own address', async () => {
    const own = await request(app)
        .post('/api/auth/send-verification-email')
        .set('Origin', frontendOrigin)
        .set('Cookie', unverifiedCookie)
        .send({ email: unverifiedEmail, callbackURL: `${frontendOrigin}/profile?verified=1` });
    expect(own.status).toBe(200);

    const someoneElse = await request(app)
        .post('/api/auth/send-verification-email')
        .set('Origin', frontendOrigin)
        .set('Cookie', unverifiedCookie)
        .send({ email: googleUser.email });
    expect(someoneElse.status).toBe(400);
    expect(someoneElse.body.code).toBe('EMAIL_MISMATCH');
});

test('email/password sign-ups start unverified', async () => {
    const rows = await sql`SELECT email_verified FROM "user" WHERE id = ${userId}`;
    expect(rows[0].email_verified).toBe(false);
});

test('the verification link marks the email verified and redirects to the frontend', async () => {
    const token = await createEmailVerificationToken(process.env.BETTER_AUTH_SECRET!, email);
    const callbackURL = `${frontendOrigin}/profile?verified=1`;

    const res = await request(app).get('/api/auth/verify-email').query({ token, callbackURL });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(callbackURL);

    const rows = await sql`SELECT email_verified FROM "user" WHERE id = ${userId}`;
    expect(rows[0].email_verified).toBe(true);
});

test('an invalid verification link redirects back with an error', async () => {
    const callbackURL = `${frontendOrigin}/profile?verified=1`;
    const res = await request(app).get('/api/auth/verify-email').query({ token: 'garbage', callbackURL });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${callbackURL}&error=INVALID_TOKEN`);
});
