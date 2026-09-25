import { useEffect, useState, useSyncExternalStore } from 'react';
import { getImageUrl } from '@/lib/api';

// "The poster lights the room": pages report the artwork on screen, and a
// single persistent glow (AmbientGlow) tints the page with its colour. Keeping
// one glow for the whole app lets the colour cross-fade from film to film.

type AmbientState = {
  /** Last colour shown; kept after the light goes out so the fade doesn't shift hue. */
  color: string | null;
  lit: boolean;
};

let ambientState: AmbientState = { color: null, lit: false };
const listeners = new Set<() => void>();

const setAmbientColor = (color: string | null) => {
  const next = color ? { color, lit: true } : { color: ambientState.color, lit: false };
  if (next.color === ambientState.color && next.lit === ambientState.lit) return;
  ambientState = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const serverState: AmbientState = { color: null, lit: false };

export const useAmbientState = () => useSyncExternalStore(subscribe, () => ambientState, () => serverState);

const colorCache = new Map<string, string | null>();

/**
 * Average the most colourful pixels of a tiny thumbnail, then settle the
 * result to a mid lightness so every film glows at a similar strength.
 */
const sampleImageColor = (src: string) =>
  new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const width = 12;
        const height = 18;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return resolve(null);
        context.drawImage(img, 0, 0, width, height);
        const { data } = context.getImageData(0, 0, width, height);

        let r = 0;
        let g = 0;
        let b = 0;
        let weightSum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const max = Math.max(data[i], data[i + 1], data[i + 2]);
          const min = Math.min(data[i], data[i + 1], data[i + 2]);
          // Favour saturated pixels; near-greys and near-blacks barely count
          const weight = (max - min) / 255 + 0.02;
          r += data[i] * weight;
          g += data[i + 1] * weight;
          b += data[i + 2] * weight;
          weightSum += weight;
        }
        if (weightSum === 0) return resolve(null);

        const [h, s] = rgbToHsl(r / weightSum, g / weightSum, b / weightSum);
        resolve(`hsl(${Math.round(h)} ${Math.round(Math.min(s, 0.65) * 100)}% 42%)`);
      } catch {
        // Tainted canvas (no CORS) — the page simply stays unlit
        resolve(null);
      }
    };
    img.src = src;
  });

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

/**
 * Resolve the ambient colour for a TMDB image path (cached per path).
 * Returns `undefined` while a new image is still being sampled.
 */
export const useImageAmbientColor = (imagePath: string | null | undefined) => {
  const [sampled, setSampled] = useState<{ path: string; color: string | null } | null>(null);

  useEffect(() => {
    if (!imagePath || colorCache.has(imagePath)) return;
    let cancelled = false;
    sampleImageColor(getImageUrl(imagePath, 'w92')).then((color) => {
      colorCache.set(imagePath, color);
      if (!cancelled) setSampled({ path: imagePath, color });
    });
    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  if (!imagePath) return null;
  if (colorCache.has(imagePath)) return colorCache.get(imagePath) ?? null;
  return sampled?.path === imagePath ? sampled.color : undefined;
};

/** Light the room with this image while the calling component is mounted. */
export const useAmbientFromImage = (imagePath: string | null | undefined) => {
  const color = useImageAmbientColor(imagePath);

  useEffect(() => {
    // Keep the previous light on while the next image is sampled
    if (color !== undefined) setAmbientColor(color);
  }, [color]);

  useEffect(() => () => setAmbientColor(null), []);

  return color;
};
