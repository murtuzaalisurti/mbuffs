import { describe, expect, it } from "vitest";
import { bestRating, rankMosaicTiers } from "./mosaicTiers";

describe("bestRating", () => {
  const movie = { vote_average: 6.5, vote_count: 500 };

  it("averages IMDb and Rotten Tomatoes, else uses either, then TMDB", () => {
    expect(bestRating({ ...movie, imdb_rating: 7.9 }, 93)).toBeCloseTo(8.6);
    expect(bestRating({ ...movie, imdb_rating: 8.1 })).toBe(8.1);
    expect(bestRating(movie, 92)).toBe(9.2);
    expect(bestRating(movie)).toBe(6.5);
  });

  it("ignores TMDB averages with too few votes", () => {
    expect(bestRating({ vote_average: 9.8, vote_count: 3 })).toBeNull();
  });
});

describe("rankMosaicTiers", () => {
  it("handles an empty list", () => {
    expect(rankMosaicTiers([])).toEqual([]);
  });

  it("gives large tiles to the best rated fifth", () => {
    const ratings = Array.from({ length: 50 }, (_, i) => 7 + (i % 30) / 10);
    const tiers = rankMosaicTiers(ratings);
    expect(tiers.filter((t) => t === "large")).toHaveLength(10);
    expect(tiers[29]).toBe("large"); // 9.9, the top rating
  });

  it("never highlights poorly rated or unrated titles", () => {
    expect(rankMosaicTiers([6.9, null, 5, 7.2])).toEqual(["small", "small", "small", "large"]);
  });
});
