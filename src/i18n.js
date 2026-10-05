/*
 * Smart Escape — UI strings.
 */
(function (root) {
  'use strict';
  const SE = (root.SmartEscape = root.SmartEscape || {});

  const STRINGS = {
    en: {
      'app.title': 'Smart Escape',
      'app.tagline': 'Emergency evacuation route finder',
      'btn.import': 'Import JSON',
      'btn.sample': 'Load sample',
      'btn.reset': 'Reset',
      'drop.hint': 'Drop a building JSON file here',
      'empty.title': 'No building loaded',
      'empty.body': 'Import a building JSON file (or load the sample) to see the map and the safest route.',
      'route.heading': 'Escape route',
      'route.ok': 'Exit via {exit}',
      'route.cost': 'Total cost',
      'route.steps': 'Steps',
      'route.noStart': 'Choose a starting location to calculate a route.',
      'route.invalidStart': 'The starting location is not a room or junction.',
      'route.startBlocked': 'Starting location blocked',
      'route.startBlockedHelp': 'Your current location is blocked. Choose another starting location or unblock it.',
      'route.noRoute': 'No route available',
      'route.noRouteHelp': 'No open exit can be reached from here. Unblock a location or corridor, or reopen an exit.',
      'route.none': 'Import a building to calculate a route.',
      'start.heading': 'Starting location',
      'start.placeholder': 'Choose a room or junction…',
      'start.blockedOption': '{name} (blocked)',
      'sel.heading': 'Selected',
      'sel.hint': 'Click a location or corridor on the map to block it, close an exit, or set your starting point.',
      'sel.setStart': 'Set as start',
      'sel.block': 'Block location',
      'sel.unblock': 'Unblock location',
      'sel.blockEdge': 'Block corridor',
      'sel.unblockEdge': 'Unblock corridor',
      'sel.closeExit': 'Close exit',
      'sel.reopenExit': 'Reopen exit',
      'sel.corridor': 'Corridor {a} – {b}',
      'sel.weight': 'Cost {w}',
      'haz.heading': 'Hazards',
      'haz.none': 'No hazards. All locations, corridors and exits are open.',
      'haz.blockedNode': 'Blocked: {name}',
      'haz.blockedEdge': 'Blocked corridor: {a} – {b}',
      'haz.closedExit': 'Closed exit: {name}',
      'haz.clear': 'Remove',
      'exits.heading': 'Exits',
      'state.open': 'open',
      'state.closed': 'closed',
      'state.blocked': 'blocked',
      'type.room': 'Room',
      'type.junction': 'Junction',
      'type.exit': 'Exit',
      'legend.heading': 'Legend',
      'legend.route': 'Escape route',
      'legend.start': 'Your location',
      'legend.blocked': 'Blocked',
      'legend.closed': 'Closed exit',
      'import.loaded': 'Loaded “{name}”: {nodes} locations, {edges} corridors.',
      'import.failed': 'Could not import “{name}”. Fix these problems and try again:',
      'import.warnings': 'Warnings',
      'import.fetchFailed': 'Could not load building.json from the server. Use “Import JSON” to pick the file instead.',
      'import.keepPrevious': 'The previously loaded building is still shown.',
      'aria.node': '{type} {id}, {name}{state}',
      'aria.edge': 'Corridor {a} to {b}, cost {w}{state}',
      'footer': 'Runs entirely in your browser. No data leaves this page.'
    }
  };

  let lang = 'en';

  function digits(s) {
    return s;
  }

  function formatNumber(n) {
    const s = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
    return digits(s);
  }

  function t(key, params) {
    const table = STRINGS[lang] || STRINGS.en;
    const template = table[key] !== undefined ? table[key] : (STRINGS.en[key] !== undefined ? STRINGS.en[key] : key);
    return template.replace(/\{(\w+)\}/g, (m, k) => {
      if (!params || !(k in params)) return m;
      const v = params[k];
      return typeof v === 'number' ? formatNumber(v) : String(v);
    });
  }

  /** Translate a validation issue produced by validate.js. */
  function issueText(issue) {
    const key = 'err.' + issue.code;
    const table = STRINGS[lang] || STRINGS.en;
    if (table[key] !== undefined) return t(key, issue.params);
    return issue.message;
  }

  function applyStatic(scope) {
    (scope || document).querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
  }

  SE.i18n = {
    t, issueText, formatNumber, applyStatic,
    getLang: () => lang,
    setLang(l) {
      if (!STRINGS[l]) return;
      lang = l;
      document.documentElement.lang = l;
      applyStatic();
    },
    languages: () => Object.keys(STRINGS)
  };
})(typeof self !== 'undefined' ? self : this);
