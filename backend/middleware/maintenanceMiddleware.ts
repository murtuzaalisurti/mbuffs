import type { Request, Response, NextFunction } from 'express';

/**
 * Maintenance mode barrier.
 *
 * When MAINTENANCE_MODE=true, every request (including Better Auth routes)
 * is rejected with 503 so no reads or writes hit the database. Intended for
 * DB migrations/cutovers; enable it, run the migration, then disable it.
 */
export const maintenanceMode = (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.MAINTENANCE_MODE !== 'true') {
        next();
        return;
    }

    res.set('Retry-After', '300');
    res.status(503).json({
        status: 'error',
        statusCode: 503,
        message: 'The service is temporarily unavailable while we perform maintenance. Please try again soon.',
    });
};
