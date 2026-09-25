import { useQuery } from '@tanstack/react-query';
import { fetchUserRegion } from '@/lib/api';

const REGION_STORAGE_KEY = 'mbuffs_region_v1';
const REGION_STALE_TIME_MS = 12 * 60 * 60 * 1000;

const readStoredRegion = (): string | undefined => {
    try {
        return localStorage.getItem(REGION_STORAGE_KEY) ?? undefined;
    } catch {
        return undefined;
    }
};

const storeRegion = (region: string) => {
    try {
        localStorage.setItem(REGION_STORAGE_KEY, region);
    } catch {
        // Storage unavailable (private mode, quota) — region just won't persist.
    }
};

/**
 * The visitor's country code, shared by every region-dependent query.
 *
 * Returning visitors get the region remembered from their last visit
 * immediately, so region-dependent queries (e.g. Now Playing) don't wait on a
 * lookup before starting. The stored value is treated as stale and refreshed in
 * the background; only a first visit waits for the lookup.
 */
export const useUserRegion = () =>
    useQuery({
        queryKey: ['userRegion'],
        queryFn: async () => {
            const region = await fetchUserRegion();
            storeRegion(region);
            return region;
        },
        initialData: readStoredRegion,
        initialDataUpdatedAt: 0,
        staleTime: REGION_STALE_TIME_MS,
    });
