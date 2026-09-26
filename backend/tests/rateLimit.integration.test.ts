import { afterAll, expect, test } from 'vitest';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../db/schema.js';
import { ipAddressOptions, rateLimitOptions } from '../lib/auth.js';
import { sql } from '../lib/db.js';

// Rate limiting only runs in production, so build Better Auth instances with
// the app's rate-limit settings forced on. Requests alternate between two
// instances, but in-memory counters are shared within one process too, so the
// check that proves instances on different servers share the budget is the
// rate_limit row: the count lives in Postgres, not in any one process.
const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:5001';
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:8080';

const createInstance = () =>
    betterAuth({
        database: drizzleAdapter(drizzle(neon(process.env.DATABASE_URL!)), {
            provider: 'pg',
            schema: {
                user: schema.user,
                session: schema.session,
                account: schema.account,
                verification: schema.verification,
                rateLimit: schema.rateLimit,
            },
        }),
        baseURL,
        secret: process.env.BETTER_AUTH_SECRET,
        trustedOrigins: [frontendOrigin],
        emailAndPassword: {
            enabled: true,
            sendResetPassword: async () => {},
        },
        rateLimit: { ...rateLimitOptions, enabled: true },
        advanced: { ipAddress: ipAddressOptions },
    });

const instanceA = createInstance();
const instanceB = createInstance();

// TEST-NET-2 addresses (never routed), randomised per run
const octet = () => Math.floor(Math.random() * 250) + 1;
const ipPrefix = `198.51.${octet()}.`;
const clientIp = `${ipPrefix}${octet()}`;
const otherIp = `${ipPrefix}${(Number(clientIp.split('.')[3]) % 250) + 1}`;

const requestReset = (instance: ReturnType<typeof createInstance>, headers: Record<string, string>) =>
    instance.handler(new Request(`${baseURL}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: frontendOrigin, ...headers },
        body: JSON.stringify({ email: `nobody_${clientIp}@example.com` }),
    }));

afterAll(async () => {
    await sql`DELETE FROM rate_limit WHERE key LIKE ${`${ipPrefix}%`}`;
});

test('the limit is shared across instances and is per client IP', async () => {
    const statuses = [
        (await requestReset(instanceA, { 'x-vercel-forwarded-for': clientIp })).status,
        (await requestReset(instanceB, { 'x-vercel-forwarded-for': clientIp })).status,
        (await requestReset(instanceA, { 'x-vercel-forwarded-for': clientIp })).status,
    ];
    expect(statuses).toEqual([200, 200, 200]);

    // 4th within the minute is refused, whichever instance handles it
    const blocked = await requestReset(instanceB, { 'x-vercel-forwarded-for': clientIp });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('x-retry-after'))).toBeGreaterThan(0);

    // A different client is unaffected
    const other = await requestReset(instanceA, { 'x-vercel-forwarded-for': otherIp });
    expect(other.status).toBe(200);

    const rows = await sql`SELECT count FROM rate_limit WHERE key = ${`${clientIp}|/request-password-reset`}`;
    expect(rows.length).toBe(1);
    expect(rows[0].count).toBe(3);
});

test('x-vercel-forwarded-for wins over x-forwarded-for', async () => {
    // clientIp is already exhausted above; a different x-forwarded-for doesn't
    // get around it because the Vercel header is read first
    const res = await requestReset(instanceA, {
        'x-vercel-forwarded-for': clientIp,
        'x-forwarded-for': `${ipPrefix}251`,
    });
    expect(res.status).toBe(429);
});

test('session reads are not rate-limited (no database round trips on /get-session)', async () => {
    const res = await instanceA.handler(new Request(`${baseURL}/api/auth/get-session`, {
        headers: { origin: frontendOrigin, 'x-vercel-forwarded-for': otherIp },
    }));
    expect(res.status).toBe(200);

    const rows = await sql`SELECT 1 FROM rate_limit WHERE key = ${`${otherIp}|/get-session`}`;
    expect(rows.length).toBe(0);
});
