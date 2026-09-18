(() => {
  // Any of these firing anywhere on the page counts as "the window was interacted with".
  const EVENTS = [
    'mousedown', 'mouseup', 'click',
    'keydown', 'keyup',
    'wheel', 'scroll',
    'touchstart', 'touchmove'
  ];

  let lastSent = 0;

  function notifyInteraction() {
    // Throttle so we're not spamming messages on e.g. mousemove/scroll storms.
    const now = Date.now();
    if (now - lastSent < 250) return;
    lastSent = now;
    try {
      browser.runtime.sendMessage({ type: 'interaction' });
    } catch (e) {
      // Extension context can occasionally be unavailable during navigation; ignore.
    }
  }

  EVENTS.forEach(evt =>
    window.addEventListener(evt, notifyInteraction, { capture: true, passive: true })
  );

  // Focus events (tab/window regaining focus, or an element inside the page gaining focus)
  window.addEventListener('focus', notifyInteraction, true);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) notifyInteraction();
  });

  // Only draw the overlay in the top-level frame, not in every iframe on the page.
  if (window.top !== window) return;

  let remainingEl = null;

  function buildOverlay() {
    const host = document.createElement('div');
    host.id = '__idle_countdown_host__';
    Object.assign(host.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      zIndex: '2147483647', // max z-index, sits above page content
      pointerEvents: 'none'
    });

    const shadow = host.attachShadow({ mode: 'closed' });
    const box = document.createElement('div');
    box.textContent = '90';
    Object.assign(box.style, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      fontWeight: '600',
      color: '#f0f0f0',
      background: 'rgba(20,20,20,0.75)',
      padding: '6px 10px',
      borderRadius: '999px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      userSelect: 'none',
      transition: 'background 0.2s, color 0.2s'
    });
    shadow.appendChild(box);

    (document.documentElement || document.body).appendChild(host);
    remainingEl = box;
  }

  function attachWhenReady() {
    if (document.body) {
      buildOverlay();
    } else {
      document.addEventListener('DOMContentLoaded', buildOverlay, { once: true });
    }
  }

  attachWhenReady();

  browser.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'tick' && remainingEl) {
      const { remaining } = message.state;
      remainingEl.textContent = String(remaining);
      if (remaining <= 10) {
        remainingEl.style.background = 'rgba(217,48,37,0.85)';
      } else {
        remainingEl.style.background = 'rgba(20,20,20,0.75)';
      }
    }
  });
})();
