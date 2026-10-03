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

  it("gives large tiles to the top fifth by rating and trendiness", () => {
    const ratings = Array.from({ length: 50 }, (_, i) => 7 + (i % 30) / 10);
    const tiers = rankMosaicTiers(ratings);
    expect(tiers.filter((t) => t === "large")).toHaveLength(10);
  });

  it("lets a trending title beat a slightly better rated one further down", () => {
    expect(rankMosaicTiers([8.0, 7.0, 7.0, 7.0, 8.2])).toEqual(["large", "small", "small", "small", "small"]);
  });

  it("weights rating over trendiness", () => {
    // Best rated but last beats worst rated but first
    expect(rankMosaicTiers([7.1, 7.2, 7.3, 7.4, 9.5])).toEqual(["small", "small", "small", "small", "large"]);
  });

  it("still lets a much better rated title beat a trending one", () => {
    expect(rankMosaicTiers([7.1, 7.2, 7.3, 9.5, 7.4])).toEqual(["small", "small", "small", "large", "small"]);
  });

  it("never highlights poorly rated or unrated titles", () => {
    expect(rankMosaicTiers([6.9, null, 5, 7.2])).toEqual(["small", "small", "small", "large"]);
  });
});
