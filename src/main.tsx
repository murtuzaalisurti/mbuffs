import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
// Optional: If you want to use React Query DevTools
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false, // Optional: Disable refetch on window focus
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* Optional: Mount the DevTools */} 
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  </React.StrictMode>
);

// Register service worker and handle updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      // Check for updates on a regular interval (every 60 minutes)
      setInterval(() => registration.update(), 1000 * 60 * 60);

      // Fires when a new SW is found (byte-different from the current one)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // New SW is installed and waiting to activate
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(registration);
          }
        });
      });

      // If there's already a waiting worker when the page loads (e.g. user
      // dismissed the toast previously and reloaded), show the prompt again.
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateToast(registration);
      }
    } catch (err) {
      console.error('SW registration failed:', err);
    }
  });

  // Reload once the new SW takes over
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

function showUpdateToast(registration: ServiceWorkerRegistration) {
  toast('A new version is available', {
    description: 'Refresh to get the latest updates.',
    duration: Infinity,
    action: {
      label: 'Update',
      onClick: () => {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      },
    },
  });
}
