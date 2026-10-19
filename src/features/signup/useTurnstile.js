import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export function useTurnstile({ siteKey, action, onToken, resetKey }) {
  const { language } = useI18n();
  const container = useRef(null);
  const widget = useRef(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const token = (value) => {
      if (!cancelled) onToken(value || '');
    };
    const render = () => {
      if (cancelled || !container.current || !window.turnstile) return;
      window.turnstile.remove?.(widget.current);
      widget.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        action,
        theme,
        language,
        callback: token,
        'expired-callback': () => token(''),
        'error-callback': () => token(''),
      });
      setStatus('ready');
    };
    if (window.turnstile) {
      render();
      return () => {
        cancelled = true;
        window.turnstile.remove?.(widget.current);
      };
    }
    const existing = document.querySelector('script[data-turnstile]');
    const script = existing || document.createElement('script');
    if (!existing) {
      script.src = SCRIPT;
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = '';
      script.addEventListener('error', () => setStatus('error'), { once: true });
      document.head.appendChild(script);
    }
    script.addEventListener('load', render, { once: true });
    return () => {
      cancelled = true;
      script.removeEventListener('load', render);
      window.turnstile?.remove?.(widget.current);
    };
  }, [siteKey, action, language, resetKey, onToken]);
  return { container, status };
}
