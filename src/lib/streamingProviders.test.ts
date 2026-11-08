import { describe, expect, it } from "vitest";
import {
  buildDiscoverProviderParams,
  countTitlesByBrand,
  fetchExactDiscoverPage,
  getAvailableBrands,
  getTitleBrandOffers,
  matchesStreamingSelection,
  needsPerTitleProviderCheck,
  parseStreamingSelection,
  restrictSelectionToAvailable,
  serializeStreamingSelection,
  STREAMING_BRANDS,
} from "./streamingProviders";
import { REGION_PROVIDERS, TITLE_PROVIDERS } from "./__fixtures__/watchProviders";

const offersOf = (title: string, region: string) =>
  Object.fromEntries(
    [...getTitleBrandOffers(TITLE_PROVIDERS[title][region]).entries()].map(([brand, offers]) => [brand, [...offers].sort()]),
  );

describe("brand map", () => {
  it("assigns every provider id to exactly one brand", () => {
    const ids = STREAMING_BRANDS.flatMap((brand) => [...brand.streamIds, ...brand.storeIds]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getAvailableBrands", () => {
  it("lists brands present in India, in TMDB display order", () => {
    const brands = getAvailableBrands(REGION_PROVIDERS.IN).map(({ brand }) => brand.id);
    expect(brands.slice(0, 4)).toEqual(["netflix", "prime", "apple", "disney"]);
    expect(brands).toContain("sonyliv");
    expect(brands).not.toContain("hulu");
    expect(brands).not.toContain("hbomax");
  });

  it("offers rent/buy only for brands with a storefront in the region", () => {
    const byId = new Map(getAvailableBrands(REGION_PROVIDERS.US).map((entry) => [entry.brand.id, entry.offers]));
    expect(byId.get("netflix")).toEqual(["stream"]);
    expect(byId.get("prime")).toEqual(["stream", "rent", "buy"]);
    expect(byId.get("apple")).toEqual(["stream", "rent", "buy"]);
    expect(byId.get("googleplay")).toEqual(["rent", "buy"]);
    expect(byId.get("hulu")).toEqual(["stream"]);
  });
});

describe("getTitleBrandOffers", () => {
  it("groups ad tiers, channels and storefronts under their brand", () => {
    // Dune: Part Two in IN streams on Netflix and rents on Amazon Video / Apple TV Store.
    expect(offersOf("movie Dune: Part Two", "IN")).toMatchObject({
      netflix: ["stream"],
      prime: ["rent"],
      apple: ["buy", "rent"],
    });
    // In GB, Netflix appears as both 8 and the ads tier 1796.
    expect(offersOf("movie Dune: Part Two", "GB").netflix).toEqual(["stream"]);
    // In US, HBO Max appears directly (1899) and as an Amazon Channel (1825).
    expect(offersOf("movie Dune: Part Two", "US").hbomax).toEqual(["stream"]);
  });

  it("treats free and ad-supported offers as streaming", () => {
    const result = { link: "", free: [{ provider_id: 613, provider_name: "Prime Free", logo_path: "", display_priority: 0 }] };
    expect([...getTitleBrandOffers(result).get("prime")!]).toEqual(["stream"]);
  });
});

describe("matchesStreamingSelection", () => {
  const oppenheimerIN = TITLE_PROVIDERS["movie Oppenheimer"].IN;

  it("matches everything when nothing is selected", () => {
    expect(matchesStreamingSelection(undefined, {})).toBe(true);
  });

  it("matches any selected brand (OR)", () => {
    expect(matchesStreamingSelection(oppenheimerIN, { netflix: null, disney: null })).toBe(true);
    expect(matchesStreamingSelection(oppenheimerIN, { netflix: null })).toBe(false);
  });

  it("respects the offer type per brand", () => {
    // Oppenheimer in IN: rent on Amazon Video, not on Prime Video subscription.
    expect(matchesStreamingSelection(oppenheimerIN, { prime: ["rent"] })).toBe(true);
    expect(matchesStreamingSelection(oppenheimerIN, { prime: ["stream"] })).toBe(false);
    expect(matchesStreamingSelection(oppenheimerIN, { apple: ["buy"] })).toBe(true);
  });

  it("does not match titles without data for the region", () => {
    expect(matchesStreamingSelection(undefined, { netflix: null })).toBe(false);
  });
});

describe("countTitlesByBrand", () => {
  it("counts each title once per brand", () => {
    const counts = countTitlesByBrand(Object.values(TITLE_PROVIDERS).map((regions) => regions.US));
    // Only One Piece is on Netflix in US (listed as both 8 and 1796).
    expect(counts.netflix).toBe(1);
    expect(counts.crunchyroll).toBe(1);
    // Apple TV Store (2) for four titles plus Severance on Apple TV (350).
    expect(counts.apple).toBe(5);
  });
});

describe("restrictSelectionToAvailable", () => {
  it("drops brands and offers the region lacks", () => {
    const available = getAvailableBrands(REGION_PROVIDERS.IN);
    expect(
      restrictSelectionToAvailable({ hulu: null, netflix: ["rent"], prime: ["stream", "rent", "buy"], apple: ["buy"] }, available),
    ).toEqual({ netflix: null, prime: ["stream", "rent", "buy"], apple: ["buy"] });
  });
});

describe("buildDiscoverProviderParams", () => {
  it("returns null for an empty selection", () => {
    expect(buildDiscoverProviderParams({}, "IN")).toBeNull();
  });

  it("uses subscription ids for streaming and storefront ids for rent/buy", () => {
    expect(buildDiscoverProviderParams({ prime: ["stream"] }, "IN")).toEqual({
      watch_region: "IN",
      with_watch_providers: "9|119|613|2100",
      with_watch_monetization_types: "flatrate|free|ads",
    });
    expect(buildDiscoverProviderParams({ prime: ["rent"] }, "IN")).toEqual({
      watch_region: "IN",
      with_watch_providers: "10",
      with_watch_monetization_types: "rent",
    });
  });

  it("treats picking every offer the same as any", () => {
    expect(buildDiscoverProviderParams({ prime: ["stream", "rent", "buy"] }, "IN")).toEqual(
      buildDiscoverProviderParams({ prime: null }, "IN"),
    );
    expect(needsPerTitleProviderCheck({ prime: ["stream", "rent", "buy"] })).toBe(false);
  });

  it("omits monetization types when every offer is selected", () => {
    expect(buildDiscoverProviderParams({ prime: null, netflix: null }, "US")).toEqual({
      watch_region: "US",
      with_watch_providers: "8|9|10|119|175|613|1796|2100",
    });
  });

  it("ignores offer types a brand cannot have", () => {
    // Netflix has no storefront, so `any` for Netflix only contributes streaming.
    expect(buildDiscoverProviderParams({ netflix: null }, "US")?.with_watch_monetization_types).toBe("flatrate|free|ads");
  });
});

describe("needsPerTitleProviderCheck", () => {
  it("is false when discover provider ids are exact", () => {
    expect(needsPerTitleProviderCheck({})).toBe(false);
    expect(needsPerTitleProviderCheck({ netflix: null, disney: null })).toBe(false);
    expect(needsPerTitleProviderCheck({ prime: ["stream"] })).toBe(false);
    expect(needsPerTitleProviderCheck({ prime: ["rent", "buy"], netflix: null })).toBe(false);
    // Netflix has no storefront, so a stray offer list can't make it inexact.
    expect(needsPerTitleProviderCheck({ netflix: ["rent"] })).toBe(false);
  });

  it("is true when a storefront brand is limited to rent or to buy", () => {
    expect(needsPerTitleProviderCheck({ prime: ["rent"] })).toBe(true);
    expect(needsPerTitleProviderCheck({ netflix: null, apple: ["stream", "buy"] })).toBe(true);
  });
});

describe("fetchExactDiscoverPage", () => {
  // Oppenheimer in IN is rent-only on Amazon Video; Parasite is not on Amazon at all.
  const rentOnAmazon = TITLE_PROVIDERS["movie Oppenheimer"].IN;
  const notOnAmazon = TITLE_PROVIDERS["movie Parasite"].IN;
  const buyOnlyOnAmazon = {
    link: "",
    buy: [{ provider_id: 10, provider_name: "Amazon Video", logo_path: "", display_priority: 0 }],
    rent: [{ provider_id: 2, provider_name: "Apple TV Store", logo_path: "", display_priority: 0 }],
  };

  const makePages = (pages: number[][], totalPages = pages.length) => (page: number) =>
    Promise.resolve({ page, results: (pages[page - 1] ?? []).map((id) => ({ id })), total_pages: totalPages, total_results: 999 });

  const providersFor = (map: Record<number, unknown>) => (ids: number[]) =>
    Promise.resolve(Object.fromEntries(ids.map((id) => [id, (map[id] ?? {}) as never])));

  it("drops titles the store only sells when rent is selected", async () => {
    const result = await fetchExactDiscoverPage({
      startPage: 1,
      selection: { prime: ["rent"] },
      fetchPage: makePages([[1, 2, 3]]),
      fetchProviders: providersFor({ 1: rentOnAmazon, 2: buyOnlyOnAmazon, 3: notOnAmazon }),
    });
    expect(result.results.map((item) => item.id)).toEqual([1]);
    expect(result.page).toBe(1);
  });

  it("pulls following pages when a page is sparse, and resumes after the last one", async () => {
    const result = await fetchExactDiscoverPage({
      startPage: 1,
      selection: { prime: ["rent"] },
      fetchPage: makePages([[1, 2], [3, 4], [5, 6], [7, 8]]),
      fetchProviders: providersFor({ 1: rentOnAmazon, 4: rentOnAmazon, 6: rentOnAmazon, 7: rentOnAmazon }),
      minResults: 3,
      maxPages: 3,
    });
    expect(result.results.map((item) => item.id)).toEqual([1, 4, 6]);
    expect(result.page).toBe(3);
  });

  it("stops at the last discover page", async () => {
    const fetched: number[] = [];
    const fetchPage = makePages([[1], [2]]);
    const result = await fetchExactDiscoverPage({
      startPage: 1,
      selection: { prime: ["rent"] },
      fetchPage: (page) => { fetched.push(page); return fetchPage(page); },
      fetchProviders: providersFor({}),
    });
    expect(fetched).toEqual([1, 2]);
    expect(result.results).toEqual([]);
    expect(result.page).toBe(2);
  });

  it("keeps titles whose provider lookup failed", async () => {
    const result = await fetchExactDiscoverPage({
      startPage: 1,
      selection: { prime: ["rent"] },
      fetchPage: makePages([[1, 2]]),
      fetchProviders: () => Promise.reject(new Error("rate limited")),
    });
    expect(result.results.map((item) => item.id)).toEqual([1, 2]);
  });
});

describe("URL round trip", () => {
  it("parses and serializes, ignoring unknown brands and offers", () => {
    const selection = parseStreamingSelection("prime.rent.buy,bogus,netflix,apple.stream.lease");
    expect(selection).toEqual({ prime: ["rent", "buy"], netflix: null, apple: ["stream"] });
    expect(serializeStreamingSelection(selection)).toBe("netflix,prime.rent.buy,apple.stream");
  });
});
