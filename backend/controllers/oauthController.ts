import { Request, Response, NextFunction } from 'express';
import { google } from '../lib/oauth.js';
import { sql } from '../lib/db.js';
import { OAuth2RequestError, generateCodeVerifier, generateState } from 'arctic';
import { generateId } from 'lucia'; // Keep for generating user IDs if needed
import { CookieAttributes, parseCookies, serializeCookie } from 'oslo/cookie';
import { DatabaseUserAttributes, GoogleUser } from '../lib/types.js';
import { signToken } from '../lib/jwt.js'; // Import JWT signing function
import dotenv from 'dotenv';

dotenv.config();

const OAUTH_STATE_COOKIE_NAME = 'oauth_state';
const OAUTH_CODE_VERIFIER_COOKIE_NAME = 'oauth_code_verifier';

const setCookie = (res: Response, name: string, value: string, options: CookieAttributes) => {
    res.appendHeader('Set-Cookie', serializeCookie(name, value, options));
};

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const state = generateState();
        const codeVerifier = generateCodeVerifier();
        // Fix: Pass scopes in options object
        const url = await google.createAuthorizationURL(state, codeVerifier, {
            scopes: ['profile', 'email']
        });
        const cookieOptions = { path: '/', secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 60 * 10, sameSite: 'lax' as const };
        setCookie(res, OAUTH_STATE_COOKIE_NAME, state, cookieOptions);
        setCookie(res, OAUTH_CODE_VERIFIER_COOKIE_NAME, codeVerifier, cookieOptions);
        res.redirect(url.toString());
    } catch (error) {
        next(error);
    }
};

export const googleCallback = async (req: Request, res: Response, next: NextFunction) => {
    const code = req.query.code?.toString() ?? null;
    const state = req.query.state?.toString() ?? null;
    const cookies = parseCookies(req.headers.cookie ?? '');
    const storedState = cookies.get(OAUTH_STATE_COOKIE_NAME) ?? null;
    const storedCodeVerifier = cookies.get(OAUTH_CODE_VERIFIER_COOKIE_NAME) ?? null;

    // Clear OAuth state cookies
    const blankCookieOptions = { path: '/', maxAge: 0 };
    setCookie(res, OAUTH_STATE_COOKIE_NAME, '', blankCookieOptions);
    setCookie(res, OAUTH_CODE_VERIFIER_COOKIE_NAME, '', blankCookieOptions);

    if (!code || !state || !storedState || state !== storedState || !storedCodeVerifier) {
        return res.status(400).json({ message: 'Invalid request, state mismatch, or missing code verifier' });
    }

    try {
        const tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);
        const googleUserResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
             headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });

        if (!googleUserResponse.ok) {
            const errorText = await googleUserResponse.text();
            console.error(`Failed to fetch Google user info: ${googleUserResponse.statusText}`, errorText);
            return res.status(502).json({ message: 'Failed to fetch user information from provider' });
        }
        const googleUser = await googleUserResponse.json() as GoogleUser;

        // Fix: Correct SQL type argument
        const existingOauthAccount = await sql<DatabaseUserAttributes>`SELECT u.* FROM public.oauth_account oa JOIN "user" u ON u.id = oa.user_id WHERE oa.provider_id = 'google' AND oa.provider_user_id = ${googleUser.sub}`;

        let userId: string;
        // Fix: Check rowCount instead of length for neon result
        if (existingOauthAccount.rowCount > 0) {
            // Fix: Access data via rows array
            userId = existingOauthAccount.rows[0].id;
            console.log(`Found existing user: ${userId}`);
        } else {
            const newUserId = generateId(15); // Keep using Lucia's ID generator
            userId = newUserId; // Assign initially, might be updated if email exists
            console.log(`Checking email ${googleUser.email} for user ID assignment.`);
            try {
                 // Fix: Manual transaction control with BEGIN/COMMIT/ROLLBACK
                await sql`BEGIN`;
                // Fix: Correct SQL type argument
                const existingEmail = await sql<DatabaseUserAttributes>`SELECT id FROM "user" WHERE email = ${googleUser.email}`;
                // Fix: Check rowCount
                if (existingEmail.rowCount > 0) {
                    // Email exists, link OAuth account to this existing user
                     // Fix: Access data via rows array
                    userId = existingEmail.rows[0].id; // Update userId to the existing user's ID
                    console.log(`Email ${googleUser.email} exists, linking OAuth to existing user ${userId}`);
                    await sql`INSERT INTO oauth_account (provider_id, provider_user_id, user_id) VALUES ('google', ${googleUser.sub}, ${userId}) ON CONFLICT (provider_id, provider_user_id) DO NOTHING`;
                } else {
                    // Email does not exist, insert the new user (using newUserId)
                    console.log(`Inserting new user ${newUserId} with email ${googleUser.email}`);
                    await sql`INSERT INTO "user" (id, email, username, avatar_url) VALUES (${newUserId}, ${googleUser.email}, ${googleUser.name}, ${googleUser.picture})`;
                    await sql`INSERT INTO oauth_account (provider_id, provider_user_id, user_id) VALUES ('google', ${googleUser.sub}, ${newUserId})`;
                    // userId remains newUserId in this case
                }
                await sql`COMMIT`; // Commit transaction
                console.log(`Transaction complete. User ID determined as: ${userId}`);
            } catch (error) {
                await sql`ROLLBACK`; // Rollback on error
                console.error("Database transaction error during user creation/linking:", error);
                return next(new Error("Failed to save user information"));
            }
        }

        // --- JWT Generation ---
        console.log(`Generating JWT for user ID: ${userId}`);
        const jwtPayload = { userId };
        const token = signToken(jwtPayload);

        // --- Redirect with token in query parameter ---
        console.log(`Redirecting user ${userId} to frontend with token.`);
        const redirectUrl = new URL(process.env.FRONTEND_URL || '/');
        redirectUrl.searchParams.set('token', token);
        res.redirect(redirectUrl.toString());

    } catch (error) {
        if (error instanceof OAuth2RequestError) {
            console.error('OAuth Error:', error);
            return res.status(400).json({ message: 'OAuth authentication failed: ' + error.message });
        }
        console.error('Google Callback Error:', error);
        next(error);
    }
};

// Updated Logout function - Removed session logic entirely
export const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Stateless JWT logout is primarily a client-side action (clearing the token).
        // No server-side session invalidation is needed.
        // Optionally, you could add logic here to blacklist the token if using a blacklist strategy.
        res.status(200).json({ message: "Logout successful (client should clear token)" });
    } catch (error) {
        // Pass unexpected errors to the global handler
        console.error("Error during logout endpoint processing:", error);
        next(error);
    }
};

export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) { // Check req.userId instead of req.user
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        // Fetch user details based on req.userId
        // Fix: Correct SQL type argument
        const result = await sql<DatabaseUserAttributes>`SELECT id, email, username, avatar_url FROM "user" WHERE id = ${req.userId}`;
        
         // Fix: Check rowCount
        if (result.rowCount === 0) {
            console.warn(`User ID ${req.userId} found in token but not in database.`);
            return res.status(404).json({ message: "User not found" });
        }

        // Fix: Access user data via rows array
        const user = result.rows[0];
        res.status(200).json({ user });
    } catch (error) {
        console.error("Error fetching current user:", error);
        next(error); // Pass database errors to the error handler
    }
};
