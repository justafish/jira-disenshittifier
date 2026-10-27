// Detection rules, grouped into categories the user can toggle.
//
// Atlassian doesn't publish stable selectors and ships UI changes constantly,
// so every rule here is a heuristic. Each category can use:
//   selectors  – CSS selectors; any match is hidden
//   testid     – regexes tested against data-testid
//   name       – display name in the popup
//   label      – regexes tested against aria-label / title
//   text       – regexes tested against the trimmed text of short interactive
//                elements (buttons, links, menu items, tabs)
//   containers – { selector, text, maxLength }: hide a small container (e.g. a
//                spotlight or flag) whose whole text matches
//
// If something slips through, use "highlight" mode in the popup to see what is
// being caught, then add your own selector under "Custom selectors".

globalThis.JDE_RULES = {
  general: {
    name: "Atlassian Intelligence buttons & icons",
    selectors: [
      '[data-testid*="atlassian-intelligence" i]',
      '[data-testid*="atlassianintelligence" i]',
      '[aria-label*="Atlassian Intelligence" i]',
    ],
    testid: [
      /(^|[-_.:/])ai([-_.:/]|$)/i,
      /(^|[-_.:/])ai[-_]?(button|icon|mate|assist|assistant|actions?|panel|menu|trigger|entry[-_]?point)/i,
    ],
    label: [
      /\batlassian intelligence\b/i,
      /^ai$/i,
      /\b(with|using|by) ai\b/i,
      /\bai[- ](generated|powered|assist(ant)?|actions?|features?|tools?)\b/i,
    ],
    text: [
      /^atlassian intelligence$/i,
      /^ai$/i,
      /\b(with|using) ai$/i,
      /^ai (actions|assistant|features|tools)$/i,
    ],
  },

  rovo: {
    name: "Rovo (Ask Rovo, chat, agents, search)",
    selectors: [
      '[data-testid*="rovo" i]',
      '[data-vc*="rovo" i]',
      '[id*="rovo" i]:not(html):not(body)',
      'a[href*="/rovo"]',
      'iframe[src*="rovo"]',
      '[data-spotlight-target*="rovo" i]',
    ],
    label: [/\brovo\b/i],
    text: [
      /^(ask|chat with|open|try|search with|use) rovo\b/i,
      /^rovo( chat| agents?| search| studio)?$/i,
    ],
  },

  editor: {
    name: "AI writing tools in the editor",
    testid: [/editor[-_.]?ai|ai[-_.]?editor|improve[-_]?writing/i],
    label: [
      /^(improve writing|ask ai|write with ai|ai writing( assistant)?)$/i,
    ],
    text: [
      /^(improve writing|fix spelling (and|&) grammar|brainstorm|make (it )?(shorter|longer)|change tone( to .*)?|suggest a title|find action items|ask ai|write with ai|ai writing( assistant)?)$/i,
      /^summari[sz]e (writing|page|content|text)$/i,
      /^(improve|rewrite) (the )?description$/i,
    ],
  },

  issue: {
    name: "AI on work items (summaries, suggestions, breakdowns)",
    testid: [
      /ai[-_]?summar|smart[-_]?summar|summari[sz]e[-_]?comments|comment[-_]?summar/i,
      /child[-_]?(issue|work[-_]?item)s?[-_]?suggest|suggest[-_]?child/i,
      /(issue|work)[-_]?breakdown|ai[-_]?breakdown/i,
      /ai[-_]?(related|similar|suggest)/i,
    ],
    text: [
      /^summari[sz]e( comments| this| (work )?item| issue| ticket| details)?$/i,
      /^suggest (child|sub)[- ]?(work items|issues|tasks)$/i,
      /^(create|generate|break down|draft) with ai$/i,
      /^(ai )?(work )?breakdown$/i,
      /^(generate|suggest) (a )?(summary|description|title|subtasks|child work items)$/i,
      /^smart (summary|summaries|replies)$/i,
    ],
  },

  search: {
    name: "AI / natural-language search",
    testid: [/natural[-_]?language|nl[-_]?to[-_]?jql|ai[-_]?search|jql[-_]?ai|search[-_]?ai/i],
    label: [/natural[- ]language|search with ai|ai search|\bai\b.*\bjql\b|\bjql\b.*\bai\b/i],
    text: [
      /^(search|filter|query) with ai$/i,
      /^(natural language|ai search|ai jql)$/i,
    ],
  },

  promos: {
    name: "AI upsells, spotlights & onboarding",
    testid: [
      /ai[-_]?(upsell|opt[-_]?in|onboarding|spotlight|discovery|promo|nudge|changeboarding)/i,
      /rovo[-_]?(upsell|onboarding|spotlight|discovery|promo|nudge)/i,
    ],
    text: [
      /^try (rovo|atlassian intelligence|ai)\b/i,
      /^(enable|activate|turn on|unlock|get) (ai|atlassian intelligence|rovo)\b/i,
    ],
    containers: [
      {
        selector:
          '[data-testid*="spotlight" i], [data-testid*="flag" i], [data-testid*="onboarding" i], [data-testid*="changeboard" i], [role="dialog"], [role="alert"], [role="status"]',
        text: /\brovo\b|atlassian intelligence|\bAI\b/,
        maxLength: 400,
      },
    ],
  },
};

// Wrappers that draw their own chrome (background, shadow) around AI buttons.
// When everything inside one has been hidden, the wrapper is hidden too, and
// shown again if Jira later puts something else in it.
globalThis.JDE_COLLAPSE = ['[data-testid^="layout-controller.ui.bottom-right-corner"]'];
