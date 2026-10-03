import { Movie } from "@/lib/types";

export type MosaicTier = "large" | "small";

/** Share of titles that can get a 2x2 tile */
const LARGE_SHARE = 0.2;
/** Only titles rated at least this well (out of 10) are highlighted */
const MIN_HIGHLIGHT_RATING = 7;
/** TMDB averages from fewer votes than this are too noisy to trust */
const MIN_TMDB_VOTES = 50;

/**
 * Best available rating out of 10: the average of IMDb and Rotten Tomatoes (a
 * percentage) when both exist, else whichever one does, then the TMDB vote
 * average when it has enough votes. Null when unrated.
 */
export function bestRating(
  movie: Pick<Movie, "imdb_rating" | "vote_average" | "vote_count">,
  rottenTomatoesRating?: number | null
): number | null {
  const imdb = typeof movie.imdb_rating === "number" ? movie.imdb_rating : null;
  const rottenTomatoes = typeof rottenTomatoesRating === "number" ? rottenTomatoesRating / 10 : null;
  if (imdb !== null && rottenTomatoes !== null) return (imdb + rottenTomatoes) / 2;
  if (imdb !== null) return imdb;
  if (rottenTomatoes !== null) return rottenTomatoes;
  if (movie.vote_average > 0 && (movie.vote_count ?? 0) >= MIN_TMDB_VOTES) return movie.vote_average;
  return null;
}

/**
 * Picks a tile size for each title. The score averages two 0-1 parts: rating
 * percentile among the rated titles, and trendiness from list position (TMDB
 * returns trending ranked). The top fifth by score get large tiles; titles
 * rated below MIN_HIGHLIGHT_RATING, or unrated, never do.
 */
export function rankMosaicTiers(ratings: Array<number | null>): MosaicTier[] {
  const count = ratings.length;
  const largeCount = Math.max(1, Math.round(count * LARGE_SHARE));
  const tiers = new Array<MosaicTier>(count).fill("small");

  const rated = ratings.filter((rating): rating is number => rating !== null);
  const ratingPercentile = (rating: number) =>
    rated.length < 2 ? 1 : rated.filter((other) => other < rating).length / (rated.length - 1);
  const trendiness = (index: number) => (count < 2 ? 1 : 1 - index / (count - 1));

  ratings
    .map((rating, index) => ({ rating, index }))
    .filter((entry): entry is { rating: number; index: number } =>
      entry.rating !== null && entry.rating >= MIN_HIGHLIGHT_RATING
    )
    .map((entry) => ({ ...entry, score: (ratingPercentile(entry.rating) + trendiness(entry.index)) / 2 }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, largeCount)
    .forEach(({ index }) => {
      tiers[index] = "large";
    });

  return tiers;
}
