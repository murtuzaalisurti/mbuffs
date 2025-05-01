import jwt, { SignOptions } from 'jsonwebtoken'; 
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN_STRING = process.env.JWT_EXPIRES_IN || '1d'; 

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not set.");
}

interface JwtPayload {
    userId: string;
}

export const signToken = (payload: JwtPayload): string => {
    let expiresInValue: string | number = JWT_EXPIRES_IN_STRING;
    if (/^\d+$/.test(JWT_EXPIRES_IN_STRING)) {
        expiresInValue = parseInt(JWT_EXPIRES_IN_STRING, 10);
    } 
    
    const options: SignOptions = {
        // Cast to any as workaround if type union causes issues
        expiresIn: expiresInValue as any 
    };
    return jwt.sign(payload, JWT_SECRET, options);
};

export const verifyToken = (token: string): JwtPayload | null => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded as JwtPayload;
    } catch (error) {
        console.error('JWT Verification Error:', error);
        return null;
    }
};
