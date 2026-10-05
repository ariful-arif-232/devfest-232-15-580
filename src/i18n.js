/*
 * Smart Escape — Bangla / English UI strings.
 *
 * Every visible string, including validation messages, has an English and a
 * Bangla version. In Bangla mode numbers are shown with Bangla digits; node ids
 * (R1, C1, …) stay as written in the JSON so routes remain comparable.
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
      'footer': 'Runs entirely in your browser. No data leaves this page.',
      'lang.label': 'Language'
    },

    bn: {
      'app.title': 'স্মার্ট এস্কেপ',
      'app.tagline': 'জরুরি নির্গমন পথ নির্ণায়ক',
      'btn.import': 'JSON ইমপোর্ট',
      'btn.sample': 'নমুনা লোড',
      'btn.reset': 'রিসেট',
      'drop.hint': 'বিল্ডিং JSON ফাইলটি এখানে ছেড়ে দিন',
      'empty.title': 'কোনো বিল্ডিং লোড হয়নি',
      'empty.body': 'মানচিত্র ও সবচেয়ে নিরাপদ পথ দেখতে একটি বিল্ডিং JSON ফাইল ইমপোর্ট করুন (অথবা নমুনা লোড করুন)।',
      'route.heading': 'নির্গমন পথ',
      'route.ok': '{exit} দিয়ে বের হোন',
      'route.cost': 'মোট খরচ',
      'route.steps': 'ধাপসমূহ',
      'route.noStart': 'পথ হিসাব করতে একটি শুরুর অবস্থান বেছে নিন।',
      'route.invalidStart': 'শুরুর অবস্থানটি কোনো কক্ষ বা সংযোগস্থল নয়।',
      'route.startBlocked': 'শুরুর অবস্থান অবরুদ্ধ',
      'route.startBlockedHelp': 'আপনার বর্তমান অবস্থানটি অবরুদ্ধ। অন্য শুরুর অবস্থান বেছে নিন অথবা এটি মুক্ত করুন।',
      'route.noRoute': 'কোনো পথ পাওয়া যায়নি',
      'route.noRouteHelp': 'এখান থেকে কোনো খোলা বহির্গমনে পৌঁছানো যাচ্ছে না। কোনো অবস্থান বা করিডোর মুক্ত করুন, অথবা একটি বহির্গমন আবার খুলুন।',
      'route.none': 'পথ হিসাব করতে একটি বিল্ডিং ইমপোর্ট করুন।',
      'start.heading': 'শুরুর অবস্থান',
      'start.placeholder': 'একটি কক্ষ বা সংযোগস্থল বেছে নিন…',
      'start.blockedOption': '{name} (অবরুদ্ধ)',
      'sel.heading': 'নির্বাচিত',
      'sel.hint': 'কোনো অবস্থান অবরুদ্ধ করতে, বহির্গমন বন্ধ করতে বা শুরুর অবস্থান ঠিক করতে মানচিত্রে অবস্থান বা করিডোরে ক্লিক করুন।',
      'sel.setStart': 'শুরু হিসেবে নির্ধারণ',
      'sel.block': 'অবস্থান অবরুদ্ধ করুন',
      'sel.unblock': 'অবস্থান মুক্ত করুন',
      'sel.blockEdge': 'করিডোর অবরুদ্ধ করুন',
      'sel.unblockEdge': 'করিডোর মুক্ত করুন',
      'sel.closeExit': 'বহির্গমন বন্ধ করুন',
      'sel.reopenExit': 'বহির্গমন খুলুন',
      'sel.corridor': 'করিডোর {a} – {b}',
      'sel.weight': 'খরচ {w}',
      'haz.heading': 'বিপদসমূহ',
      'haz.none': 'কোনো বিপদ নেই। সব অবস্থান, করিডোর ও বহির্গমন খোলা।',
      'haz.blockedNode': 'অবরুদ্ধ: {name}',
      'haz.blockedEdge': 'অবরুদ্ধ করিডোর: {a} – {b}',
      'haz.closedExit': 'বন্ধ বহির্গমন: {name}',
      'haz.clear': 'সরান',
      'exits.heading': 'বহির্গমনসমূহ',
      'state.open': 'খোলা',
      'state.closed': 'বন্ধ',
      'state.blocked': 'অবরুদ্ধ',
      'type.room': 'কক্ষ',
      'type.junction': 'সংযোগস্থল',
      'type.exit': 'বহির্গমন',
      'legend.heading': 'নির্দেশিকা',
      'legend.route': 'নির্গমন পথ',
      'legend.start': 'আপনার অবস্থান',
      'legend.blocked': 'অবরুদ্ধ',
      'legend.closed': 'বন্ধ বহির্গমন',
      'import.loaded': '“{name}” লোড হয়েছে: {nodes}টি অবস্থান, {edges}টি করিডোর।',
      'import.failed': '“{name}” ইমপোর্ট করা যায়নি। নিচের সমস্যাগুলো ঠিক করে আবার চেষ্টা করুন:',
      'import.warnings': 'সতর্কতা',
      'import.fetchFailed': 'সার্ভার থেকে building.json লোড করা যায়নি। ফাইলটি বেছে নিতে “JSON ইমপোর্ট” ব্যবহার করুন।',
      'import.keepPrevious': 'আগে লোড করা বিল্ডিংটি এখনও দেখানো হচ্ছে।',
      'aria.node': '{type} {id}, {name}{state}',
      'aria.edge': 'করিডোর {a} থেকে {b}, খরচ {w}{state}',
      'footer': 'সম্পূর্ণভাবে আপনার ব্রাউজারে চলে। কোনো তথ্য এই পেজের বাইরে যায় না।',
      'lang.label': 'ভাষা',

      'err.INVALID_JSON': 'ফাইলটি বৈধ JSON নয় ({detail})।',
      'err.NOT_OBJECT': 'ফাইলের শীর্ষ স্তর অবশ্যই একটি JSON অবজেক্ট হতে হবে।',
      'err.BAD_BUILDING': '"building" অবশ্যই একটি খালি নয় এমন বিল্ডিংয়ের নাম হতে হবে।',
      'err.NODES_NOT_LIST': '"nodes" অবশ্যই একটি তালিকা হতে হবে।',
      'err.EDGES_NOT_LIST': '"edges" অবশ্যই একটি তালিকা হতে হবে।',
      'err.NODE_COUNT': 'বিল্ডিংয়ে {min} থেকে {max}টি নোড থাকতে হবে (পাওয়া গেছে {count}টি)।',
      'err.EDGE_COUNT': 'বিল্ডিংয়ে {min} থেকে {max}টি এজ থাকতে হবে (পাওয়া গেছে {count}টি)।',
      'err.NODE_NOT_OBJECT': '{index} নম্বর নোডটি অবজেক্ট নয়।',
      'err.NODE_NO_ID': '{index} নম্বর নোডের একটি খালি নয় এমন টেক্সট "id" প্রয়োজন।',
      'err.NODE_DUPLICATE_ID': 'নোড id "{id}" একাধিকবার ব্যবহার হয়েছে।',
      'err.NODE_NO_LABEL': 'নোড "{id}"-এর একটি খালি নয় এমন "label" প্রয়োজন।',
      'err.NODE_BAD_TYPE': 'নোড "{id}"-এর ধরন "{type}"; এটি অবশ্যই room, junction বা exit হতে হবে।',
      'err.NODE_BAD_COORD': 'নোড "{id}"-এর সংখ্যাসূচক "x" ও "y" স্থানাঙ্ক প্রয়োজন।',
      'err.EDGE_NOT_OBJECT': '{index} নম্বর এজটি অবজেক্ট নয়।',
      'err.EDGE_NO_ID': '{index} নম্বর এজের একটি খালি নয় এমন টেক্সট "id" প্রয়োজন।',
      'err.EDGE_DUPLICATE_ID': 'এজ id "{id}" একাধিকবার ব্যবহার হয়েছে।',
      'err.EDGE_UNKNOWN_NODE': 'এজ "{id}" অজানা নোড "{node}" উল্লেখ করেছে।',
      'err.EDGE_SELF_LOOP': 'এজ "{id}" নোড "{node}"-কে নিজের সাথেই যুক্ত করেছে।',
      'err.EDGE_BAD_COST': 'এজ "{id}"-এর একটি ধনাত্মক পূর্ণসংখ্যা "cost" প্রয়োজন।',
      'err.EDGE_DUPLICATE': 'এজ "{id}" ও "{other}" একই জোড়া নোডকে যুক্ত করেছে।',
      'err.NO_EXIT': 'বিল্ডিংয়ে অন্তত একটি বহির্গমন প্রয়োজন।',
      'err.NO_START_CANDIDATE': 'বিল্ডিংয়ে অন্তত একটি কক্ষ বা সংযোগস্থল প্রয়োজন।',
      'err.STATE_MISSING': '"initial_state" অবশ্যই একটি অবজেক্ট হতে হবে।',
      'err.STATE_NOT_LIST': 'initial_state.{field} অবশ্যই ID-এর একটি তালিকা হতে হবে।',
      'err.STATE_UNKNOWN_NODE': 'initial_state.blocked_nodes-এ অজানা নোড "{id}" রয়েছে।',
      'err.STATE_NODE_IS_EXIT': 'initial_state.blocked_nodes-এ "{id}" রয়েছে, যা একটি বহির্গমন; বহির্গমনের জন্য closed_exits ব্যবহার করুন।',
      'err.STATE_UNKNOWN_EDGE': 'initial_state.blocked_edges-এ অজানা এজ "{id}" রয়েছে।',
      'err.STATE_UNKNOWN_EXIT': 'initial_state.closed_exits-এ অজানা নোড "{id}" রয়েছে।',
      'err.STATE_NOT_EXIT': 'initial_state.closed_exits-এ "{id}" রয়েছে, যা কোনো বহির্গমন নয়।',
      'err.WARN_ISOLATED_NODE': 'নোড "{id}" কোনো করিডোরের সাথে যুক্ত নয়।'
    }
  };

  let lang = 'en';

  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

  // Bangla mode shows numbers (costs, counts) with Bangla digits.
  function digits(s) {
    return lang === 'bn' ? s.replace(/[0-9]/g, (d) => BN_DIGITS[d]) : s;
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

  function savedLang() {
    try {
      const v = localStorage.getItem('smart-escape-lang');
      return v && STRINGS[v] ? v : null;
    } catch (e) {
      return null;
    }
  }

  SE.i18n = {
    savedLang,
    t, issueText, formatNumber, applyStatic,
    getLang: () => lang,
    setLang(l) {
      if (!STRINGS[l]) return;
      lang = l;
      document.documentElement.lang = l;
      try { localStorage.setItem('smart-escape-lang', l); } catch (e) { /* storage unavailable */ }
      applyStatic();
    },
    languages: () => Object.keys(STRINGS)
  };
})(typeof self !== 'undefined' ? self : this);
