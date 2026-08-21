'use client';

import { useEffect } from 'react';

/**
 * Registers the offline worker, in production only.
 *
 * Left on in development it caches the dev server's app code and then serves it back after
 * an edit, which looks exactly like a build that silently stopped picking up changes.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        // Offline reading is a convenience; failing to set it up must never break the page
        console.warn('Không đăng ký được service worker:', error);
      });
    };

    // Wait for load so registration never competes with the first render for bandwidth
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
