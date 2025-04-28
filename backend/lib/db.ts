import { neon, neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

// Set the WebSocket implementation (not strictly necessary for Node.js but good practice)
// You might need to install 'ws': npm install ws
// import ws from 'ws';
// neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Database URL is not defined in environment variables. Please set DATABASE_URL.");
}

// Initialize the Neon query function
export const sql = neon(databaseUrl);

console.log('Neon DB connection initialized');

// Optional: Function to test connection
export async function testDbConnection() {
  try {
    const [result] = await sql`SELECT NOW()`;
    console.log('Database connection successful:', result);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
