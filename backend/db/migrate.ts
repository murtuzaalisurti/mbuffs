import { neon, neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to execute raw SQL with neon using the query method
// Splits SQL into individual statements and executes them sequentially
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function execRawSql(sqlFn: any, rawSql: string): Promise<void> {
    // Split by semicolons, but be careful with DO $$ blocks
    // We need to handle PL/pgSQL blocks specially
    const statements: string[] = [];
    let currentStatement = '';
    let inDollarQuote = false;

    const lines = rawSql.split('\n');
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments at statement boundaries
        if (!trimmedLine || trimmedLine.startsWith('--')) {
            if (currentStatement.trim()) {
                currentStatement += '\n' + line;
            }
            continue;
        }

        currentStatement += '\n' + line;

        // Check for DO $$ blocks
        if (trimmedLine.includes('DO $$') || trimmedLine.includes('DO $')) {
            inDollarQuote = true;
        }
        if (inDollarQuote && (trimmedLine.includes('END $$;') || trimmedLine.includes('END$;'))) {
            inDollarQuote = false;
            statements.push(currentStatement.trim());
            currentStatement = '';
            continue;
        }

        // If not in a dollar quote block, check for statement end
        if (!inDollarQuote && trimmedLine.endsWith(';')) {
            statements.push(currentStatement.trim());
            currentStatement = '';
        }
    }

    // Add any remaining statement
    if (currentStatement.trim()) {
        statements.push(currentStatement.trim());
    }

    // Execute each statement
    for (const stmt of statements) {
        if (stmt && !stmt.startsWith('--')) {
            await sqlFn.query(stmt, []);
        }
    }
}

const runMigrations = async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('DATABASE_URL is not defined');
        process.exit(1);
    }

    console.log('Starting database migrations...');

    try {
        const sql = neon(databaseUrl);

        // Create migrations tracking table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS "_migrations" (
                "id" SERIAL PRIMARY KEY,
                "name" TEXT NOT NULL UNIQUE,
                "applied_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )
        `;

        // Get list of applied migrations
        const appliedMigrations = await sql`SELECT name FROM "_migrations" ORDER BY id`;
        const appliedSet = new Set(appliedMigrations.map((m) => (m as { name: string }).name));

        // Read migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`Found ${files.length} migration files`);

        for (const file of files) {
            if (appliedSet.has(file)) {
                console.log(`  [SKIP] ${file} (already applied)`);
                continue;
            }

            console.log(`  [RUN]  ${file}`);

            const filePath = path.join(migrationsDir, file);
            const migrationSql = fs.readFileSync(filePath, 'utf-8');

            // Execute the migration
            await execRawSql(sql, migrationSql);

            // Record the migration as applied
            await sql`INSERT INTO "_migrations" (name) VALUES (${file})`;

            console.log(`  [DONE] ${file}`);
        }

        console.log('Migrations completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

runMigrations();
