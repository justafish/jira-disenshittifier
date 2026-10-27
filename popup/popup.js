// Chrome only provides `chrome`; its MV3 APIs are promise-based like Firefox's.
globalThis.browser ??= globalThis.chrome;

const RULES = globalThis.JDE_RULES;

const DEFAULTS = {
  enabled: true,
  mode: "hide",
  categories: Object.fromEntries(Object.keys(RULES).map((k) => [k, true])),
  custom: "",
  blockTracking: true,
};

const $ = (id) => document.getElementById(id);

async function sendToTab(msg) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return browser.tabs.sendMessage(tab.id, msg);
}

async function getCounts() {
  try {
    return (await sendToTab({ type: "jde-counts" })) || {};
  } catch {
    return null; // not a Jira tab
  }
}

// `set` is undefined to just read the current state.
async function updateHighlighting(set) {
  const box = $("noHighlighting");
  const status = $("highlightingStatus");
  box.disabled = true;
  let res;
  try {
    res = await sendToTab({ type: "jde-highlighting", action: set === undefined ? "get" : "set", enabled: set });
  } catch {
    status.textContent = "Open a Jira tab to change this.";
    return;
  }
  if (!res || res.error) {
    status.textContent = res?.error || "Couldn't reach Jira.";
    box.disabled = false;
    return;
  }
  box.checked = !res.enabled;
  box.disabled = false;
  status.textContent = set === undefined ? "" : "Saved. Reload Jira to see the change.";
}

function renderCounts(counts) {
  for (const key of [...Object.keys(RULES), "custom"]) {
    const el = document.querySelector(`[data-count="${key}"]`);
    if (!el) continue;
    const n = counts?.[key] || 0;
    el.textContent = counts ? `(${n})` : "";
    el.classList.toggle("nonzero", n > 0);
  }
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  $("status").textContent =
    total === null ? "Open a Jira tab to see what's been removed." : `${total} element(s) removed on this page.`;
}

async function refreshCounts() {
  // Give the content script a moment to rescan after a settings change.
  await new Promise((r) => setTimeout(r, 150));
  renderCounts(await getCounts());
}

async function init() {
  const stored = await browser.storage.sync.get(DEFAULTS);
  const settings = { ...DEFAULTS, ...stored, categories: { ...DEFAULTS.categories, ...stored.categories } };

  $("enabled").checked = settings.enabled;
  $("highlight").checked = settings.mode === "highlight";
  $("blockTracking").checked = settings.blockTracking;
  $("custom").value = settings.custom;
  document.body.classList.toggle("disabled", !settings.enabled);

  const container = $("categories");
  const entries = [...Object.entries(RULES), ["custom", { name: "Custom selectors" }]];
  for (const [key, rule] of entries) {
    const row = document.createElement("label");
    row.className = "row";
    const text = document.createElement("span");
    const name = document.createElement("span");
    const count = document.createElement("span");
    name.textContent = rule.name;
    count.className = "count";
    count.dataset.count = key;
    text.append(name, count);
    row.append(text);
    if (key !== "custom") {
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = settings.categories[key];
      box.addEventListener("change", async () => {
        settings.categories[key] = box.checked;
        await browser.storage.sync.set({ categories: settings.categories });
        refreshCounts();
      });
      row.append(box);
    }
    container.append(row);
  }

  $("enabled").addEventListener("change", async (e) => {
    document.body.classList.toggle("disabled", !e.target.checked);
    await browser.storage.sync.set({ enabled: e.target.checked });
    refreshCounts();
  });

  $("highlight").addEventListener("change", async (e) => {
    await browser.storage.sync.set({ mode: e.target.checked ? "highlight" : "hide" });
  });

  $("noHighlighting").addEventListener("change", (e) => updateHighlighting(!e.target.checked));

  $("blockTracking").addEventListener("change", async (e) => {
    await browser.storage.sync.set({ blockTracking: e.target.checked });
  });

  $("save").addEventListener("click", async () => {
    await browser.storage.sync.set({ custom: $("custom").value });
    refreshCounts();
  });

  renderCounts(await getCounts());
  updateHighlighting();
}

init();
