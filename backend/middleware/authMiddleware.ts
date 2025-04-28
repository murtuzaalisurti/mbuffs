import { lucia } from "../lib/lucia.js";
import type { Request, Response, NextFunction } from "express";

// Extend Express Request type to include user and session
declare global {
    namespace Express {
        interface Request {
            user: import("lucia").User | null;
            session: import("lucia").Session | null;
        }
    }
}

// Middleware to validate session and attach user/session to request
export const deserializeUser = async (req: Request, res: Response, next: NextFunction) => {
    const sessionId = lucia.readSessionCookie(req.headers.cookie ?? "");
    if (!sessionId) {
        req.user = null;
        req.session = null;
        return next();
    }

    const { session, user } = await lucia.validateSession(sessionId);

    if (session && session.fresh) {
        // Set new session cookie if it was refreshed
        const sessionCookie = lucia.createSessionCookie(session.id);
        res.appendHeader("Set-Cookie", sessionCookie.serialize());
    }

    if (!session) {
        // Clear invalid session cookie
        const blankCookie = lucia.createBlankSessionCookie();
        res.appendHeader("Set-Cookie", blankCookie.serialize());
    }

    req.user = user;
    req.session = session;
    return next();
};

// Middleware to protect routes - requires a valid session
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.session) {
        return res.status(401).json({ message: "Unauthorized: Authentication required" });
    }
    // User is authenticated, proceed
    next();
};
