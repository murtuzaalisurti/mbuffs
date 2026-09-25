// Shared-element "poster → detail" transition.
//
// A card only names its poster at the moment it is clicked, so the page never
// holds two elements with the same view-transition-name (the same title can
// appear in several rails at once). The detail page, including its loading
// state, names its poster the same way so the browser can morph between them.

export type PosterLinkState = {
  /** Poster already shown on the card, so the detail page can paint it instantly. */
  posterPath?: string | null;
};

export const posterTransitionName = (mediaType: string, mediaId: string | number) =>
  `poster-${mediaType}-${mediaId}`;

let detailPagePreload: Promise<unknown> | null = null;

/** Warm the detail route's chunk so the transition lands on the page, not the Suspense fallback. */
export const preloadMediaDetail = () => {
  detailPagePreload ??= import('@/pages/MovieDetail').catch(() => {
    detailPagePreload = null;
  });
  return detailPagePreload;
};
