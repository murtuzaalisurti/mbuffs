/**
 * Reddit Scraper Script - Runs at build time to populate Reddit recommendations
 *
 * This script is designed to run during Vercel build to scrape movie recommendations
 * from Reddit and store them in the database. Since serverless functions can't run
 * long background tasks, we do this at build time instead.
 *
 * Cache behavior:
 * - Only scrapes if data is older than CACHE_TTL_HOURS
 * - Use --force flag to bypass cache check
 *
 * === Manual browser workflow ===
 *
 * Reddit blocks automated requests (even curl). Use this 3-step manual flow
 * to fetch data in your browser and feed it to the script.
 *
 * All data lives in a single file: backend/data/reddit/cache.json
 *
 * Step 1 — Get subreddit post URLs:
 *
 *   node backend/scripts/scrapeReddit.mjs --list-post-urls
 *
 *   Visit each URL in your browser. Copy the JSON response and paste it
 *   into cache.json under the "posts" key, using the subreddit name as key:
 *
 *   {
 *     "posts": {
 *       "a24": { <paste JSON> },
 *       "MovieSuggestions": { <paste JSON> },
 *       ...
 *     },
 *     "comments": {}
 *   }
 *
 * Step 2 — Get comment URLs (requires step 1):
 *
 *   node backend/scripts/scrapeReddit.mjs --list-comment-urls
 *
 *   Reads your saved posts, prints comment URLs for the top posts.
 *   Visit each URL and paste the JSON into "comments" using the key shown:
 *
 *   {
 *     "posts": { ... },
 *     "comments": {
 *       "a24/abc123": { <paste JSON> },
 *       "MovieSuggestions/def456": { <paste JSON> },
 *       ...
 *     }
 *   }
 *
 * Step 3 — Process cached data:
 *
 *   node backend/scripts/scrapeReddit.mjs --from-cache --force
 *
 *   Reads all data from cache.json, extracts movie titles with AI,
 *   validates against TMDB, and saves to the database. No Reddit
 *   requests are made.
 */

import { neon } from '@neondatabase/serverless';
import { Codex } from '@openai/codex-sdk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Subreddits to scrape for movie recommendations
 * 
 * Selection rationale:
 * - MovieSuggestions: Primary recommendation subreddit, users explicitly ask for and give movie suggestions
 * - movies: Large general movie discussion, lots of "what should I watch" threads
 * - flicks: Smaller but quality-focused movie discussion community
 * - TrueFilm: More serious/analytical film discussion, good for finding hidden gems
 * - horror: Genre-specific, great for horror recommendations
 * - scifi: Genre-specific, good for sci-fi recommendations
 * - televisionsuggestions: TV show recommendations
 * 
 * You can customize this via REDDIT_SUBREDDITS env var (comma-separated)
 * Example: REDDIT_SUBREDDITS=MovieSuggestions,horror,scifi
 */
const DEFAULT_SUBREDDITS = [
    'a24',
    'MovieSuggestions',    // ~2M members - dedicated recommendation sub
    'movies',              // ~35M members - general movie discussion
    'flicks',              // ~150K members - quality movie discussion
    'TrueFilm',            // ~1.5M members - analytical film discussion
    'horror',              // ~3M members - horror genre
    'scifi',               // ~2M members - sci-fi genre
    'romancemovies',
    'Cinema',
    'TheBigPicture',
    'NetflixBestOf',
    'Letterboxd',
    'netflix',
    'moviecritic',
    'AskReddit', // For "What movie should I watch?" threads
    'CineSeries',
    'televisionsuggestions', // TV recommendations
    'Ijustwatched',
];

function getEnvInt(name, fallback, min = Number.NEGATIVE_INFINITY) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === '') {
        return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(min, parsed);
}

function getEnvFloat(name, fallback, min = Number.NEGATIVE_INFINITY) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === '') {
        return fallback;
    }

    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(min, parsed);
}

// Parse subreddits from env or use defaults
const MOVIE_SUBREDDITS = process.env.REDDIT_SUBREDDITS
    ? process.env.REDDIT_SUBREDDITS.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_SUBREDDITS;

const POSTS_PER_SUBREDDIT = getEnvInt('REDDIT_POSTS_PER_SUB', 25, 1);
const MIN_SCORE = getEnvInt('REDDIT_MIN_SCORE', 10, 0);
const TIMEFRAME = process.env.REDDIT_TIMEFRAME || 'all'; // hour, day, week, month, year, all
const AI_PROVIDER = process.env.AI_PROVIDER || 'codex'; // 'codex' | 'gemini'
const GEMINI_MODEL = process.env.GEMINI_MODEL || ''; // empty = use CLI default
const AI_BATCH_SIZE = getEnvInt('REDDIT_AI_BATCH_SIZE', 80, 10);
const AI_CONCURRENCY = getEnvInt('REDDIT_AI_CONCURRENCY', 3, 1);
const AI_BATCH_DELAY_MS = getEnvInt('REDDIT_AI_BATCH_DELAY_MS', 0, 0);
const AI_TEXT_CHARS_PER_ITEM = getEnvInt('REDDIT_AI_TEXT_CHARS_PER_ITEM', 500, 50);
const AI_PROMPT_TEXT_BUDGET_CHARS = getEnvInt('REDDIT_AI_PROMPT_TEXT_BUDGET_CHARS', 8000, 2000);
const AI_TIMEOUT_MS = getEnvInt('REDDIT_AI_TIMEOUT_MS', 0, 0);
const AI_MAX_RETRIES = getEnvInt('REDDIT_AI_MAX_RETRIES', 2, 0);
const TMDB_VALIDATE_LIMIT = getEnvInt('REDDIT_TMDB_VALIDATE_LIMIT', 0, 0);
const TMDB_CONCURRENCY = getEnvInt('REDDIT_TMDB_CONCURRENCY', 5, 1);
const TMDB_RPS = getEnvFloat('REDDIT_TMDB_RPS', 10, 1);
const TMDB_TIMEOUT_MS = getEnvInt('REDDIT_TMDB_TIMEOUT_MS', 10000, 1000);
const TMDB_MAX_RETRIES = getEnvInt('REDDIT_TMDB_MAX_RETRIES', 2, 0);

