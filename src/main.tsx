import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Google Maps Platform Demo Key Quota Defense (Tier 1)
const markMapsUnavailable = () => {
  (window as unknown as { __prob8MapsUnavailable?: boolean }).__prob8MapsUnavailable = true;
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = markMapsUnavailable;

const origError = console.error;
console.error = (...args: unknown[]) => {
  origError.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (
    msg.includes('OverQuotaMapError') ||
    msg.includes('QuotaExceededError') ||
    msg.includes('InvalidKeyMapError')
  ) {
    markMapsUnavailable();
  }
};

const origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  origWarn.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (
    msg.includes('Google Maps JavaScript API warning: InvalidKey') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('InvalidKeyMapError')
  ) {
    markMapsUnavailable();
  }
};

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisterError() {
      // Ignore SW registration restriction in sandboxed iframes
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
