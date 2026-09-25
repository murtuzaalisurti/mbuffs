import type { createBrowserRouter } from 'react-router-dom';

// Back/forward should restore a page as it was, not replay its entrance.
// The router tells us how each navigation happened; we record it before React
// renders the page, as `data-nav` on <html> (for CSS) and as a flag that
// components can read when they mount.

type Router = ReturnType<typeof createBrowserRouter>;

let historyNavigation = false;

export const trackNavigationMotion = (router: Router) => {
  router.subscribe((state) => {
    if (state.navigation.state !== 'idle') return;
    historyNavigation = state.historyAction === 'POP';
    document.documentElement.dataset.nav = historyNavigation ? 'pop' : 'push';
  });
};

/** True while the current page was reached with the browser's back/forward buttons. */
export const isHistoryNavigation = () => historyNavigation;
