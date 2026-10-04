import { useSyncExternalStore } from 'react';

// Optional region override for this device. By default the app uses the
// region detected from the visitor's IP; the Profile page can pin a country
// instead (e.g. when the detection or browser locale is wrong).

const STORAGE_KEY = 'mbuffs:region';
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

const readOverride = (): string | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && COUNTRY_CODE_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
};

let override: string | null = readOverride();
const listeners = new Set<() => void>();

/** Pin a country code for this device, or pass null to go back to automatic detection. */
export const setRegionOverride = (next: string | null) => {
  override = next && COUNTRY_CODE_PATTERN.test(next) ? next : null;
  try {
    if (override) localStorage.setItem(STORAGE_KEY, override);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): the choice still applies for this visit
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The pinned country code for this device, or null when following detection. */
export const useRegionOverride = () => useSyncExternalStore(subscribe, () => override, () => null);