// Cache configuration - only re-scrape if data is older than this (default: 1 month)
const CACHE_TTL_HOURS = getEnvInt('REDDIT_CACHE_TTL_HOURS', 720, 1); // 720 hours = 30 days

// Generate a hash of the subreddit list to detect config changes
const SUBREDDITS_HASH = MOVIE_SUBREDDITS.slice().sort().join(',').toLowerCase();

// Rate limiting — unauthenticated allows ~10 req/min, stay well under to avoid 429s
const DELAY_BETWEEN_REQUESTS = 6000;
const DELAY_BETWEEN_SUBREDDITS = 8000;

// Check for --force flag
const FORCE_SCRAPE = process.argv.includes('--force');

// Manual browser-based workflow flags
const LIST_POST_URLS = process.argv.includes('--list-post-urls');
const LIST_COMMENT_URLS = process.argv.includes('--list-comment-urls');
const FROM_CACHE = process.argv.includes('--from-cache');
const REDDIT_CACHE_FILE = join(__dirname, '..', 'data', 'reddit', 'cache.json');

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout(promiseFactory, timeoutMs, operationName) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return promiseFactory();
    }

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            const timeoutError = new Error(`${operationName} timed out after ${timeoutMs}ms`);
            timeoutError.name = 'TimeoutError';
            reject(timeoutError);
        }, timeoutMs);
    });

    try {
        return await Promise.race([promiseFactory(), timeoutPromise]);
    } finally {
        clearTimeout(timeoutId);
    }
}

function generateId(length = 15) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
}

let tmdbNextAvailableAt = 0;

async function waitForTMDBSlot() {
    const minIntervalMs = 1000 / TMDB_RPS;
    const now = Date.now();
    const waitMs = Math.max(0, tmdbNextAvailableAt - now);
    tmdbNextAvailableAt = Math.max(tmdbNextAvailableAt, now) + minIntervalMs;
    if (waitMs > 0) {
        await sleep(waitMs);
    }
}

function getRetryDelayMs(attempt, retryAfterHeader = null) {
    const retryAfterSeconds = Number(retryAfterHeader);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000;
    }

    const base = 400;
    const jitter = Math.floor(Math.random() * 300);
    return (base * Math.pow(2, attempt)) + jitter;
}

