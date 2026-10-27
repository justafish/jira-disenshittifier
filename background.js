// Keeps the tracking/promo request blocklist in step with the popup settings.

// Chrome only provides `chrome`; its MV3 APIs are promise-based like Firefox's.
globalThis.browser ??= globalThis.chrome;

const DEFAULTS = { enabled: true, blockTracking: true };

async function sync() {
  const s = await browser.storage.sync.get(DEFAULTS);
  const ids = ["tracking"];
  await browser.declarativeNetRequest.updateEnabledRulesets(
    s.enabled && s.blockTracking ? { enableRulesetIds: ids } : { disableRulesetIds: ids }
  );
}

browser.runtime.onStartup.addListener(sync);
browser.runtime.onInstalled.addListener(sync);
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && ("enabled" in changes || "blockTracking" in changes)) sync();
});
