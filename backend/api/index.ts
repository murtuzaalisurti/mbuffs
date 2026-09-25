import express, { Express, Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { deserializeUser } from '../middleware/authMiddleware.js';
import { requireTrustedOrigin } from '../middleware/originProtectionMiddleware.js';
import oauthRoutes from '../routes/oauthRoutes.js';
import collectionRoutes from '../routes/collectionRoutes.js';
import contentRoutes from '../routes/contentRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';
import recommendationRoutes from '../routes/recommendationRoutes.js';
import parentalGuidanceRoutes from '../routes/parentalGuidanceRoutes.js';
import redditRoutes from '../routes/redditRoutes.js';
import reviewRoutes from '../routes/reviewRoutes.js';
import shareRoutes from '../routes/shareRoutes.js';
import notificationRoutes from '../routes/notificationRoutes.js';
import omdbRoutes from '../routes/omdbRoutes.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config({
    path: './.env'
});

const port = process.env.PORT || 5001;

// --- CORS Setup --- 
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization', 'x-captcha-response'],
    // Let browsers cache preflight results (Chrome caps this at 2 hours) so
    // cross-origin JSON requests don't pay an OPTIONS round trip every time.
    maxAge: 7200,
    credentials: true, // Required for Better Auth cookies
};

if (process.env.NODE_ENV !== 'production') {
    console.debug('[api] CORS configured', { origin: corsOptions.origin });
}

// --- CSRF origin enforcement ---
// Session cookies are issued with SameSite=None (cross-site), so every
// state-changing request must come from the trusted frontend origin. This is
// deny-by-default: any new mutating route is protected automatically, and it
// runs before body parsing so rejected requests aren't parsed.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Public, cookie-less read endpoints that use a mutating HTTP method. These are
// also called server-to-server (e.g. the Vercel OG image functions) without an
// Origin header, so they must be exempt from origin enforcement.
const CSRF_EXEMPT_PATHS = new Set(['/api/content']);

const csrfOriginGuard = (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;

    if (!MUTATING_METHODS.has(req.method) || CSRF_EXEMPT_PATHS.has(path)) {
        next();
        return;
    }

    requireTrustedOrigin(req, res, next);
};

export const createApp = (): Express => {
    const app: Express = express();

    // Apply CORS globally
    app.use(cors(corsOptions));

    app.use(cookieParser());

    // Visitor's country from Vercel's edge geolocation of the requesting client's
    // IP (not the server's location). Mounted before session lookup since it needs
    // no auth. The header only exists on Vercel, so the client falls back to its
    // locale elsewhere. Private cache only: the answer differs per visitor.
    app.get('/api/region', (req: Request, res: Response) => {
        const country = req.get('x-vercel-ip-country')?.toUpperCase();
        res.set('Cache-Control', 'private, max-age=3600');
        res.json({ country: country && /^[A-Z]{2}$/.test(country) ? country : null });
    });

    // IMPORTANT: Better Auth routes must be mounted BEFORE express.json()
    // Better Auth handles its own body parsing
    app.use('/api/auth', oauthRoutes);

    // Enforce a trusted Origin on all state-changing requests (CSRF protection).
    // Mounted after the auth routes (Better Auth has its own CSRF handling) and
    // before express.json so rejected requests skip body parsing.
    app.use(csrfOriginGuard);

    // Apply JSON middleware for other routes (2mb limit for avatar uploads)
    app.use(express.json({ limit: '2mb' }));

    // Attach userId info from session to req if available
    app.use(deserializeUser);

    // --- API Routes ---
    app.use('/api/collections', collectionRoutes);
    app.use('/api/content', contentRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/recommendations', recommendationRoutes);
    app.use('/api/ratings', parentalGuidanceRoutes);
    app.use('/api/reddit', redditRoutes);
    app.use('/api/reviews', reviewRoutes);
    app.use('/api/share', shareRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/omdb-ratings', omdbRoutes);

    app.get('/api', (req: Request, res: Response) => {
        res.json({ message: `Welcome to the mbuffs API! ${process.env.FRONTEND_URL}` });
    });

    // --- Define Global Error Handler with explicit type ---
    const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
        console.error('[ERROR]', err);

        let statusCode = 500;
        let message = 'Internal Server Error';

        // Handle Zod validation errors
        if (err instanceof z.ZodError) {
            statusCode = 400; // Bad Request
            message = err.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        }

        // Send a JSON response
        res.status(statusCode).json({
            status: 'error',
            statusCode,
            message,
            // Optionally include stack trace in development
            ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
        });
    };

    app.use(globalErrorHandler);

    return app;
};

const app = createApp();

const isDirectExecution = process.argv[1]
    ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
    : false;

if (isDirectExecution) {
    app.listen(port, () => {
        console.info(`[api] Server listening on port ${port}`);
    });
}

export default app;
