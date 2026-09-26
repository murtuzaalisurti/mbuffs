import { useSyncExternalStore } from 'react';

// One switch for motion across the app. By default it follows the device's
// "reduce motion" setting; the Profile page can override it either way for
// this device. The effective value is mirrored to <html data-motion> so CSS
// can react (an inline script in index.html sets it before first paint).

export type MotionSetting = 'system' | 'reduce' | 'full';

const STORAGE_KEY = 'mbuffs:motion';
const systemQuery = () => window.matchMedia('(prefers-reduced-motion: reduce)');

const readSetting = (): MotionSetting => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'reduce' || value === 'full' ? value : 'system';
  } catch {
    return 'system';
  }
};

let setting: MotionSetting = readSetting();
const listeners = new Set<() => void>();

const effectiveReduced = () => setting === 'reduce' || (setting === 'system' && systemQuery().matches);

const apply = () => {
  document.documentElement.dataset.motion = effectiveReduced() ? 'reduce' : 'full';
  listeners.forEach((listener) => listener());
};

/** Call once at startup: applies the setting and follows device changes while on "system". */
export const installMotionPreference = () => {
  apply();
  systemQuery().addEventListener('change', () => {
    if (setting === 'system') apply();
  });
};

export const setMotionSetting = (next: MotionSetting) => {
  setting = next;
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage unavailable (private mode): the choice still applies for this visit
  }
  apply();
};

/** Whether the device itself asks for reduced motion (ignoring the app override). */
export const systemPrefersReducedMotion = () => systemQuery().matches;

/** True when motion should be reduced, whether by the device or the app setting. */
export const prefersReducedMotion = () => effectiveReduced();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The stored setting and its effective result, kept in sync for the settings UI. */
export const useMotionSetting = () => {
  const current = useSyncExternalStore(subscribe, () => setting, () => 'system' as MotionSetting);
  const reduced = useSyncExternalStore(subscribe, effectiveReduced, () => false);
  return { setting: current, reduced };
};
