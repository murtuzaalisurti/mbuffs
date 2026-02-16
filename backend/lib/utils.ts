import { randomBytes } from 'crypto';

/**
 * Generates a random alphanumeric ID of the specified length.
 * This replaces the `generateId` function from Lucia auth.
 */
export function generateId(length: number = 15): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += alphabet[bytes[i] % alphabet.length];
    }
    return result;
}
