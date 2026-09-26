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

// The link that started the last morph, so going back can morph into it again.
// Kept as its href plus which copy it was, since a title can appear in several rails.
let returnMorph: { name: string; href: string; index: number } | null = null;

const linksTo = (href: string) => document.querySelectorAll<HTMLElement>(`a[href="${CSS.escape(href)}"]`);

/**
 * Click handler for a link whose `[data-shared-element]` child should morph
 * into the next page. The element is named only when clicked.
 */
export const nameSharedElementOnClick = (name: string) => (event: React.MouseEvent<HTMLElement>) => {
  const link = event.currentTarget;
  const element = link.querySelector<HTMLElement>('[data-shared-element]');
  if (!element) return;
  element.style.viewTransitionName = name;
  const href = link.getAttribute('href');
  if (href) returnMorph = { name, href, index: [...linksTo(href)].indexOf(link) };
};

/**
 * On a back navigation, name the element that started the last morph so the
 * image flies back to where it came from. Called once the page has rendered,
 * before the view transition captures it; the name is cleared once it is done.
 */
export const claimReturnMorph = () => {
  if (!returnMorph) return;
  const { name, href, index } = returnMorph;
  returnMorph = null;
  const element = linksTo(href)[index]?.querySelector<HTMLElement>('[data-shared-element]');
  if (!element) return;
  element.style.viewTransitionName = name;
  setTimeout(() => {
    if (element.style.viewTransitionName === name) element.style.viewTransitionName = '';
  }, 1000);
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
