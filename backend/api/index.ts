import express, { Express, Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { deserializeUser } from '../middleware/authMiddleware.js';
import oauthRoutes from '../routes/oauthRoutes.js';
import collectionRoutes from '../routes/collectionRoutes.js';
// import { testDbConnection } from './lib/db';

dotenv.config({
    path: './.env'
});

const app: Express = express();
const port = process.env.PORT || 5001;

const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    preflightContinue: true,
};

console.log("CORS Options:", corsOptions);

app.use(cors(corsOptions));

app.options('/{*splat}', cors({
    origin: corsOptions.origin,
    credentials: true,
})); // Pre-flight request for all routes

app.all('/{*splat}', (req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});

app.use(cookieParser());
app.use(express.json());

// Attach user/session info to req if available
app.use(deserializeUser);

// Optional: Test DB connection on startup
// testDbConnection();

// --- API Routes ---
app.use('/api/auth', oauthRoutes);
app.use('/api/collections', collectionRoutes);

app.get('/api', (req: Request, res: Response) => {
    res.json({ message: 'Welcome to the mbuffs API!' });
});

// --- Define Global Error Handler with explicit type ---
const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
    console.error("[ERROR]", err.stack);

    // Check for specific error types and send appropriate response
    if (err instanceof z.ZodError) {
        // Send response for validation errors (no return)
        res.status(400).json({ message: 'Validation failed', errors: err.errors });
    } else {
      // Send generic server error response for all other errors
      res.status(500).json({ message: 'Something went wrong!', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }

    // Do not call next() unless delegating to another error handler.
    // A response has been sent, so the request cycle is complete.
};

// --- Register Global Error Handler ---
// This MUST be the last middleware registered
app.use(globalErrorHandler);

app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});

export default app;