async function fetchTMDBJson(url) {
    for (let attempt = 0; attempt <= TMDB_MAX_RETRIES; attempt++) {
        await waitForTMDBSlot();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

        try {
            const response = await fetch(url, { signal: controller.signal });

            if (response.status === 429 && attempt < TMDB_MAX_RETRIES) {
                const delayMs = getRetryDelayMs(attempt, response.headers.get('retry-after'));
                await sleep(delayMs);
                continue;
            }

            if (!response.ok) {
                if (response.status >= 500 && attempt < TMDB_MAX_RETRIES) {
                    await sleep(getRetryDelayMs(attempt));
                    continue;
                }
                return null;
            }

            return await response.json();
        } catch (error) {
            if (attempt < TMDB_MAX_RETRIES) {
                await sleep(getRetryDelayMs(attempt));
                continue;
            }

            if (error?.name === 'AbortError') {
                console.warn(`  TMDB request timed out after ${TMDB_TIMEOUT_MS}ms`);
            }
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    return null;
}

// ============================================================================
// MANUAL BROWSER WORKFLOW
//
// Single cache file at backend/data/reddit/cache.json with structure:
// {
//   "posts": { "subreddit": <raw reddit JSON>, ... },
//   "comments": { "subreddit/postId": <raw reddit JSON>, ... }
// }
// ============================================================================

function readCache() {
    try {
        return JSON.parse(readFileSync(REDDIT_CACHE_FILE, 'utf-8'));
    } catch {
        return { posts: {}, comments: {} };
    }
}

function writeCache(cache) {
    const dir = dirname(REDDIT_CACHE_FILE);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(REDDIT_CACHE_FILE, JSON.stringify(cache, null, 2));
}

function listPostUrls() {
    const cache = readCache();

    console.log('=== Step 1: Subreddit post URLs ===\n');
    console.log('Visit each URL in your browser, copy the JSON, and paste it into:');
    console.log(`  ${REDDIT_CACHE_FILE}\n`);
    console.log('under the "posts" key with the subreddit name as the key.\n');

    for (const subreddit of MOVIE_SUBREDDITS) {
        const url = `https://www.reddit.com/r/${subreddit}/top.json?t=${TIMEFRAME}&limit=${POSTS_PER_SUBREDDIT}`;
        const saved = !!cache.posts[subreddit];
        console.log(`${saved ? '[SAVED]' : '[    ]'} ${url}`);
    }

    if (!existsSync(REDDIT_CACHE_FILE)) {
        writeCache({ posts: {}, comments: {} });
        console.log(`\nCreated empty cache file: ${REDDIT_CACHE_FILE}`);
    }

    console.log('\nPaste each JSON response as the value for its subreddit key in "posts".');
    console.log('Then run: node backend/scripts/scrapeReddit.mjs --list-comment-urls');
}

function listCommentUrls() {
    const cache = readCache();

    console.log('=== Step 2: Comment URLs ===\n');

    let totalUrls = 0;

    for (const subreddit of MOVIE_SUBREDDITS) {
        const postsData = cache.posts[subreddit];
        if (!postsData?.data?.children) {
            console.log(`  [SKIP] r/${subreddit} — no cached posts yet`);
            continue;
        }

        const posts = postsData.data.children
            .map(child => ({ id: child.data.id, score: child.data.score, numComments: child.data.num_comments }))
            .filter(p => p.score >= MIN_SCORE)
            .sort((a, b) => b.numComments - a.numComments)
            .slice(0, POSTS_TO_FETCH_COMMENTS);

        for (const post of posts) {
            const url = `https://www.reddit.com/r/${subreddit}/comments/${post.id}.json?limit=50&depth=1&sort=top`;
            const key = `${subreddit}/${post.id}`;
            const saved = !!cache.comments[key];
            console.log(`${saved ? '[SAVED]' : '[    ]'} ${url}`);
            console.log(`        -> key: "${key}"`);
            totalUrls++;
        }
    }

    console.log(`\n${totalUrls} comment URLs total.`);
    console.log('Paste each JSON response into the "comments" object with the key shown above.');
    console.log('Then run: node backend/scripts/scrapeReddit.mjs --from-cache --force');
}

// ============================================================================
// REDDIT FETCHING
// ============================================================================

const REDDIT_MAX_RETRIES = 3;

let redditBlocked = false;

async function fetchRedditJson(url, retryCount = 0) {
    if (redditBlocked) {
        return null;
    }

    try {
        const { stdout } = await execFileAsync('curl', [
            '-s',
            '-w', '\n%{http_code}',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
            '-H', 'Accept-Language: en-US,en;q=0.9',
            url,
        ], { maxBuffer: 10 * 1024 * 1024 });

        const lines = stdout.trimEnd().split('\n');
        const statusCode = parseInt(lines.pop(), 10);
        const body = lines.join('\n');

        if (statusCode === 403) {
            redditBlocked = true;
            console.warn(`  Reddit returned 403 Forbidden`);
            return null;
        }

        if (statusCode === 429 && retryCount < REDDIT_MAX_RETRIES) {
            const delay = 10000 * (retryCount + 1);
            console.warn(`  Reddit rate limit hit, waiting ${delay/1000}s (retry ${retryCount + 1}/${REDDIT_MAX_RETRIES})...`);
            await sleep(delay);
            return fetchRedditJson(url, retryCount + 1);
        }

        if (statusCode < 200 || statusCode >= 300) {
            console.error(`  Reddit API error: ${statusCode} for ${url}`);
            return null;
        }

        return JSON.parse(body);
    } catch (error) {
        console.error(`  Error fetching Reddit data from ${url}:`, error.message);
        return null;
    }
}

// ============================================================================
// AI-POWERED MOVIE EXTRACTION (Codex SDK)
// ============================================================================

// Authentication: the Codex SDK inherits the CLI's credentials from ~/.codex,
// so the user must run `codex login` once (ChatGPT subscription) before running this script.
const CODEX_MODEL = process.env.CODEX_MODEL;

const codex = new Codex();

const MOVIE_EXTRACTION_SCHEMA = {
    type: 'object',
    properties: {
        movies: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    year: { type: ['number', 'null'] },
                    mediaType: { type: 'string', enum: ['movie', 'tv', 'unknown'] },
                    sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
                },
                required: ['title', 'year', 'mediaType', 'sentiment'],
                additionalProperties: false,
            },
        },
    },
    required: ['movies'],
    additionalProperties: false,
};

/**
 * Use Codex to extract movie/show names from text
 * Returns array of { title, year, sentiment }
 */
function parseMovieExtractionResponse(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) {
            throw new Error('No JSON object found in Codex response');
        }
        parsed = JSON.parse(match[0]);
    }

    const movies = Array.isArray(parsed?.movies) ? parsed.movies : [];
    return movies.filter(m => m && typeof m.title === 'string' && m.title.trim());
}

async function extractMoviesWithCodex(texts) {
    const combinedText = texts
        .map(t => t.text)
        .join('\n---\n');

    if (!combinedText.trim()) {
        return [];
    }

    const prompt = `Extract all movie and TV show titles mentioned in the following Reddit posts/comments.
These are from movie recommendation subreddits, so users are recommending films to watch.

For each title found, return:
- title: The exact movie/show name
- year: Release year if mentioned, otherwise null
- mediaType: "movie" if it's clearly a film, "tv" if it's clearly a series/show/season, "unknown" if unclear
- sentiment: "positive" if recommended/praised, "negative" if criticized, "neutral" otherwise

If no titles are found, return an empty movies array.

Text to analyze:
${combinedText}`;

    const threadOptions = {
        sandboxMode: 'read-only',
        approvalPolicy: 'never',
        skipGitRepoCheck: true,
        networkAccessEnabled: false,
        webSearchEnabled: false,
    };
    if (CODEX_MODEL) {
        threadOptions.model = CODEX_MODEL;
    }

    for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
        try {
            const thread = codex.startThread(threadOptions);
            const turn = await withTimeout(
                () => thread.run(prompt, { outputSchema: MOVIE_EXTRACTION_SCHEMA }),
                AI_TIMEOUT_MS,
                'Codex extraction'
            );

            const raw = (turn.finalResponse || '').trim();
            if (!raw) {
                return [];
            }

            return parseMovieExtractionResponse(raw);
        } catch (error) {
            if (attempt < AI_MAX_RETRIES) {
                const delayMs = getRetryDelayMs(attempt);
                console.warn(
                    `  Codex extraction failed (${attempt + 1}/${AI_MAX_RETRIES + 1}): ${error.message}. Retrying in ${(delayMs / 1000).toFixed(1)}s...`
                );
                await sleep(delayMs);
                continue;
            }

            console.error(`  Codex extraction error: ${error.message}`);
            return [];
        }
    }

    return [];
}

