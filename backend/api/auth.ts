import express, { Express, ErrorRequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import oauthRoutes from '../routes/oauthRoutes.js';

dotenv.config({
    path: './.env',
});

const port = process.env.PORT || 5001;

const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization', 'x-captcha-response'],
    credentials: true,
};

if (process.env.NODE_ENV !== 'production') {
    console.debug('[api:auth] CORS configured', { origin: corsOptions.origin });
}

export const createAuthApp = (): Express => {
    const app: Express = express();

    app.use(cors(corsOptions));
    app.use(cookieParser());

    app.use('/api/auth', oauthRoutes);

    const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
        console.error('[auth-error]', err);

        let statusCode = 500;
        let message = 'Internal Server Error';

        if (err instanceof z.ZodError) {
            statusCode = 400;
            message = err.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
        }

        res.status(statusCode).json({
            status: 'error',
            statusCode,
            message,
            ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
        });
    };

    app.use(globalErrorHandler);

    return app;
};

const app = createAuthApp();

const isDirectExecution = process.argv[1]
    ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
    : false;

if (isDirectExecution) {
    app.listen(port, () => {
        console.info(`[api:auth] Server listening on port ${port}`);
    });
}

export default app;
