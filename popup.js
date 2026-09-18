async function getActiveTabId() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ? tabs[0].id : null;
}

async function refresh() {
  try {
    const tabId = await getActiveTabId();
    if (tabId == null) return;
    const state = await browser.runtime.sendMessage({ type: 'getState', tabId });
    document.getElementById('remaining').textContent = state.remaining;
    document.getElementById('elapsed').textContent = `idle for ${state.elapsed}s`;
  } catch (e) {
    // ignore
  }
}

refresh();
setInterval(refresh, 1000);