async function extractMoviesWithGemini(texts) {
    const combinedText = texts.map(t => t.text).join('\n---\n');
    if (!combinedText.trim()) return [];

    const prompt = `Extract all movie and TV show titles mentioned in the following Reddit posts/comments.
These are from movie recommendation subreddits, so users are recommending films to watch.

For each title found, return:
- title: The exact movie/show name
- year: Release year if mentioned, otherwise null
- sentiment: "positive" if recommended/praised, "negative" if criticized, "neutral" otherwise

Return ONLY valid JSON with this exact structure, no other text:
{"movies": [{"title": "string", "year": number_or_null, "mediaType": "movie|tv|unknown", "sentiment": "positive|negative|neutral"}]}

If no titles are found, return {"movies": []}.

Text to analyze:
${combinedText}`;

    const args = ['-p', prompt, '-o', 'json', '-y'];
    if (GEMINI_MODEL) args.push('-m', GEMINI_MODEL);

    for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
        try {
            const { stdout } = await withTimeout(
                () => execFileAsync('gemini', args, { maxBuffer: 10 * 1024 * 1024 }),
                AI_TIMEOUT_MS,
                'Gemini CLI extraction'
            );

            const cliOutput = JSON.parse(stdout);
            const raw = (cliOutput.response || '').trim();
            if (!raw) return [];
            return parseMovieExtractionResponse(raw);
        } catch (error) {
            if (attempt < AI_MAX_RETRIES) {
                const delayMs = getRetryDelayMs(attempt);
                console.warn(
                    `  Gemini extraction failed (${attempt + 1}/${AI_MAX_RETRIES + 1}): ${error.message}. Retrying in ${(delayMs / 1000).toFixed(1)}s...`
                );
                await sleep(delayMs);
                continue;
            }
            console.error(`  Gemini extraction error: ${error.message}`);
            return [];
        }
    }

    return [];
}

async function extractMoviesWithAI(texts) {
    return AI_PROVIDER === 'gemini'
        ? extractMoviesWithGemini(texts)
        : extractMoviesWithCodex(texts);
}

/**
 * Batch texts for AI processing to reduce API calls
 * Groups texts into configurable sized batches
 */
function normalizeTextForAI(text) {
    if (typeof text !== 'string') {
        return '';
    }

    const maxCharsPerItem = Math.min(AI_TEXT_CHARS_PER_ITEM, AI_PROMPT_TEXT_BUDGET_CHARS);
    return text.substring(0, maxCharsPerItem).trim();
}

function batchTextsForAI(posts, comments) {
    const allTexts = [];
    
    // Add post titles and bodies
    for (const post of posts) {
        if (post.title) {
            const titleText = normalizeTextForAI(post.title);
            if (titleText) {
                allTexts.push({ text: titleText, score: post.score, postId: post.id, postTitle: post.title, subreddit: post.subreddit });
            }
        }
        if (post.selftext && post.selftext.length > 20) {
            const selfText = normalizeTextForAI(post.selftext);
            if (selfText) {
                allTexts.push({ text: selfText, score: post.score, postId: post.id, postTitle: post.title, subreddit: post.subreddit });
            }
        }
    }
    
    // Add comments
    for (const comment of comments) {
        if (comment.body && comment.body.length > 10) {
            const commentText = normalizeTextForAI(comment.body);
            if (commentText) {
                allTexts.push({ 
                    text: commentText, 
                    score: comment.score, 
                    postId: comment.postId, 
                    postTitle: comment.postTitle,
                    subreddit: comment.subreddit,
                });
            }
        }
    }
    
    // Batch by both item count and prompt character budget
    const batches = [];
    const separatorLength = '\n---\n'.length;
    let currentBatch = [];
    let currentBatchChars = 0;

    for (const item of allTexts) {
        const itemChars = item.text.length;
        const additionalChars = currentBatch.length === 0 ? itemChars : separatorLength + itemChars;
        const exceedsCount = currentBatch.length >= AI_BATCH_SIZE;
        const exceedsChars = currentBatch.length > 0 && (currentBatchChars + additionalChars > AI_PROMPT_TEXT_BUDGET_CHARS);

        if (exceedsCount || exceedsChars) {
            batches.push(currentBatch);
            currentBatch = [];
            currentBatchChars = 0;
        }

        const charsToAdd = currentBatch.length === 0 ? itemChars : separatorLength + itemChars;
        currentBatch.push(item);
        currentBatchChars += charsToAdd;
    }

    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }
    
    return batches;
}

