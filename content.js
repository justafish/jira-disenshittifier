(() => {
  // Chrome only provides `chrome`; its MV3 APIs are promise-based like Firefox's.
  const browser = globalThis.browser ?? globalThis.chrome;
  const RULES = globalThis.JDE_RULES;

  const DEFAULTS = {
    enabled: true,
    mode: "hide", // "hide" | "highlight"
    categories: Object.fromEntries(Object.keys(RULES).map((k) => [k, true])),
    custom: "",
  };

  const INTERACTIVE =
    'button, a, [role="button"], [role="link"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="tab"]';

  // When a match is found we hide the nearest one of these (within a few
  // levels), so an AI icon takes its button / menu item with it.
  const HIDE_TARGET = `${INTERACTIVE}, li, [role="listitem"]`;
  const HIDE_TARGET_MAX_DEPTH = 5;

  // Never hide anything that contains the core page; a broad testid match on a
  // provider wrapper would otherwise blank the whole app.
  const CORE = 'main, [role="main"], [role="banner"], #ak-main-content, [data-testid="page-layout.main"]';

  const MAX_TEXT_LENGTH = 60;

  const COLLAPSE = (globalThis.JDE_COLLAPSE || []).join(", ");
  const VISIBLE_CONTENT = "img, svg, video, canvas, iframe, input, textarea, select, button, a";

  // Elements whose attributes or text the regex rules look at.
  const GENERIC = `[data-testid], [aria-label], [title], ${INTERACTIVE}`;
  const INTERACTIVE_ROLES = new Set(["button", "link", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "tab"]);

  let settings = DEFAULTS;
  let active = []; // compiled, enabled categories
  // Unions across all active categories, so the common case (no match) costs
  // one native query or one regex test rather than one per category.
  let explicitSelector = "";
  let containers = []; // { key, selector, text, maxLength }
  let anyTestid = null;
  let anyLabel = null;
  let anyText = null;

  function compile() {
    active = [];
    containers = [];
    explicitSelector = "";
    anyTestid = anyLabel = anyText = null;
    if (!settings.enabled) return;

    for (const [key, rule] of Object.entries(RULES)) {
      if (!settings.categories[key]) continue;
      active.push({
        key,
        selector: (rule.selectors || []).join(", "),
        testid: rule.testid || [],
        label: rule.label || [],
        text: rule.text || [],
      });
      for (const c of rule.containers || []) containers.push({ key, ...c });
    }

    const custom = settings.custom
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("#") && isValidSelector(s));
    if (custom.length) {
      active.push({ key: "custom", selector: custom.join(", "), testid: [], label: [], text: [] });
    }

    explicitSelector = active.map((c) => c.selector).filter(Boolean).join(", ");
    anyTestid = unionRegex(active.flatMap((c) => c.testid));
    anyLabel = unionRegex(active.flatMap((c) => c.label));
    anyText = unionRegex(active.flatMap((c) => c.text));
  }

  // All rule regexes are case-insensitive, so the union is too.
  function unionRegex(list) {
    return list.length ? new RegExp(list.map((re) => `(?:${re.source})`).join("|"), "i") : null;
  }

  function isValidSelector(sel) {
    try {
      document.createDocumentFragment().querySelector(sel);
      return true;
    } catch {
      return false;
    }
  }

  function normalisedText(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isInteractive(el) {
    const tag = el.localName;
    return tag === "button" || tag === "a" || INTERACTIVE_ROLES.has(el.getAttribute("role"));
  }

  // Which category's `field` regexes match `value`? Only called after the
  // union regex has matched, so this is rare.
  function categoryFor(field, value) {
    return active.find((c) => c[field].some((re) => re.test(value)))?.key;
  }

  function matchGeneric(el) {
    const testid = el.getAttribute("data-testid");
    if (testid && anyTestid?.test(testid)) return categoryFor("testid", testid);
    const label = el.getAttribute("aria-label") || el.getAttribute("title");
    if (label && anyLabel?.test(label)) return categoryFor("label", label);
    if (anyText && isInteractive(el)) {
      const raw = el.textContent;
      if (!raw || raw.length > MAX_TEXT_LENGTH * 4) return null;
      const t = raw.replace(/\s+/g, " ").trim();
      if (t.length <= MAX_TEXT_LENGTH && anyText.test(t)) return categoryFor("text", t);
    }
    return null;
  }

  function matchExplicit(el) {
    return active.find((c) => c.selector && el.matches(c.selector))?.key;
  }

  function matchContainer(el, c) {
    const raw = el.textContent || "";
    if (raw.length > c.maxLength * 4) return false;
    const t = normalisedText(el);
    return t.length <= c.maxLength && c.text.test(t);
  }

  // Full check of a single element, e.g. after one of its attributes changed.
  function matchElement(el) {
    if (explicitSelector && el.matches(explicitSelector)) return { key: matchExplicit(el), direct: true };
    for (const c of containers) {
      if (el.matches(c.selector) && matchContainer(el, c)) return { key: c.key, direct: true };
    }
    const key = matchGeneric(el);
    return key ? { key, direct: false } : null;
  }

  function hideTarget(el, direct) {
    if (direct) return el;
    let node = el;
    for (let i = 0; node && i <= HIDE_TARGET_MAX_DEPTH; i++, node = node.parentElement) {
      if (node.matches(HIDE_TARGET)) return node;
    }
    return el;
  }

  function hide(el, key, direct) {
    if (!key || el.closest("[data-jde-hidden]")) return;
    const target = hideTarget(el, direct);
    if (target === document.body || target === document.documentElement) return;
    if (target.matches(CORE) || target.querySelector(CORE)) return;
    target.setAttribute("data-jde-hidden", key);
    collapseAncestor(target, key);
  }

  function check(el) {
    const m = matchElement(el);
    if (m) hide(el, m.key, m.direct);
  }

  function collapseAncestor(el, key) {
    if (!COLLAPSE) return;
    const container = el.parentElement?.closest(COLLAPSE);
    if (!container || container.hasAttribute("data-jde-hidden") || hasVisibleContent(container)) return;
    container.setAttribute("data-jde-hidden", key);
    container.setAttribute("data-jde-collapsed", "");
  }

  // Anything left in `root` (outside hidden elements) that a user could see?
  function hasVisibleContent(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n !== root && n.nodeType === Node.ELEMENT_NODE && n.hasAttribute("data-jde-hidden")
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE ? n.data.trim() : n.matches(VISIBLE_CONTENT)) return true;
    }
    return false;
  }

  // New content landed inside a collapsed wrapper: show it again if needed.
  function recheckCollapsed(node) {
    const container = node.closest?.("[data-jde-collapsed]");
    if (container && hasVisibleContent(container)) {
      container.removeAttribute("data-jde-hidden");
      container.removeAttribute("data-jde-collapsed");
    }
  }

  const loggedErrors = new Set();
  function logError(err) {
    const key = String(err);
    if (loggedErrors.has(key)) return;
    loggedErrors.add(key);
    console.warn("[jde] error:", err);
  }

  function safeCheck(el) {
    try {
      check(el);
    } catch (err) {
      logError(err);
    }
  }

  // Calls fn for root and each descendant matching sel, isolating errors.
  function eachMatch(root, sel, fn) {
    if (!sel) return;
    try {
      if (root.matches(sel)) fn(root);
      for (const el of root.querySelectorAll(sel)) fn(el);
    } catch (err) {
      logError(err);
    }
  }

  // Selector rules run as native queries; only the regex rules need a JS
  // look at each candidate.
  function scan(root) {
    if (!active.length || !root || root.nodeType !== Node.ELEMENT_NODE) return;
    eachMatch(root, explicitSelector, (el) => hide(el, matchExplicit(el), true));
    for (const c of containers) {
      eachMatch(root, c.selector, (el) => matchContainer(el, c) && hide(el, c.key, true));
    }
    if (anyTestid || anyLabel || anyText) {
      eachMatch(root, GENERIC, (el) => {
        const key = matchGeneric(el);
        if (key) hide(el, key, false);
      });
    }
  }

  function unhideAll() {
    for (const el of document.querySelectorAll("[data-jde-hidden]")) {
      el.removeAttribute("data-jde-hidden");
      el.removeAttribute("data-jde-collapsed");
    }
  }

  function applyMode() {
    document.documentElement.setAttribute("data-jde-mode", settings.mode);
  }

  function rescan() {
    unhideAll();
    compile();
    applyMode();
    scan(document.documentElement);
  }

  const observer = new MutationObserver((mutations) => {
    if (!active.length) return;
    for (const m of mutations) {
      if (m.type === "childList") {
        for (const n of m.addedNodes) {
          if (n.nodeType === Node.ELEMENT_NODE) scan(n);
          else if (n.parentElement) checkUp(n.parentElement);
        }
        if (m.addedNodes.length && m.target.nodeType === Node.ELEMENT_NODE) recheckCollapsed(m.target);
      } else if (m.type === "attributes") {
        // Only the element itself changed; its subtree was checked when added.
        safeCheck(m.target);
      } else if (m.type === "characterData" && m.target.parentElement) {
        checkUp(m.target.parentElement);
      }
    }
  });

  // Text changed somewhere inside an element: re-check the interactive
  // element that owns it.
  function checkUp(el) {
    const owner = el.closest(INTERACTIVE);
    if (owner) safeCheck(owner);
  }

  // Run `document.dispatchEvent(new Event("jde-debug"))` in the page console
  // to log what the rules see.
  document.addEventListener("jde-debug", () => {
    console.log("[jde] frame:", location.href, "top:", window === window.top);
    console.log("[jde] settings:", JSON.stringify(settings));
    console.log("[jde] active categories:", active.map((c) => c.key).join(", ") || "(none)");
    console.log("[jde] errors so far:", [...loggedErrors]);
    let candidates = [];
    try {
      const sel = [GENERIC, explicitSelector, ...containers.map((c) => c.selector)].filter(Boolean).join(", ");
      candidates = document.querySelectorAll(sel);
    } catch (err) {
      console.warn("[jde] candidate selector failed:", err);
    }
    let matched = 0;
    for (const el of candidates) {
      try {
        const m = matchElement(el);
        if (!m) continue;
        matched++;
        const target = hideTarget(el, m.direct);
        console.log(
          `[jde] match ${m.key}:`,
          el.getAttribute("data-testid") || el.getAttribute("aria-label") || normalisedText(el).slice(0, 60),
          "| target hidden:",
          target.hasAttribute("data-jde-hidden")
        );
      } catch (err) {
        console.warn("[jde] match failed:", err, el);
      }
    }
    console.log(
      `[jde] candidates: ${candidates.length}, matched: ${matched}, hidden: ${document.querySelectorAll("[data-jde-hidden]").length}`
    );
  });

  function start() {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-testid", "aria-label", "title"],
    });
  }

  browser.storage.sync.get(DEFAULTS).then((stored) => {
    settings = { ...DEFAULTS, ...stored, categories: { ...DEFAULTS.categories, ...stored.categories } };
    start();
    rescan();
  }).catch(logError);

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [k, { newValue }] of Object.entries(changes)) settings[k] = newValue;
    settings.categories = { ...DEFAULTS.categories, ...settings.categories };
    rescan();
  });

  // Jira's AI acronym highlighting is controlled by a per-user property. It is
  // on while the property is unset; storing `false` turns it off. Requests go
  // through the page (content.fetch) so they carry the user's Jira session.
  const HIGHLIGHT_PROPERTY = "autoHighlightingEnabled";

  function jiraApi(path, init = {}) {
    const pageFetch = globalThis.content?.fetch ?? fetch;
    return pageFetch(location.origin + path, {
      credentials: "include",
      ...init,
      headers: { Accept: "application/json", "X-Atlassian-Token": "no-check", ...init.headers },
    });
  }

  async function highlighting(msg) {
    const me = await jiraApi("/rest/api/3/myself");
    if (!me.ok) throw new Error(`Couldn't look up your Jira account (HTTP ${me.status})`);
    const { accountId } = await me.json();
    const path = `/rest/api/3/user/properties/${HIGHLIGHT_PROPERTY}?accountId=${encodeURIComponent(accountId)}`;

    if (msg.action === "set") {
      const r = msg.enabled
        ? await jiraApi(path, { method: "DELETE" })
        : await jiraApi(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: "false" });
      if (!r.ok && r.status !== 404) throw new Error(`Jira refused the change (HTTP ${r.status})`);
    }

    const r = await jiraApi(path);
    if (r.status === 404) return { enabled: true };
    if (!r.ok) throw new Error(`Couldn't read the setting (HTTP ${r.status})`);
    const { value } = await r.json();
    return { enabled: value !== false };
  }

  // Replies via sendResponse rather than a returned Promise, which Chrome
  // doesn't support; returning true keeps the channel open for async replies.
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (window !== window.top) return;

    if (msg?.type === "jde-highlighting") {
      highlighting(msg)
        .catch((err) => ({ error: err.message }))
        .then(sendResponse);
      return true;
    }

    if (msg?.type !== "jde-counts") return;
    const counts = {};
    for (const el of document.querySelectorAll("[data-jde-hidden]:not([data-jde-collapsed])")) {
      const k = el.getAttribute("data-jde-hidden");
      counts[k] = (counts[k] || 0) + 1;
    }
    sendResponse(counts);
  });
})();
