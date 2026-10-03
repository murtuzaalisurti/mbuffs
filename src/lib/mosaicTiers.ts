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
 * Picks a tile size for each title from its rating: the best rated fifth (at
 * least MIN_HIGHLIGHT_RATING) get large tiles. Equal ratings keep list order.
 */
export function rankMosaicTiers(ratings: Array<number | null>): MosaicTier[] {
  const largeCount = Math.max(1, Math.round(ratings.length * LARGE_SHARE));
  const tiers = new Array<MosaicTier>(ratings.length).fill("small");

  ratings
    .map((rating, index) => ({ rating, index }))
    .filter((entry): entry is { rating: number; index: number } =>
      entry.rating !== null && entry.rating >= MIN_HIGHLIGHT_RATING
    )
    .sort((a, b) => b.rating - a.rating || a.index - b.index)
    .slice(0, largeCount)
    .forEach(({ index }) => {
      tiers[index] = "large";
    });

  return tiers;
}
