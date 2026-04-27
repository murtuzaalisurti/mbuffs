import { waitUntil } from '@vercel/functions';

export function scheduleBackground(promise: Promise<unknown>): void {
    const handledPromise = promise.catch((error) => {
        console.error('[background] scheduled task failed:', error);
    });

    if (process.env.VERCEL) {
        try {
            waitUntil(handledPromise);
        } catch (error) {
            console.error('[background] waitUntil unavailable in current context:', error);
        }
    }
}
