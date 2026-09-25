import { afterAll, beforeAll, expect, test } from 'vitest';
import { auth } from '../lib/auth.js';
import { sql } from '../lib/db.js';

const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
const email = `auth_fields_${suffix}@example.com`;

let userId: string;
let cookieHeader: string;

const sessionHeaders = () => new Headers({ cookie: cookieHeader });

const getRole = async (): Promise<string> => {
    const rows = await sql`SELECT role FROM "user" WHERE id = ${userId}`;
    return rows[0].role as string;
};

beforeAll(async () => {
    // Attempt to self-assign admin at sign-up; the role field must be ignored.
    const { headers, response } = await auth.api.signUpEmail({
        body: {
            email,
            password: `Str0ng-pass-${suffix}`,
            name: 'Auth Fields Test',
            role: 'admin',
        } as NonNullable<Parameters<typeof auth.api.signUpEmail>[0]>['body'],
        returnHeaders: true,
    });

    userId = response.user.id;
    cookieHeader = headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; ');
});

afterAll(async () => {
    // session/account rows cascade on user delete
    await sql`DELETE FROM "user" WHERE id = ${userId}`;
});

test('sign-up ignores a client-supplied role', async () => {
    expect(await getRole()).toBe('user');
});

test('update-user rejects a client-supplied role (privilege escalation regression)', async () => {
    await expect(
        auth.api.updateUser({
            body: { role: 'admin' } as NonNullable<Parameters<typeof auth.api.updateUser>[0]>['body'],
            headers: sessionHeaders(),
        }),
    ).rejects.toThrow();

    expect(await getRole()).toBe('user');
});

test('update-user rejects server-managed preference fields', async () => {
    await expect(
        auth.api.updateUser({
            body: { showAdultItems: true } as NonNullable<Parameters<typeof auth.api.updateUser>[0]>['body'],
            headers: sessionHeaders(),
        }),
    ).rejects.toThrow();

    const rows = await sql`SELECT show_adult_items FROM "user" WHERE id = ${userId}`;
    expect(rows[0].show_adult_items).toBe(false);
});

test('session exposes showAdultItems and reflects DB changes once the cookie cache is bypassed', async () => {
    const before = await auth.api.getSession({ headers: sessionHeaders() });
    expect(before?.user.showAdultItems).toBe(false);

    await sql`UPDATE "user" SET show_adult_items = true WHERE id = ${userId}`;

    const after = await auth.api.getSession({
        headers: sessionHeaders(),
        query: { disableCookieCache: true },
    });
    expect(after?.user.showAdultItems).toBe(true);
});