function getSourceMeta(postInfo = {}) {
    const subreddit = postInfo.subreddit || 'unknown';
    const postId = postInfo.postId || 'unknown';
    const postTitle = postInfo.postTitle || '';
    const sourceKey = `${String(subreddit).toLowerCase()}|${String(postId)}|${String(postTitle).toLowerCase()}`;

    return { subreddit, postId, postTitle, sourceKey };
}

function addMovieMention(allMentions, movie, avgScore, postInfo) {
    const key = movie.title.toLowerCase().trim();
    const sourceMeta = getSourceMeta(postInfo);

    if (allMentions.has(key)) {
        const existing = allMentions.get(key);
        existing.count++;
        existing.totalScore += avgScore;

        if (movie.sentiment === 'positive') {
            existing.sentiment = 'positive';
        }

        const hasBetterSource = avgScore > existing.sourceScore;
        const isSameScoreButBetterTiebreak =
            avgScore === existing.sourceScore && sourceMeta.sourceKey < existing.sourceKey;

        if (hasBetterSource || isSameScoreButBetterTiebreak) {
            existing.subreddit = sourceMeta.subreddit;
            existing.postId = sourceMeta.postId;
            existing.postTitle = sourceMeta.postTitle;
            existing.sourceScore = avgScore;
            existing.sourceKey = sourceMeta.sourceKey;

            if (movie.year !== null && movie.year !== undefined) {
                existing.year = movie.year;
            }
        } else if ((existing.year === null || existing.year === undefined) && movie.year !== null && movie.year !== undefined) {
            existing.year = movie.year;
        }

        return;
    }

    allMentions.set(key, {
        title: movie.title,
        year: movie.year,
        mediaType: movie.mediaType || 'unknown',
        sentiment: movie.sentiment || 'neutral',
        subreddit: sourceMeta.subreddit,
        postId: sourceMeta.postId,
        postTitle: sourceMeta.postTitle,
        count: 1,
        totalScore: avgScore,
        sourceScore: avgScore,
        sourceKey: sourceMeta.sourceKey,
    });
}

// ============================================================================
// TMDB INTEGRATION
// ============================================================================

function selectBestTMDBResult(results, year, mediaType) {
    if (!results?.length) return null;

    const dateField = mediaType === 'tv' ? 'first_air_date' : 'release_date';

    // Prefer results with at least one vote so we avoid placeholder/stub entries
    const pool = results.filter(r => (r.vote_count || 0) >= 1);
    const candidates = pool.length > 0 ? pool : results;

    if (!year) {
        // No year hint: take the most popular result (TMDB already ranks by relevance+popularity)
        return candidates[0];
    }

    // Find exact year match(es) and pick the one with most votes
    const exactMatches = candidates.filter(r => {
        const y = parseInt((r[dateField] || '').slice(0, 4), 10);
        return y === year;
    });
    if (exactMatches.length > 0) {
        return exactMatches.reduce((a, b) => (b.vote_count || 0) > (a.vote_count || 0) ? b : a);
    }

    // No exact match: pick the result with the closest release year
    return candidates.reduce((best, curr) => {
        const bestY = parseInt((best[dateField] || '').slice(0, 4), 10) || 0;
        const currY = parseInt((curr[dateField] || '').slice(0, 4), 10) || 0;
        return Math.abs(currY - year) < Math.abs(bestY - year) ? curr : best;
    });
}

async function searchTMDBEndpoint(title, year, mediaType, apiKey, baseUrl) {
    const yearParam = mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year';

    const buildUrl = (withYear) => {
        const url = new URL(`${baseUrl}/search/${mediaType}`);
        url.searchParams.append('api_key', apiKey);
        url.searchParams.append('query', title);
        if (withYear && year) url.searchParams.append(yearParam, year.toString());
        return url.toString();
    };

    // Try with year first for a tighter match
    if (year) {
        const data = await fetchTMDBJson(buildUrl(true));
        const best = selectBestTMDBResult(data?.results, year, mediaType);
        if (best) {
            const canonicalTitle = best.title || best.name || title;
            const canonicalYear = parseInt((best.release_date || best.first_air_date || '').slice(0, 4), 10) || year;
            return { tmdbId: best.id.toString(), mediaType, canonicalTitle, canonicalYear };
        }
    }

    // Fall back without year filter
    const data = await fetchTMDBJson(buildUrl(false));
    const best = selectBestTMDBResult(data?.results, year, mediaType);
    if (best) {
        const canonicalTitle = best.title || best.name || title;
        const canonicalYear = parseInt((best.release_date || best.first_air_date || '').slice(0, 4), 10) || year || null;
        return { tmdbId: best.id.toString(), mediaType, canonicalTitle, canonicalYear };
    }

    return null;
}

async function searchTMDB(title, year, mediaTypeHint = 'unknown') {
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';

    if (!TMDB_API_KEY) return null;

    // Route by hint: if explicitly tv, try tv first; otherwise movie → tv
    const endpoints = mediaTypeHint === 'tv' ? ['tv', 'movie'] : ['movie', 'tv'];

    try {
        for (const endpoint of endpoints) {
            const result = await searchTMDBEndpoint(title, year, endpoint, TMDB_API_KEY, TMDB_BASE_URL);
            if (result) return result;
        }
        return null;
    } catch (error) {
        console.error(`Error searching TMDB for "${title}":`, error.message);
        return null;
    }
}

// ============================================================================
// MAIN SCRAPING LOGIC
// ============================================================================

let redditCache = null;

function getRedditCache() {
    if (!redditCache) {
        redditCache = readCache();
    }
    return redditCache;
}

