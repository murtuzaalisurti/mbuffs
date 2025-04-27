import { Request, Response } from 'express';
import { google } from '../lib/oauth';
import { lucia } from '../lib/lucia';
import { sql } from '../lib/db';
import { OAuth2RequestError } from 'arctic';
import { generateId } from 'lucia';
import { parseCookies, serializeCookie } from 'oslo/cookie';

const OAUTH_STATE_COOKIE_NAME = 'oauth_state';

// --- Google OAuth Handlers ---

export const googleLogin = async (req: Request, res: Response) => {
    try {
        const state = generateId(15); // Generate state for CSRF protection
        const url = await google.createAuthorizationURL(state, {
            scopes: ['profile', 'email'] // Request basic profile and email access
        });

        // Store state in a short-lived secure cookie
        const stateCookie = serializeCookie(OAUTH_STATE_COOKIE_NAME, state, {
            path: '/',
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            httpOnly: true,
            maxAge: 60 * 10, // 10 minutes
            sameSite: 'lax'
        });
        res.appendHeader('Set-Cookie', stateCookie);

        res.redirect(url.toString());
    } catch (error) {
        console.error('Google login initiation error:', error);
        res.status(500).json({ message: 'Failed to initiate Google login' });
    }
};

export const googleCallback = async (req: Request, res: Response) => {
    const code = req.query.code?.toString() ?? null;
    const state = req.query.state?.toString() ?? null;
    const storedState = parseCookies(req.headers.cookie ?? '').get(OAUTH_STATE_COOKIE_NAME) ?? null;

    // Clear the state cookie immediately
    const blankStateCookie = serializeCookie(OAUTH_STATE_COOKIE_NAME, '', {
        path: '/',
        maxAge: 0
    });
    res.appendHeader('Set-Cookie', blankStateCookie);

    if (!code || !state || !storedState || state !== storedState) {
        return res.status(400).json({ message: 'Invalid request or state mismatch' });
    }

    try {
        const tokens = await google.validateAuthorizationCode(code);
        const googleUserResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
            headers: {
                Authorization: `Bearer ${tokens.accessToken}`
            }
        });
        const googleUser: GoogleUser = await googleUserResponse.json();

        // Check if user exists based on Google ID
        const existingOauthAccount = await sql`
            SELECT u.* FROM oauth_account oa
            JOIN "user" u ON u.id = oa.user_id
            WHERE oa.provider_id = 'google' AND oa.provider_user_id = ${googleUser.sub}
        `;

        let userId: string;
        if (existingOauthAccount.length > 0) {
            // User exists, use their ID
            userId = existingOauthAccount[0].id;
        } else {
            // User does not exist, create new user and OAuth account
            const newUserId = generateId(15); // Generate a user ID
            userId = newUserId;

            // Use transaction to ensure atomicity
            await sql.begin(async (tx) => {
                // Create user
                await tx`
                    INSERT INTO "user" (id, email, username, avatar_url)
                    VALUES (${newUserId}, ${googleUser.email}, ${googleUser.name}, ${googleUser.picture})
                `;
                // Link OAuth account
                await tx`
                    INSERT INTO oauth_account (provider_id, provider_user_id, user_id)
                    VALUES ('google', ${googleUser.sub}, ${newUserId})
                `;
            });
        }

        // Create session for the user
        const session = await lucia.createSession(userId, {});
        const sessionCookie = lucia.createSessionCookie(session.id);

        res.appendHeader('Set-Cookie', sessionCookie.serialize());

        // Redirect to frontend (adjust URL as needed)
        res.redirect(process.env.FRONTEND_URL || '/');

    } catch (error) {
        console.error('Google callback error:', error);
        if (error instanceof OAuth2RequestError) {
            // Bad verification code, invalid credentials, etc.
            return res.status(400).json({ message: 'OAuth request failed', error: error.message });
        }
        return res.status(500).json({ message: 'Internal server error during OAuth callback' });
    }
};

// --- Logout --- 
export const logout = async (req: Request, res: Response) => {
    if (!req.session) {
        return res.status(401).json({ message: "Unauthorized: Not logged in" });
    }

    try {
        // Invalidate the session
        await lucia.invalidateSession(req.session.id);

        // Create and send blank cookie to clear client-side session
        const sessionCookie = lucia.createBlankSessionCookie();
        res.appendHeader("Set-Cookie", sessionCookie.serialize());

        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Failed to log out' });
    }
};

// --- Get Current User (Example Protected Route) ---
export const getCurrentUser = async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    // Return user info attached by deserializeUser middleware
    // You might want to fetch fresh data or just return stored attributes
    res.status(200).json({ user: req.user });
};

// --- Helper Interface ---
interface GoogleUser {
    sub: string; // Google User ID
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    email?: string;
    email_verified?: boolean;
    locale?: string;
}
