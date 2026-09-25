// Images fade in once they are fully loaded *and decoded*, instead of popping
// in (or painting top-down) the moment bytes arrive. Images that are already
// available when they appear (memory-cached, e.g. on back navigation or the
// poster a view transition lands on) show at once, so nothing flickers.
//
// Works app-wide by watching the DOM, so individual <img> tags need no changes.
// CSS in index.css hides `[data-img-pending]` and animates `[data-img-fade]`.

const PENDING = 'data-img-pending';
const FADE = 'data-img-fade';

const reveal = (img: HTMLImageElement) => {
  if (!img.hasAttribute(PENDING)) return;
  img.removeAttribute(PENDING);
  img.setAttribute(FADE, '');
};

const track = (img: HTMLImageElement) => {
  // The home collage runs its own staggered fade
  if (img.classList.contains('collage-poster')) return;

  img.removeAttribute(FADE);
  if (img.complete && img.naturalWidth > 0) {
    img.removeAttribute(PENDING);
    return;
  }

  img.setAttribute(PENDING, '');
  // Reveal only once decoded, so the image never paints half-drawn
  img.addEventListener('load', () => img.decode().catch(() => {}).finally(() => reveal(img)), { once: true });
  // A broken image shouldn't stay invisible (alt text, onError fallbacks)
  img.addEventListener('error', () => reveal(img), { once: true });
};

export const installImageFadeIn = () => {
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.target instanceof HTMLImageElement) track(record.target);
        continue;
      }
      for (const node of record.addedNodes) {
        if (node instanceof HTMLImageElement) track(node);
        else if (node instanceof Element) node.querySelectorAll('img').forEach(track);
      }
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset'],
  });
  document.querySelectorAll('img').forEach(track);
};
