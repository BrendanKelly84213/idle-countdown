const COUNTDOWN_SECONDS = 90;

// tabId -> { lastInteraction, notifiedZero }
const tabStates = new Map();

function ensureTab(tabId) {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, { lastInteraction: Date.now(), notifiedZero: false });
  }
  return tabStates.get(tabId);
}

function resetTab(tabId) {
  if (tabId == null) return;
  const s = ensureTab(tabId);
  s.lastInteraction = Date.now();
  s.notifiedZero = false;
}

function getState(tabId) {
  const s = ensureTab(tabId);
  const elapsed = Math.floor((Date.now() - s.lastInteraction) / 1000);
  const remaining = Math.max(0, COUNTDOWN_SECONDS - elapsed);
  return { elapsed, remaining, total: COUNTDOWN_SECONDS };
}

// Interaction pings from content scripts. sender.tab identifies which tab
// (and works correctly even when the ping comes from an iframe within that tab).
browser.runtime.onMessage.addListener((message, sender) => {
  if (!message) return;

  if (message.type === 'interaction') {
    if (sender.tab) resetTab(sender.tab.id);
  } else if (message.type === 'getState') {
    // Content scripts have sender.tab; the popup has none, so it must pass tabId explicitly.
    const tabId = sender.tab ? sender.tab.id : message.tabId;
    if (tabId != null) return Promise.resolve(getState(tabId));
  }
});

// A tab closing: drop its state so the map doesn't grow forever.
browser.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

// A new tab: start its own clock.
browser.tabs.onCreated.addListener((tab) => {
  ensureTab(tab.id);
});

// Switching to a tab counts as interacting with it.
browser.tabs.onActivated.addListener(({ tabId }) => {
  resetTab(tabId);
});

// Window-level focus change: reset whichever tab is active in that window.
browser.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) return;
  browser.tabs.query({ active: true, windowId }).then((tabs) => {
    if (tabs[0]) resetTab(tabs[0].id);
  });
});

// Pick up any tabs that were already open when the extension starts/reloads.
browser.tabs.query({}).then((tabs) => {
  for (const tab of tabs) ensureTab(tab.id);
});

function tick() {
  browser.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      const state = getState(tab.id);
      const { elapsed, remaining } = state;

      browser.browserAction.setBadgeText({ text: String(remaining), tabId: tab.id });
      browser.browserAction.setBadgeBackgroundColor({
        color: remaining <= 10 ? '#d93025' : '#4285f4',
        tabId: tab.id
      });
      browser.browserAction.setTitle({
        title: `Idle Countdown — ${remaining}s left (idle ${elapsed}s)`,
        tabId: tab.id
      });

      browser.tabs.sendMessage(tab.id, { type: 'tick', state }).catch(() => {
        // Tab has no content script yet (privileged page, still loading, etc.) — ignore.
      });

      const s = tabStates.get(tab.id);
      if (remaining === 0 && s && !s.notifiedZero) {
        s.notifiedZero = true;
        browser.notifications.create({
          type: 'basic',
          title: 'Idle Countdown',
          message: `Tab idle for ${COUNTDOWN_SECONDS}s: ${tab.title || tab.url}`
        });
      }
    }
  });
}

setInterval(tick, 1000);
tick();
