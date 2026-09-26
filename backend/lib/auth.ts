import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha } from "better-auth/plugins";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import * as schema from "../db/schema.js";
import { ACCOUNT_SUSPENDED_CODE, ACCOUNT_SUSPENDED_MESSAGE } from "../services/accountService.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.js";
import { scheduleBackground } from "./waitUntilHelper.js";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined in environment variables.");
}

// Create neon query function for raw SQL and drizzle instance for better-auth
const sqlQuery = neon(databaseUrl);
const db = drizzle(sqlQuery);

// Rate-limit counters live in Postgres (rate_limit table) so every serverless
// instance shares them; in-memory counters are per instance. Limiting stays on
// Better Auth's default of production only, with its default rules (e.g. 3 per
// minute per IP for password-reset and verification emails, 3 per 10 seconds
// for sign-in, sign-up and change-password). Exported for the rate-limit test.
export const rateLimitOptions = {
    storage: "database" as const,
    customRules: {
        // Session reads are read-only, served from the cookie cache, and hit on
        // every page load; limiting them would add database round trips to
        // the hottest auth request for no real protection.
        "/get-session": false as const,
    },
};

// Limits are per client IP. Vercel overwrites x-forwarded-for with the
// client's public IP (so it can't be spoofed); x-vercel-forwarded-for carries
// the same value even behind another proxy. If no IP resolves, Better Auth
// falls back to one bucket shared by everyone, which would throttle all users
// together, so both are listed.
export const ipAddressOptions = {
    ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"],
};

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
            rateLimit: schema.rateLimit,
        },
    }),
    rateLimit: rateLimitOptions,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5001",
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:8080"],
    emailAndPassword: {
        enabled: true,
        // Better Auth builds the link (backend /reset-password/:token, which
        // redirects to the frontend's /reset-password?token=...). Sent in the
        // background (see advanced.backgroundTasks), so the response doesn't
        // reveal whether the email has an account.
        sendResetPassword: async ({ user, url }) => {
            await sendPasswordResetEmail(user, url);
        },
        resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
        // A reset signs out every device, in case the old password was compromised.
        revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
        sendVerificationEmail: async ({ user, url }) => {
            await sendVerificationEmail(user, url);
        },
        sendOnSignUp: true,
        expiresIn: 60 * 60, // 1 hour
        // Also rewrites an already signed-in user's session cookie with
        // emailVerified: true, so the change shows up without waiting out the
        // 5-minute cookie cache.
        autoSignInAfterVerification: true,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            updateUserOnSignIn: true,
            mapProfileToUser(profile) {
                return {
                    image: profile.picture || undefined,
                };
            },
        },
    },
    plugins: [
        captcha({
            provider: "cloudflare-turnstile",
            secretKey: process.env.TURNSTILE_SECRET_KEY!,
        }),
    ],
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day (refresh session if older than 1 day)
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes cache
        },
    },
    advanced: {
        ipAddress: ipAddressOptions,
        // Keeps email sends alive after the response on Vercel (waitUntil).
        backgroundTasks: {
            handler: scheduleBackground,
        },
        // Cross-origin cookie setup for separate frontend/backend domains (PWA support)
        // sameSite:"none" + secure:true is required for cross-origin fetch()
        // requests to send cookies (used by useSession() in the PWA).
        // Without this, cookies only travel on top-level navigations (the OAuth
        // redirect), so the session appears valid right after login but is gone
        // when the PWA is closed and reopened.
        // In development (HTTP) we fall back to "lax" because "none" requires HTTPS.
        defaultCookieAttributes: {
            // Force sameSite: "none" and secure: true for local network/ngrok testing
            // because the frontend (nip.io) and backend (ngrok) are cross-origin.
            sameSite: "none" as const,
            secure: true,
            // Explicit maxAge prevents iOS from treating these as session-only cookies
            // that get wiped when it kills the PWA's WKWebView process.
            maxAge: 60 * 60 * 24 * 7, // 7 days — matches session.expiresIn
        },
    },
    user: {
        additionalFields: {
            firstName: {
                type: "string",
                required: false,
                fieldName: "firstName",
            },
            lastName: {
                type: "string",
                required: false,
                fieldName: "lastName",
            },
            username: {
                type: "string",
                required: false,
            },
            // Server-managed fields below use `input: false` so clients can't set
            // them through Better Auth's own sign-up / update-user endpoints
            // (otherwise any user could POST {"role":"admin"} to
            // /api/auth/update-user). Preferences change via /api/user/preferences.
            role: {
                type: "string",
                required: false,
                defaultValue: "user",
                input: false,
            },
            recommendationsEnabled: {
                type: "boolean",
                required: false,
                defaultValue: false,
                fieldName: "recommendationsEnabled",
                input: false,
            },
            recommendationsCollectionId: {
                type: "string",
                required: false,
                fieldName: "recommendationsCollectionId",
                input: false,
            },
            showRedditLabel: {
                type: "boolean",
                required: false,
                defaultValue: true,
                fieldName: "showRedditLabel",
                input: false,
            },
            // Exposed on the session so per-request checks (e.g. the TMDB proxy's
            // adult filter) read it from the session cookie cache instead of
            // querying the database on every request.
            showAdultItems: {
                type: "boolean",
                required: false,
                defaultValue: false,
                fieldName: "showAdultItems",
                input: false,
            },
        },
    },
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", "credential"],
        },
    },
    hooks: {
        before: createAuthMiddleware(async (ctx) => {
            // Better Auth lets a signed-out caller request a verification email
            // for any address, which (with no captcha on this route) lets a
            // script mail a stranger's unverified account and burn the daily
            // email quota. The app only offers "Verify my email" while signed in,
            // and sign-up sends its email without going through this route, so
            // require a session here. Better Auth then also checks the email
            // matches the session's user.
            if (ctx.path === "/send-verification-email") {
                const session = await getSessionFromCtx(ctx);
                if (!session) {
                    throw APIError.from("UNAUTHORIZED", {
                        message: "Sign in to request a verification email",
                        code: "UNAUTHORIZED",
                    });
                }
            }
        }),
    },
    databaseHooks: {
        session: {
            create: {
                async before(session) {
                    // Suspended accounts can't sign in by any method. Thrown outside
                    // the try below so it isn't swallowed: email sign-in returns it
                    // as the error code, and the OAuth callback redirects to the
                    // error URL with ?error=ACCOUNT_SUSPENDED.
                    const suspension = await sqlQuery`
                        SELECT suspended_at FROM "user" WHERE id = ${session.userId}
                    `;
                    if (suspension.length > 0 && suspension[0].suspended_at) {
                        throw APIError.from("FORBIDDEN", {
                            message: ACCOUNT_SUSPENDED_MESSAGE,
                            code: ACCOUNT_SUSPENDED_CODE,
                        });
                    }

                    // When a session is created after OAuth, check if the user
                    // is missing an image and has a Google account with an id_token
                    try {
                        const userResult = await sqlQuery`
                            SELECT u.id, u.image, a.id_token
                            FROM "user" u
                            JOIN account a ON a.user_id = u.id AND a.provider_id = 'google'
                            WHERE u.id = ${session.userId}
                        `;
                        if (userResult.length > 0 && !userResult[0].image && userResult[0].id_token) {
                            const idToken = userResult[0].id_token;
                            const payload = JSON.parse(
                                Buffer.from(idToken.split('.')[1], 'base64').toString()
                            );
                            if (payload.picture) {
                                await sqlQuery`
                                    UPDATE "user" SET image = ${payload.picture} WHERE id = ${session.userId}
                                `;
                                console.log(`[auth] Populated Google profile image for user ${session.userId}`);
                            }
                        }
                    } catch (err) {
                        console.error('[auth] Error populating Google image:', err);
                    }
                    return { data: session };
                },
            },
        },
    },
});

// Export type for use in other files
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
