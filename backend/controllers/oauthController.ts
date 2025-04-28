import { Request, Response, NextFunction } from 'express';
import { google } from '../lib/oauth.js';
import { lucia } from '../lib/lucia.js';
import { sql } from '../lib/db.js';
import { OAuth2RequestError, generateCodeVerifier, generateState } from 'arctic';
import { generateId } from 'lucia';
import { CookieAttributes, parseCookies, serializeCookie } from 'oslo/cookie';
import { DatabaseUserAttributes, GoogleUser } from '../lib/types.js';

const OAUTH_STATE_COOKIE_NAME = 'oauth_state';
const OAUTH_CODE_VERIFIER_COOKIE_NAME = 'oauth_code_verifier';

const setCookie = (res: Response, name: string, value: string, options: CookieAttributes) => {
    res.appendHeader('Set-Cookie', serializeCookie(name, value, options));
};

// Remove Promise<void> annotation
export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const state = generateState();
        const codeVerifier = generateCodeVerifier();
        const options = ['profile', 'email'];
        const url = google.createAuthorizationURL(state, codeVerifier, options); 
        const cookieOptions = { path: '/', secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 60 * 10, sameSite: 'lax' as const };
        setCookie(res, OAUTH_STATE_COOKIE_NAME, state, cookieOptions);
        setCookie(res, OAUTH_CODE_VERIFIER_COOKIE_NAME, codeVerifier, cookieOptions);
        res.redirect(url.toString());
    } catch (error) {
        // Pass error to global handler
        next(error);
    }
};

// Remove Promise<void> annotation
export const googleCallback = async (req: Request, res: Response, next: NextFunction) => {
    const code = req.query.code?.toString() ?? null;
    const state = req.query.state?.toString() ?? null;
    const cookies = parseCookies(req.headers.cookie ?? '');
    const storedState = cookies.get(OAUTH_STATE_COOKIE_NAME) ?? null;
    const storedCodeVerifier = cookies.get(OAUTH_CODE_VERIFIER_COOKIE_NAME) ?? null;

    const blankCookieOptions = { path: '/', maxAge: 0 };
    setCookie(res, OAUTH_STATE_COOKIE_NAME, '', blankCookieOptions);
    setCookie(res, OAUTH_CODE_VERIFIER_COOKIE_NAME, '', blankCookieOptions);

    if (!code || !state || !storedState || state !== storedState || !storedCodeVerifier) {
        res.status(400).json({ message: 'Invalid request, state mismatch, or missing code verifier' });
        return;
    }

    try {
        const tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);
        // @ts-expect-error no types for tokens
        console.log("Tokens:", tokens.data.access_token);
        const googleUserResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
            // @ts-expect-error no types for tokens
            headers: { Authorization: `Bearer ${tokens.data.access_token}` }
        });

        if (!googleUserResponse.ok) {
            console.error(`Failed to fetch Google user info: ${googleUserResponse.statusText}`, await googleUserResponse.text());
            res.status(502).json({ message: 'Failed to fetch user information from provider' });
            return;
        }
        const googleUser = await googleUserResponse.json() as GoogleUser;

        // const allTables = await sql`SELECT table_name FROM information_schema.tables`;
        // console.log("All Tables:", allTables);
        const existingOauthAccount = await sql`
            SELECT u.* FROM public.oauth_account oa JOIN "user" u ON u.id = oa.user_id WHERE oa.provider_id = 'google' AND oa.provider_user_id = ${googleUser.sub}
        `;

        let userId: string;
        if (existingOauthAccount.length > 0) {
            userId = (existingOauthAccount[0] as DatabaseUserAttributes).id;
        } else {
            const newUserId = generateId(15);
            userId = newUserId;
            await sql.transaction((tx) => [
                tx`INSERT INTO "user" (id, email, username, avatar_url) VALUES (${newUserId}, ${googleUser.email}, ${googleUser.name}, ${googleUser.picture}) ON CONFLICT (email) DO NOTHING`,
                tx`INSERT INTO oauth_account (provider_id, provider_user_id, user_id) VALUES ('google', ${googleUser.sub}, ${newUserId})`
            ]);
        }

        const session = await lucia.createSession(userId, {});
        const sessionCookie = lucia.createSessionCookie(session.id);
        setCookie(res, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
        res.redirect(process.env.FRONTEND_URL || '/');

    } catch (error) {
        // Pass error to global handler
        next(error); 
    }
};

// Remove Promise<void> annotation
export const logout = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) {
        res.status(401).json({ message: "Unauthorized: Not logged in" });
        return;
    }
    try {
        await lucia.invalidateSession(req.session.id);
        const sessionCookie = lucia.createBlankSessionCookie();
        setCookie(res, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        // Pass error to global handler
        next(error);
    }
};

// Remove Promise<void> annotation
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    res.status(200).json({ user: req.user });
};
