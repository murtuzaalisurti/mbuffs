import { sql } from '../lib/db.js';

// Error code surfaced to the client on a blocked sign-in (email sign-in error
// code, or `?error=` on the OAuth error redirect).
export const ACCOUNT_SUSPENDED_CODE = 'ACCOUNT_SUSPENDED';
export const ACCOUNT_SUSPENDED_MESSAGE = 'This account has been suspended. Contact support if you believe this is a mistake.';

export const MAX_SUSPENSION_REASON_LENGTH = 500;

// Marks the account suspended and revokes every session so the user is signed
// out everywhere. Better Auth's 5-minute session cookie cache means an already
// open tab can keep working until its cached session expires; new sign-ins
// are refused by the session-create hook in lib/auth.ts.
export const suspendUser = async (
    userId: string,
    suspendedByUserId: string,
    reason: string | null,
): Promise<{ suspendedAt: string } | null> => {
    const rows = await sql`
        UPDATE "user"
        SET suspended_at = CURRENT_TIMESTAMP,
            suspension_reason = ${reason},
            suspended_by_user_id = ${suspendedByUserId},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
        RETURNING suspended_at
    `;

    if (rows.length === 0) {
        return null;
    }

    await sql`DELETE FROM session WHERE user_id = ${userId}`;

    const suspendedAt = rows[0].suspended_at;
    return { suspendedAt: suspendedAt instanceof Date ? suspendedAt.toISOString() : String(suspendedAt) };
};

export const unsuspendUser = async (userId: string): Promise<boolean> => {
    const rows = await sql`
        UPDATE "user"
        SET suspended_at = NULL,
            suspension_reason = NULL,
            suspended_by_user_id = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
        RETURNING id
    `;
    return rows.length > 0;
};

// Permanently deletes the account. Foreign keys do the rest in the same
// statement: sessions, linked accounts, owned collections (and their items and
// collaborators), collaborator memberships, ratings, comments (and replies to
// them), likes, notifications, push subscriptions and recommendation caches
// cascade; "added by" / "sent by" references on other people's data are set
// to NULL so that data is kept.
export const deleteUserAccount = async (userId: string): Promise<boolean> => {
    const rows = await sql`DELETE FROM "user" WHERE id = ${userId} RETURNING id`;
    return rows.length > 0;
};

export const countOtherAdmins = async (userId: string): Promise<number> => {
    const rows = await sql`
        SELECT COUNT(*)::int AS count
        FROM "user"
        WHERE role = 'admin' AND id <> ${userId} AND suspended_at IS NULL
    `;
    return Number(rows[0]?.count ?? 0);
};
