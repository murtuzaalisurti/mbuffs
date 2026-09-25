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
