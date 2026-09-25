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

export type PersonLinkState = {
  /** Profile photo already shown on the link, so the person page can paint it instantly. */
  profilePath?: string | null;
};

export const personTransitionName = (personId: string | number) => `person-${personId}`;

/**
 * Click handler for a link whose `[data-shared-element]` child should morph
 * into the next page. Like cards, it is named only when clicked.
 */
export const nameSharedElementOnClick = (name: string) => (event: React.MouseEvent<HTMLElement>) => {
  const element = event.currentTarget.querySelector<HTMLElement>('[data-shared-element]');
  if (element) element.style.viewTransitionName = name;
};

/** Link props for a plain poster link, so its `[data-shared-element]` poster grows into the detail page. */
export const posterLinkProps = (mediaType: string, mediaId: string | number, posterPath?: string | null) => ({
  viewTransition: true,
  state: { posterPath } satisfies PosterLinkState,
  onClick: nameSharedElementOnClick(posterTransitionName(mediaType, mediaId)),
  onPointerEnter: () => {
    preloadMediaDetail();
  },
});

export const seasonTransitionName = (showId: string | number, seasonNumber: string | number) =>
  `season-${showId}-${seasonNumber}`;
