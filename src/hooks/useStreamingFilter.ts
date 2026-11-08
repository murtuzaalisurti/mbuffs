import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchWatchProviderRegionsApi, fetchWatchProvidersForRegionApi } from "@/lib/api";
import { useUserRegion } from "@/hooks/useUserRegion";
import {
  BrandAvailability,
  getAvailableBrands,
  parseStreamingSelection,
  restrictSelectionToAvailable,
  serializeStreamingSelection,
  StreamingSelection,
} from "@/lib/streamingProviders";

const PROVIDERS_PARAM = "providers";
// Per-page region override for the filter; the app-wide region applies otherwise.
const REGION_PARAM = "watch_region";
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const PROVIDER_LIST_STALE_TIME_MS = 24 * 60 * 60 * 1000;

export interface StreamingFilterState {
  /** Region the filter matches against: the override when set, else the app-wide region. */
  region: string | undefined;
  defaultRegion: string | undefined;
  regionOverride: string | null;
  /** Selection limited to brands and offers available in `region`. */
  selection: StreamingSelection;
  /** Stable string for query keys; empty when nothing is selected. */
  selectionKey: string;
  isActive: boolean;
  availableBrands: BrandAvailability[];
  isLoadingProviders: boolean;
  setSelection: (selection: StreamingSelection) => void;
  setRegionOverride: (region: string | null) => void;
  clear: () => void;
}

export const useWatchProviderRegions = (enabled: boolean) =>
  useQuery({
    queryKey: ["watchProviders", "regions"],
    queryFn: fetchWatchProviderRegionsApi,
    staleTime: PROVIDER_LIST_STALE_TIME_MS,
    enabled,
  });

// Streaming filter state, kept in the URL so filtered views can be shared and
// survive back navigation.
export function useStreamingFilter(): StreamingFilterState {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: defaultRegion } = useUserRegion();

  const regionParam = searchParams.get(REGION_PARAM)?.toUpperCase() ?? null;
  const regionOverride = regionParam && COUNTRY_CODE_PATTERN.test(regionParam) ? regionParam : null;
  const region = regionOverride ?? defaultRegion;

  const { data: regionProviders, isLoading: isLoadingProviders } = useQuery({
    queryKey: ["watchProviders", "region", region],
    queryFn: () => fetchWatchProvidersForRegionApi(region!),
    staleTime: PROVIDER_LIST_STALE_TIME_MS,
    enabled: !!region,
  });

  const availableBrands = useMemo(() => getAvailableBrands(regionProviders ?? []), [regionProviders]);

  const providersParam = searchParams.get(PROVIDERS_PARAM);
  // Until the region's list loads, keep the URL selection as-is so filtered
  // queries don't first run unfiltered.
  const selection = useMemo(() => {
    const parsed = parseStreamingSelection(providersParam);
    return regionProviders ? restrictSelectionToAvailable(parsed, availableBrands) : parsed;
  }, [providersParam, regionProviders, availableBrands]);
  const selectionKey = serializeStreamingSelection(selection);

  const updateParams = useCallback(
    (update: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          update(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSelection = useCallback(
    (next: StreamingSelection) => {
      updateParams((params) => {
        const value = serializeStreamingSelection(next);
        if (value) params.set(PROVIDERS_PARAM, value);
        else params.delete(PROVIDERS_PARAM);
      });
    },
    [updateParams],
  );

  const setRegionOverride = useCallback(
    (next: string | null) => {
      updateParams((params) => {
        if (next && next !== defaultRegion) params.set(REGION_PARAM, next);
        else params.delete(REGION_PARAM);
      });
    },
    [updateParams, defaultRegion],
  );

  const clear = useCallback(() => {
    updateParams((params) => {
      params.delete(PROVIDERS_PARAM);
      params.delete(REGION_PARAM);
    });
  }, [updateParams]);

  return {
    region,
    defaultRegion,
    regionOverride,
    selection,
    selectionKey,
    isActive: selectionKey !== "",
    availableBrands,
    isLoadingProviders,
    setSelection,
    setRegionOverride,
    clear,
  };
}
