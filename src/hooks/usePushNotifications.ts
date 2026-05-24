import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { fetchVapidPublicKeyApi, savePushSubscriptionApi } from '@/lib/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    let cancelled = false;

    const setup = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;

        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          await savePushSubscriptionApi(existingSubscription);
          return;
        }

        const permission = Notification.permission;
        if (permission === 'denied') return;

        if (permission === 'default') {
          const result = await Notification.requestPermission();
          if (result !== 'granted' || cancelled) return;
        }

        const { key: vapidPublicKey } = await fetchVapidPublicKeyApi();
        if (!vapidPublicKey || cancelled) return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        if (!cancelled) {
          await savePushSubscriptionApi(subscription);
        }
      } catch (err) {
        console.error('[push] Failed to set up push notifications:', err);
      }
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);
}
