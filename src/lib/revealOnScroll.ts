// Sections marked `.reveal` fade up once, the first time they scroll into
// view. The fade is time-based rather than tied to the scroll position, so
// nothing on the page moves at a different speed from the scroll itself (a
// scroll-linked reveal made sections slide against the scroll and cost frames).
//
// Works app-wide by watching the DOM; CSS in index.css hides `.reveal` until
// it gets `data-revealed`, then plays the fade.

export const installRevealOnScroll = () => {
  const intersection = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute('data-revealed', '');
        intersection.unobserve(entry.target);
      }
    },
    // Start just before the section comes into view, so the fade is under way as it appears
    { rootMargin: '0px 0px 10% 0px' }
  );

  const watch = (element: Element) => {
    if (!element.hasAttribute('data-revealed')) intersection.observe(element);
  };

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.classList.contains('reveal')) watch(node);
        node.querySelectorAll('.reveal').forEach(watch);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.querySelectorAll('.reveal').forEach(watch);
};
