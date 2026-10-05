/*
 * Smart Escape — application state and UI wiring.
 *
 * All routes come from findEscapeRoute() on the imported building plus the
 * live hazard state; every hazard change triggers an automatic reroute.
 */
(function () {
  'use strict';
  const SE = window.SmartEscape;
  const I = SE.i18n;
  const t = I.t;

  const $ = (id) => document.getElementById(id);
  const els = {
    file: $('file-input'), sample: $('btn-sample'), reset: $('btn-reset'),
    message: $('import-message'), buildingName: $('building-name'),
    mapPanel: $('map-panel'), map: $('map'), empty: $('map-empty'), dropHint: $('drop-hint'),
    routeCard: $('route-card'), routeBody: $('route-body'), start: $('start-select'),
    inspector: $('inspector'), exits: $('exit-list'), hazards: $('hazard-list'),
    langToggle: $('lang-toggle'), mapAlert: $('map-alert')
  };

  const state = {
    building: null,
    adjacency: null,
    map: null,
    start: null,
    blockedNodes: new Set(),
    blockedEdges: new Set(),
    closedExits: new Set(),
    selected: null, // { kind: 'node' | 'edge', id }
    route: null,
    routeSig: null,
    lastImport: null // { ok, name, errors, warnings, fetchFailed }
  };

  // ---- helpers ------------------------------------------------------------

  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== false && attrs[k] !== undefined) node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
      });
    }
    (children || []).forEach((c) => c && node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function nodeName(n) {
    return I.getLang() === 'bn' && n.labelBn ? n.labelBn : n.label;
  }

  function nodeTitle(id) {
    const n = state.building.nodeById.get(id);
    const name = nodeName(n);
    return name && name !== n.id ? `${n.id} · ${name}` : n.id;
  }

  function canStartAt(n) {
    return n.type !== 'exit' && !state.blockedNodes.has(n.id);
  }

  // ---- loading ------------------------------------------------------------

  function loadText(text, sourceName) {
    const result = SE.parseBuildingJSON(text);
    state.lastImport = { ok: result.ok, name: sourceName, errors: result.errors, warnings: result.warnings };
    if (result.ok) {
      state.building = result.building;
      state.adjacency = SE.buildAdjacency(result.building);
      state.map = SE.createMap(els.map, result.building, { onNode: selectNode, onEdge: selectEdge });
      els.map.removeAttribute('hidden');
      els.empty.hidden = true;
      els.reset.disabled = false;
      els.start.disabled = false;
      state.start = null;
      applyInitialState();
    } else {
      renderMessage();
    }
  }

  // Restore the file's initial_state hazards. The start is the user's choice,
  // so it is kept (and reported as blocked if initial_state blocks it).
  function applyInitialState() {
    const init = state.building.initialState;
    state.blockedNodes = new Set(init.blockedNodes);
    state.blockedEdges = new Set(init.blockedEdges);
    state.closedExits = new Set(init.closedExits);
    state.selected = null;
    recompute();
  }

  // ---- actions ------------------------------------------------------------

  function recompute() {
    state.route = state.building
      ? SE.findEscapeRoute(state.building, state, state.adjacency)
      : null;
    render();
  }

  function selectNode(id) {
    state.selected = { kind: 'node', id };
    render();
  }

  function selectEdge(key) {
    state.selected = { kind: 'edge', id: key };
    render();
  }

  function setStart(id) {
    const n = state.building.nodeById.get(id);
    if (!n || !canStartAt(n)) return;
    state.start = id;
    recompute();
  }

  function toggleNode(id) {
    const n = state.building.nodeById.get(id);
    if (n.type === 'exit') {
      if (state.closedExits.has(id)) state.closedExits.delete(id);
      else state.closedExits.add(id);
    } else if (state.blockedNodes.has(id)) {
      state.blockedNodes.delete(id);
    } else {
      state.blockedNodes.add(id);
    }
    recompute();
  }

  function toggleEdge(key) {
    if (state.blockedEdges.has(key)) state.blockedEdges.delete(key);
    else state.blockedEdges.add(key);
    recompute();
  }

  // ---- rendering ----------------------------------------------------------

  function render() {
    renderLang();
    renderMessage();
    renderTitle();
    renderRoute();
    renderMapAlert();
    if (!state.building) return;
    renderStartSelect();
    renderInspector();
    renderExits();
    renderHazards();
    state.map.update({
      start: state.start,
      blockedNodes: state.blockedNodes,
      blockedEdges: state.blockedEdges,
      closedExits: state.closedExits,
      selected: state.selected,
      route: state.route,
      nodeName,
      formatNumber: I.formatNumber,
      nodeAria: (n) => {
        let s = '';
        if (n.id === state.start) s += ', ' + t('legend.start');
        if (state.blockedNodes.has(n.id)) s += ', ' + t('state.blocked');
        if (n.type === 'exit') s += ', ' + t(state.closedExits.has(n.id) ? 'state.closed' : 'state.open');
        return t('aria.node', { type: t('type.' + n.type), id: n.id, name: nodeName(n), state: s });
      },
      edgeAria: (e) => t('aria.edge', { a: e.a, b: e.b, w: e.weight, state: state.blockedEdges.has(e.key) ? ', ' + t('state.blocked') : '' })
    });
  }

  function renderLang() {
    els.langToggle.setAttribute('aria-label', t('lang.label'));
    els.langToggle.querySelectorAll('[data-lang]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.lang === I.getLang()));
    });
  }

  // The two required failure states are also shown prominently over the map.
  function renderMapAlert() {
    const r = state.route;
    const key = r && r.status === 'START_BLOCKED' ? 'route.startBlocked'
      : r && r.status === 'NO_ROUTE' ? 'route.noRoute' : null;
    if (!key) {
      els.mapAlert.hidden = true;
      els.mapAlert.dataset.key = '';
      return;
    }
    if (els.mapAlert.dataset.key !== key + I.getLang()) {
      els.mapAlert.dataset.key = key + I.getLang();
      clear(els.mapAlert);
      els.mapAlert.appendChild(h('span', { class: 'alert-icon', 'aria-hidden': 'true', text: '!' }));
      els.mapAlert.appendChild(h('span', { text: t(key) }));
    }
    els.mapAlert.hidden = false;
  }

  function renderTitle() {
    const b = state.building;
    if (!b) return;
    const name = I.getLang() === 'bn' && b.nameBn ? b.nameBn : b.name;
    els.buildingName.textContent = name || t('app.tagline');
  }

  function renderMessage() {
    const imp = state.lastImport;
    clear(els.message);
    els.message.className = 'import-message';
    if (!imp) { els.message.hidden = true; return; }
    els.message.hidden = false;
    if (imp.fetchFailed) {
      els.message.classList.add('is-error');
      els.message.appendChild(h('p', { text: t('import.fetchFailed') }));
      return;
    }
    if (!imp.ok) {
      els.message.classList.add('is-error');
      els.message.appendChild(h('p', { text: t('import.failed', { name: imp.name }) }));
      els.message.appendChild(h('ul', null, imp.errors.map((e) => h('li', { text: I.issueText(e) }))));
      if (state.building) els.message.appendChild(h('p', { class: 'muted', text: t('import.keepPrevious') }));
      return;
    }
    const b = state.building;
    els.message.classList.add('is-ok');
    els.message.appendChild(h('p', { text: t('import.loaded', { name: imp.name, nodes: b.nodes.length, edges: b.edges.length }) }));
    if (imp.warnings.length) {
      els.message.appendChild(h('ul', { class: 'warnings', 'aria-label': t('import.warnings') },
        imp.warnings.map((w) => h('li', { text: I.issueText(w) }))));
    }
  }

  function renderRoute() {
    const body = els.routeBody;
    clear(body);
    const r = state.route;
    els.routeCard.dataset.status = r ? r.status : 'NONE';
    // Replay the fade-in only when the route itself changes.
    const sig = r ? r.status + ':' + (r.path || []).join('>') : '';
    if (sig !== state.routeSig) {
      state.routeSig = sig;
      body.classList.remove('fresh');
      void body.offsetWidth;
      body.classList.add('fresh');
    }
    if (!r) { body.appendChild(h('p', { class: 'muted', text: t('route.none') })); return; }

    if (r.status === 'OK') {
      const exit = state.building.nodeById.get(r.exit);
      body.appendChild(h('div', { class: 'route-summary' }, [
        h('p', { class: 'route-exit', text: t('route.ok', { exit: nodeTitle(exit.id) }) }),
        h('p', { class: 'route-cost' }, [
          h('span', { class: 'muted', text: t('route.cost') + ' ' }),
          h('strong', { text: I.formatNumber(r.cost) })
        ])
      ]));
      body.appendChild(h('p', { class: 'route-path', text: r.path.join(' → ') }));
      body.appendChild(h('ol', { class: 'route-steps', 'aria-label': t('route.steps') },
        r.path.map((id) => h('li', { text: nodeTitle(id) }))));
      return;
    }

    const msg = {
      NO_START: ['route.noStart'],
      INVALID_START: ['route.invalidStart'],
      START_BLOCKED: ['route.startBlocked', 'route.startBlockedHelp'],
      NO_ROUTE: ['route.noRoute', 'route.noRouteHelp']
    }[r.status];
    const isFailure = r.status === 'START_BLOCKED' || r.status === 'NO_ROUTE';
    body.appendChild(h('p', { class: isFailure ? 'route-alert' : 'route-info', text: t(msg[0]) }));
    if (msg[1]) body.appendChild(h('p', { class: 'muted', text: t(msg[1]) }));
  }

  function renderStartSelect() {
    const sel = els.start;
    clear(sel);
    sel.appendChild(h('option', { value: '', text: t('start.placeholder'), disabled: true, selected: !state.start }));
    state.building.nodes
      .filter((n) => n.type !== 'exit')
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .forEach((n) => {
        const blocked = state.blockedNodes.has(n.id);
        // Blocked locations cannot be chosen; the current start stays visible.
        if (blocked && n.id !== state.start) return;
        sel.appendChild(h('option', {
          value: n.id,
          disabled: blocked,
          selected: n.id === state.start,
          text: blocked ? t('start.blockedOption', { name: nodeTitle(n.id) }) : nodeTitle(n.id)
        }));
      });
  }

  function renderInspector() {
    const box = els.inspector;
    clear(box);
    const sel = state.selected;
    if (!sel) { box.appendChild(h('p', { class: 'muted', text: t('sel.hint') })); return; }

    if (sel.kind === 'node') {
      const n = state.building.nodeById.get(sel.id);
      const actions = [];
      if (n.type === 'exit') {
        const closed = state.closedExits.has(n.id);
        actions.push(h('button', { type: 'button', class: closed ? 'btn' : 'btn btn-danger', text: t(closed ? 'sel.reopenExit' : 'sel.closeExit'), onclick: () => toggleNode(n.id) }));
      } else {
        const blocked = state.blockedNodes.has(n.id);
        actions.push(h('button', { type: 'button', class: 'btn btn-primary', text: t('sel.setStart'), disabled: blocked || n.id === state.start, onclick: () => setStart(n.id) }));
        actions.push(h('button', { type: 'button', class: blocked ? 'btn' : 'btn btn-danger', text: t(blocked ? 'sel.unblock' : 'sel.block'), onclick: () => toggleNode(n.id) }));
      }
      box.appendChild(h('p', { class: 'sel-title' }, [
        h('span', { class: 'tag tag-' + n.type, text: t('type.' + n.type) }), ' ', h('strong', { text: nodeTitle(n.id) })
      ]));
      box.appendChild(h('div', { class: 'btn-row' }, actions));
      return;
    }

    const e = state.building.edgeByKey.get(sel.id);
    const blocked = state.blockedEdges.has(e.key);
    box.appendChild(h('p', { class: 'sel-title' }, [
      h('strong', { text: t('sel.corridor', { a: e.a, b: e.b }) }), ' ',
      h('span', { class: 'muted', text: t('sel.weight', { w: e.weight }) })
    ]));
    box.appendChild(h('div', { class: 'btn-row' }, [
      h('button', { type: 'button', class: blocked ? 'btn' : 'btn btn-danger', text: t(blocked ? 'sel.unblockEdge' : 'sel.blockEdge'), onclick: () => toggleEdge(e.key) })
    ]));
  }

  function renderExits() {
    clear(els.exits);
    state.building.nodes.filter((n) => n.type === 'exit').forEach((n) => {
      const closed = state.closedExits.has(n.id);
      els.exits.appendChild(h('li', { class: closed ? 'is-closed' : '' }, [
        h('span', { class: 'exit-name', text: nodeTitle(n.id) }),
        h('span', { class: 'pill ' + (closed ? 'pill-closed' : 'pill-open'), text: t(closed ? 'state.closed' : 'state.open') }),
        h('button', { type: 'button', class: 'btn btn-small', text: t(closed ? 'sel.reopenExit' : 'sel.closeExit'), onclick: () => toggleNode(n.id) })
      ]));
    });
  }

  function renderHazards() {
    clear(els.hazards);
    const items = [];
    Array.from(state.blockedNodes).sort().forEach((id) => {
      items.push([t('haz.blockedNode', { name: nodeTitle(id) }), () => toggleNode(id)]);
    });
    Array.from(state.blockedEdges).sort().forEach((key) => {
      const e = state.building.edgeByKey.get(key);
      items.push([t('haz.blockedEdge', { a: e.a, b: e.b }), () => toggleEdge(key)]);
    });
    Array.from(state.closedExits).sort().forEach((id) => {
      items.push([t('haz.closedExit', { name: nodeTitle(id) }), () => toggleNode(id)]);
    });
    if (!items.length) {
      els.hazards.appendChild(h('li', { class: 'muted', text: t('haz.none') }));
      return;
    }
    items.forEach(([label, undo]) => {
      els.hazards.appendChild(h('li', null, [
        h('span', { text: label }),
        h('button', { type: 'button', class: 'btn btn-small', text: t('haz.clear'), onclick: undo })
      ]));
    });
  }

  // ---- events -------------------------------------------------------------

  els.file.addEventListener('change', () => {
    const f = els.file.files[0];
    if (!f) return;
    f.text().then((text) => loadText(text, f.name));
    els.file.value = '';
  });

  els.sample.addEventListener('click', () => {
    fetch('building.json', { cache: 'no-store' })
      .then((res) => { if (!res.ok) throw new Error(res.status); return res.text(); })
      .then((text) => loadText(text, 'building.json'))
      .catch(() => { state.lastImport = { fetchFailed: true }; render(); });
  });

  els.reset.addEventListener('click', () => { if (state.building) applyInitialState(); });

  els.start.addEventListener('change', () => setStart(els.start.value));

  // Drag and drop a JSON file onto the map.
  let dragDepth = 0;
  els.mapPanel.addEventListener('dragenter', (ev) => { ev.preventDefault(); dragDepth++; els.dropHint.hidden = false; });
  els.mapPanel.addEventListener('dragover', (ev) => ev.preventDefault());
  els.mapPanel.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; els.dropHint.hidden = true; } });
  els.mapPanel.addEventListener('drop', (ev) => {
    ev.preventDefault();
    dragDepth = 0;
    els.dropHint.hidden = true;
    const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (f) f.text().then((text) => loadText(text, f.name));
  });

  els.langToggle.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-lang]');
    if (!btn || btn.dataset.lang === I.getLang()) return;
    I.setLang(btn.dataset.lang);
    render();
  });

  I.setLang(I.savedLang() || 'en');
  render();
})();
