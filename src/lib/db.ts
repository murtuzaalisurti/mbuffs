import { neon } from "@neondatabase/serverless";

export async function checkDbConnection() {
    console.log("Checking database connection...", import.meta.env.VITE_DATABASE_URL);
  if (!import.meta.env.VITE_DATABASE_URL) {
    return "No DATABASE_URL environment variable";
  }
  try {
    const sql = neon(import.meta.env.VITE_DATABASE_URL);
    const result = await sql`SELECT version()`;
    console.log("Pg version:", result);
    return "Database connected";
  } catch (error) {
    console.error("Error connecting to the database:", error);
    return "Database not connected";
  }
}