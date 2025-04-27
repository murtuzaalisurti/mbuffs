import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables.');
}

interface JwtPayload {
    userId: string;
    // Add other relevant user data if needed (e.g., username, role)
}

export const signToken = (payload: JwtPayload): string => {
    return jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): JwtPayload | null => {
    try {
        return jwt.verify(token, JWT_SECRET!) as JwtPayload;
    } catch (error) {
        console.error('JWT verification failed:', error);
        return null;
    }
};
