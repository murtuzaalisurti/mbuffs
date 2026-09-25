// While the page (or a row) is scrolling, cards passing under a resting
// pointer would each lift, glow and zoom in turn, which reads as jitter.
// Marking <html data-scrolling> for the duration lets CSS suspend hover on
// content links until scrolling settles, as native apps do. Only the links
// stop taking the pointer, so rows and the page keep receiving scroll input.

const SETTLE_MS = 150;

export const installScrollHoverGuard = () => {
  const root = document.documentElement;
  let settleTimer: number | undefined;

  addEventListener(
    'scroll',
    () => {
      if (settleTimer === undefined) root.setAttribute('data-scrolling', '');
      else clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        root.removeAttribute('data-scrolling');
        settleTimer = undefined;
      }, SETTLE_MS);
    },
    // Capture, so horizontal rows (which don't bubble scroll) count too
    { passive: true, capture: true }
  );
};
