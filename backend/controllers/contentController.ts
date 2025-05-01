import { Request, Response, NextFunction } from 'express';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL;

const fetchDetailsFromMoviesAPI = async (req: Request, res: Response, next: NextFunction) => {
    const { endpoint, params = {} } = req.body;
    console.log("TMDB API Request:", { endpoint, params });
    if (!TMDB_API_KEY) {
        throw new Error("TMDB API key (VITE_TMDB_API_KEY) is missing.");
    }
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', TMDB_API_KEY);
    url.searchParams.append('language', 'en-US');
    Object.entries(params as Record<string, string>).forEach(([key, value]) => url.searchParams.append(key, value));

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            let errorData = { status_message: `HTTP error ${response.status}` };
             try {
                const jsonError = await response.json() as Promise<{ status_message: string }>;
                errorData = { ...errorData, ...jsonError };
            } catch (e) { /* Ignore JSON parsing error */ }
            console.error(`TMDB API Error (${response.status}) on ${endpoint}:`, errorData);
            throw new Error(errorData.status_message);
        }
        const responseData = await response.json();
        return res.json(responseData);
    } catch (error) {
        console.error(`TMDB Network or unexpected error on ${endpoint}:`, error);
        next(error);
    }
}

export {
    fetchDetailsFromMoviesAPI
};
