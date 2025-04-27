import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async request handler to automatically catch errors and pass them to the next middleware.
 * @param fn The async request handler function.
 * @returns A standard Express request handler.
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next); // Catch promise rejections and pass to Express error handler
  };
};