async function fetchSubredditPosts(subreddit) {
    let response;

    if (FROM_CACHE) {
        response = getRedditCache().posts[subreddit];
        if (!response) {
            console.warn(`  No cached posts for r/${subreddit}`);
            return [];
        }
    } else {
        const url = `https://www.reddit.com/r/${subreddit}/top.json?t=${TIMEFRAME}&limit=${POSTS_PER_SUBREDDIT}`;
        response = await fetchRedditJson(url);
    }

    if (!response?.data?.children) {
        return [];
    }

    return response.data.children
        .map(child => ({
            id: child.data.id,
            title: child.data.title,
            selftext: child.data.selftext,
            subreddit: child.data.subreddit,
            score: child.data.score,
            numComments: child.data.num_comments,
            permalink: child.data.permalink,
            url: `https://www.reddit.com${child.data.permalink}`,
        }))
        .filter(p => p.score >= MIN_SCORE);
}

async function fetchPostComments(subreddit, postId, limit = 50) {
    let response;

    if (FROM_CACHE) {
        response = getRedditCache().comments[`${subreddit}/${postId}`];
        if (!response) {
            console.warn(`  No cached comments for r/${subreddit} post ${postId}`);
            return [];
        }
    } else {
        const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json?limit=${limit}&depth=1&sort=top`;
        response = await fetchRedditJson(url);
    }

    if (!response || !Array.isArray(response) || response.length < 2) {
        return [];
    }

    const comments = [];
    const commentsData = response[1]?.data?.children || [];

    for (const child of commentsData) {
        if (child.kind === 't1' && child.data.body) {
            comments.push({
                id: child.data.id,
                body: child.data.body,
                score: child.data.score || 0,
                author: child.data.author,
            });
        }
    }

    return comments.filter(c => c.score >= 5);
}

// How many posts to fetch comments from (top N by comment count)
const POSTS_TO_FETCH_COMMENTS = 5;

async function scrapeReddit() {
    console.log('Starting Reddit scrape...');

    if (AI_PROVIDER === 'gemini') {
        console.log('  (Gemini CLI will use credentials from `gemini auth login`)');
    } else {
        console.log('  (Codex SDK will use credentials from `codex login`)');
    }

    const allPosts = [];
    const allComments = [];
    let totalPostsScraped = 0;
    let totalCommentsScraped = 0;

    // Phase 1: Collect all posts and comments from Reddit
    for (const subreddit of MOVIE_SUBREDDITS) {
        console.log(`  Fetching r/${subreddit}...`);
        
        const posts = await fetchSubredditPosts(subreddit);
        totalPostsScraped += posts.length;
        
        // Add subreddit info to posts
        posts.forEach(p => {
            p.subreddit = subreddit;
            allPosts.push(p);
        });

        // Sort by comment count to find discussion-heavy posts
        const postsForComments = [...posts]
            .sort((a, b) => b.numComments - a.numComments)
            .slice(0, POSTS_TO_FETCH_COMMENTS);

        // Fetch comments from top posts
        for (const post of postsForComments) {
            const comments = await fetchPostComments(subreddit, post.id);
            totalCommentsScraped += comments.length;
            
            // Add post context to comments
            comments.forEach(c => {
                c.postId = post.id;
                c.postTitle = post.title;
                c.subreddit = subreddit;
                allComments.push(c);
            });
            
            await sleep(DELAY_BETWEEN_REQUESTS);
        }

        await sleep(DELAY_BETWEEN_SUBREDDITS);
    }

    console.log(`  Fetched ${totalPostsScraped} posts and ${totalCommentsScraped} comments`);

    // Phase 2: Use AI to extract movie titles from batched texts
    console.log('  Extracting movies with AI...');
    
    const batches = batchTextsForAI(allPosts, allComments);
    console.log(`  Processing ${batches.length} batches (${AI_CONCURRENCY} concurrent, batch size ${AI_BATCH_SIZE})...`);
    
    const allMentions = new Map();
    let batchNum = 0;
    
    let nextBatchIndex = 0;
    const batchWorkers = Array.from({ length: Math.min(AI_CONCURRENCY, batches.length) }, async () => {
        while (true) {
            const currentIndex = nextBatchIndex++;
            if (currentIndex >= batches.length) {
                return;
            }

            const batch = batches[currentIndex];
            const movies = await extractMoviesWithAI(batch);

            const avgScore = batch.reduce((sum, t) => sum + (t.score || 1), 0) / batch.length;
            const postInfo = batch[0];

            for (const movie of movies) {
                addMovieMention(allMentions, movie, avgScore, postInfo);
            }

            batchNum++;
            if (batchNum % 5 === 0 || batchNum === batches.length) {
                console.log(`    Batch ${batchNum}/${batches.length} - Found ${allMentions.size} unique movies so far`);
            }

            if (AI_BATCH_DELAY_MS > 0) {
                await sleep(AI_BATCH_DELAY_MS);
            }
        }
    });

    await Promise.all(batchWorkers);

    console.log(`  AI extracted ${allMentions.size} unique movie/show titles`);

    // Phase 3: Validate against TMDB
    const sortedMentions = Array.from(allMentions.entries())
        .sort((a, b) => (b[1].count * b[1].totalScore) - (a[1].count * a[1].totalScore));
    const mentionsToValidate = TMDB_VALIDATE_LIMIT > 0
        ? sortedMentions.slice(0, TMDB_VALIDATE_LIMIT)
        : sortedMentions;

    console.log(`  Validating ${mentionsToValidate.length} titles against TMDB (${TMDB_CONCURRENCY} concurrent, ${TMDB_RPS.toFixed(1)} req/s cap)...`);
    let checkedCount = 0;
    let matchedCount = 0;
    const recommendationsByIndex = new Array(mentionsToValidate.length).fill(null);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(TMDB_CONCURRENCY, mentionsToValidate.length) }, async () => {
        while (true) {
            const currentIndex = nextIndex++;
            if (currentIndex >= mentionsToValidate.length) {
                return;
            }

            const [_key, data] = mentionsToValidate[currentIndex];
            const tmdbResult = await searchTMDB(data.title, data.year, data.mediaType);

            checkedCount++;

            if (tmdbResult) {
                matchedCount++;
                recommendationsByIndex[currentIndex] = {
                    id: generateId(15),
                    title: tmdbResult.canonicalTitle,
                    tmdbId: tmdbResult.tmdbId,
                    releaseYear: tmdbResult.canonicalYear,
                    mediaType: tmdbResult.mediaType,
                    subreddit: data.subreddit,
                    postId: data.postId,
                    postTitle: data.postTitle,
                    mentionCount: data.count,
                    totalScore: Math.round(data.totalScore),
                    sentiment: data.sentiment,
                    genres: [],
                };
            }

            if (checkedCount % 25 === 0 || checkedCount === mentionsToValidate.length) {
                console.log(`    Checked ${checkedCount}/${mentionsToValidate.length}, found ${matchedCount} valid...`);
            }
        }
    });

    await Promise.all(workers);

    const recommendations = recommendationsByIndex.filter(Boolean);
    console.log(`  Validated ${matchedCount}/${mentionsToValidate.length} as real movies/shows`);

    return recommendations;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function saveToDatabase(recommendations) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL is not defined');
        return 0;
    }

    const sql = neon(databaseUrl);
    let savedCount = 0;

    for (const rec of recommendations) {
        try {
            await sql`
                INSERT INTO reddit_recommendations (
                    id, title, tmdb_id, release_year, media_type, subreddit, post_id, post_title,
                    mention_count, total_score, sentiment, genres, scraped_at, updated_at
                ) VALUES (
                    ${rec.id}, ${rec.title}, ${rec.tmdbId}, ${rec.releaseYear ?? null}, ${rec.mediaType},
                    ${rec.subreddit}, ${rec.postId}, ${rec.postTitle},
                    ${rec.mentionCount}, ${rec.totalScore}, ${rec.sentiment},
                    ${JSON.stringify(rec.genres)}, NOW(), NOW()
                )
                ON CONFLICT (tmdb_id) WHERE tmdb_id IS NOT NULL DO UPDATE SET
                    title = EXCLUDED.title,
                    release_year = EXCLUDED.release_year,
                    mention_count = GREATEST(reddit_recommendations.mention_count, EXCLUDED.mention_count),
                    total_score = GREATEST(reddit_recommendations.total_score, EXCLUDED.total_score),
                    sentiment = EXCLUDED.sentiment,
                    genres = EXCLUDED.genres,
                    updated_at = NOW()
            `;
            savedCount++;
        } catch (error) {
            console.error(`  Error saving "${rec.title}":`, error.message);
        }
    }

    // Update scrape metadata (store subreddits hash in items_scraped for cache invalidation)
    try {
        const metaId = generateId(15);
        await sql`
            INSERT INTO scrape_metadata (id, scrape_type, last_scraped_at, items_scraped)
            VALUES (${metaId}, 'reddit_recommendations', NOW(), ${SUBREDDITS_HASH})
            ON CONFLICT (scrape_type) DO UPDATE SET
                last_scraped_at = NOW(),
                items_scraped = ${SUBREDDITS_HASH}
        `;
    } catch (error) {
        console.error('  Error updating scrape metadata:', error.message);
    }

    return savedCount;
}

// ============================================================================
// CACHE CHECK
// ============================================================================

/**
 * Check if the cache is still valid
 * Cache is invalidated if:
 * 1. No previous scrape exists
 * 2. Last scrape is older than CACHE_TTL_HOURS
 * 3. Subreddit list has changed since last scrape
 */
async function isCacheValid() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        return { valid: false, reason: 'No database URL' };
    }

    try {
        const sql = neon(databaseUrl);
        
        // items_scraped column stores the subreddits hash from last scrape
        const result = await sql`
            SELECT last_scraped_at, items_scraped 
            FROM scrape_metadata 
            WHERE scrape_type = 'reddit_recommendations'
        `;

        if (result.length === 0) {
            return { valid: false, reason: 'No previous scrape found' };
        }

        const lastScrapedAt = new Date(result[0].last_scraped_at);
        const lastSubredditsHash = result[0].items_scraped;
        const now = new Date();
        const hoursSinceLastScrape = (now - lastScrapedAt) / (1000 * 60 * 60);

        console.log(`  Last scraped: ${lastScrapedAt.toISOString()}`);
        console.log(`  Hours since last scrape: ${hoursSinceLastScrape.toFixed(1)}`);
        console.log(`  Cache TTL: ${CACHE_TTL_HOURS} hours (${(CACHE_TTL_HOURS / 24).toFixed(1)} days)`);
        
        // Check if subreddit list has changed
        if (lastSubredditsHash && lastSubredditsHash !== SUBREDDITS_HASH) {
            console.log(`  Previous subreddits: ${lastSubredditsHash}`);
            console.log(`  Current subreddits: ${SUBREDDITS_HASH}`);
            return { valid: false, reason: 'Subreddit list has changed' };
        }

        // Check if cache has expired
        if (hoursSinceLastScrape >= CACHE_TTL_HOURS) {
            return { valid: false, reason: `Cache expired (${hoursSinceLastScrape.toFixed(1)}h > ${CACHE_TTL_HOURS}h)` };
        }

        return { valid: true, reason: 'Cache is valid' };
    } catch (error) {
        console.error('  Error checking cache:', error.message);
        return { valid: false, reason: `Error: ${error.message}` };
    }
}

// ============================================================================
// MAIN
// ============================================================================

// Detect CI environment
const IS_CI = !!(process.env.CI || process.env.VERCEL || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI);
const REDDIT_SCRAPE_IN_CI = process.env.REDDIT_SCRAPE_IN_CI === 'true';

async function main() {
    if (LIST_POST_URLS) {
        listPostUrls();
        return;
    }

    if (LIST_COMMENT_URLS) {
        listCommentUrls();
        return;
    }

    const aiTimeoutLabel = AI_TIMEOUT_MS > 0 ? `${AI_TIMEOUT_MS}ms` : 'off';

    console.log('=== Reddit Recommendations Scraper ===\n');
    console.log('Configuration:');
    console.log(`  Subreddits: ${MOVIE_SUBREDDITS.join(', ')}`);
    console.log(`  Posts per subreddit: ${POSTS_PER_SUBREDDIT}`);
    console.log(`  Min score: ${MIN_SCORE}`);
    console.log(`  Timeframe: ${TIMEFRAME}`);
    const geminiModelLabel = GEMINI_MODEL || 'cli-default';
    console.log(`  AI extraction: provider=${AI_PROVIDER}${AI_PROVIDER === 'gemini' ? ` (model=${geminiModelLabel})` : ''}, batch=${AI_BATCH_SIZE}, concurrency=${AI_CONCURRENCY}, promptChars=${AI_PROMPT_TEXT_BUDGET_CHARS}, timeout=${aiTimeoutLabel}, retries=${AI_MAX_RETRIES}`);
    console.log(`  TMDB validation: limit=${TMDB_VALIDATE_LIMIT === 0 ? 'all' : TMDB_VALIDATE_LIMIT}, concurrency=${TMDB_CONCURRENCY}, rps=${TMDB_RPS.toFixed(1)}, retries=${TMDB_MAX_RETRIES}`);
    console.log(`  Cache TTL: ${CACHE_TTL_HOURS} hours`);
    console.log(`  Force scrape: ${FORCE_SCRAPE}`);
    console.log(`  CI environment: ${IS_CI ? 'Yes' : 'No'}`);
    console.log('');

    if (IS_CI && !REDDIT_SCRAPE_IN_CI) {
        console.log('=== Skipping Scrape (CI Environment) ===');
        console.log('  Reddit scrape is disabled in CI to keep builds fast and stable.');
        console.log('  Set REDDIT_SCRAPE_IN_CI=true to enable scraping in CI.');
        return;
    }

    // Check cache unless --force is used
    if (!FORCE_SCRAPE) {
        console.log('Checking cache...');
        const cacheStatus = await isCacheValid();
        
        if (cacheStatus.valid) {
            console.log('\n=== Skipping Scrape (Cache Valid) ===');
            console.log('  Use --force to bypass cache check');
            return;
        }
        console.log(`  Cache invalid: ${cacheStatus.reason}`);
        console.log('  Proceeding with scrape...\n');
    } else {
        console.log('Force scrape enabled, bypassing cache check\n');
    }
    
    const startTime = Date.now();
    
    try {
        const recommendations = await scrapeReddit();
        
        // Check if Reddit blocked us (403 from datacenter IP)
        if (redditBlocked) {
            console.log('\n=== Scrape Skipped (Reddit Blocked) ===');
            console.log('  Reddit returned 403 Forbidden - this is common in CI environments');
            console.log('  Datacenter IPs (Vercel, AWS, etc.) are often blocked by Reddit');
            console.log('  ');
            console.log('  To populate Reddit recommendations:');
            console.log('  1. Run locally: npm run scrape:reddit');
            console.log('  2. Or use Reddit OAuth API (more reliable but requires setup)');
            console.log('  ');
            console.log('  Build will continue - existing cached data (if any) will be used.');
            // Exit successfully - don't fail the build
            return;
        }
        
        if (recommendations.length === 0) {
            console.log('\n=== No Recommendations Found ===');
            console.log('  No movie/show titles could be extracted.');
            console.log('  Build will continue without new Reddit data.');
            return;
        }
        
        console.log('\n  Saving to database...');
        const savedCount = await saveToDatabase(recommendations);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n=== Scrape Complete ===`);
        console.log(`  Saved: ${savedCount} recommendations`);
        console.log(`  Duration: ${duration}s`);
        
    } catch (error) {
        // In CI, don't fail the build for scrape errors
        if (IS_CI) {
            console.error('\n=== Scrape Failed (Non-Blocking) ===');
            console.error(`  Error: ${error.message}`);
            console.error('  Build will continue - existing cached data (if any) will be used.');
            console.error('  To populate Reddit recommendations, run locally: npm run scrape:reddit');
            // Exit successfully - don't fail the build
            return;
        }
        
        // Outside CI, fail as expected
        console.error('Scrape failed:', error);
        process.exit(1);
    }
}

main();
