# Jira Disenshittifier

A Firefox and Chrome extension that hides Atlassian Intelligence, Rovo and other AI bloat from Jira Cloud (`*.atlassian.net`, `*.jira.com`).

## What it removes

Each category can be toggled from the toolbar popup:

- **Atlassian Intelligence buttons & icons**: generic "AI" buttons, sparkle icons, "… with AI"
- **Rovo**: Ask Rovo button, Rovo chat panel, agents, Rovo links and search
- **AI writing tools**: Improve writing, Brainstorm, Change tone, Summarize writing, …
- **AI on work items**: Summarize comments, Suggest child work items, AI breakdowns
- **AI search**: natural-language / "Search with AI" JQL
- **Upsells & spotlights**: "Try Rovo", "Introducing…" dialogs and flags that mention AI

The popup can also turn off **AI acronym highlighting** (the dotted underlines with AI definitions). This is a setting on your Jira account (the `autoHighlightingEnabled` user property), so it applies on every device but only to the Jira site it was set on. Unticking it deletes the property, which restores Jira's default.

It can also block tracking and promo requests (on by default, toggle under **Network** in the popup), using the rules in `rules/tracking.json`:

- `as.atlassian.com`: usage analytics
- `xp.atlassian.com/v1/rgstr`: feature-flag exposure logging
- `*.ingest.sentry.io`: error reporting
- `/rest/internal/2/log/safe/`: Jira's own client logging
- `/gateway/api/post-office/`: in-product messages and promos (e.g. the Rovo reintroduction modal)

This is mainly a privacy win; it doesn't noticeably speed up Jira, whose load time is dominated by its own chained data requests.

## Install

The same folder works in both browsers.

### Firefox

**Temporary (for development):** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and pick `manifest.json`. It stays loaded until Firefox restarts.

**Permanent:** zip the folder (`zip -r jira-disenshittifier.zip . -x '.*'`) and either sign it through [addons.mozilla.org](https://addons.mozilla.org/developers/) as an unlisted add-on, or install it unsigned in Firefox Developer Edition / Nightly with `xpinstall.signatures.required` set to `false`.

If nothing gets hidden, check under `about:addons` → the extension → **Permissions** that it has access to atlassian.net.

`web-ext lint` reports one expected warning: `background.service_worker` is for Chrome, and Firefox uses `background.scripts` instead.

### Chrome (and other Chromium browsers)

Open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked** and pick this folder. It stays installed across restarts; after changing the code, click the reload icon on the extension's card.

## When something slips through

Atlassian changes its UI often, so the rules (in `rules.js`) are heuristics: they match `data-testid`, `aria-label` and the text of short buttons and menu items.

1. Turn on **Highlight instead of hide** in the popup. Hidden elements then show with a red dashed outline, which helps spot false positives.
2. For anything missed, right-click it → Inspect, find a stable `data-testid`, and add a selector such as `[data-testid="the-thing"]` under **Custom selectors**.

## How it works

Request blocking uses `declarativeNetRequest`; `background.js` turns the ruleset on or off to match the popup settings. Element hiding works like this:

`content.js` runs at `document_start`. A `MutationObserver` checks each new element against the enabled rules and tags matches with `data-jde-hidden`, which `content.css` hides. It never hides an element that contains the main page area, so a broad match on a wrapper element can't blank the app.

## Admins

If you administer the Atlassian org, you can turn off Atlassian Intelligence and Rovo for everyone at admin.atlassian.com. This extension is for users who can't do that.
# jira-deenshittifier
