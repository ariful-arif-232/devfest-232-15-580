/*
 * Smart Escape — SVG building map.
 *
 * Draws every node at its supplied x/y coordinate and every corridor as a
 * straight line between its endpoints. The map is built once per imported
 * building; update() then only toggles classes and redraws the route overlay,
 * so the route animation only replays when the route actually changes.
 */
(function (root) {
  'use strict';
  const SE = (root.SmartEscape = root.SmartEscape || {});
  const NS = 'http://www.w3.org/2000/svg';
  const MAX_LABEL = 18;

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    if (attrs) Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(node);
    return node;
  }

  function createMap(svg, building, handlers) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Fit the supplied coordinate system, whatever its scale.
    const xs = building.nodes.map((n) => n.x);
    const ys = building.nodes.map((n) => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const u = span / 700; // size unit so shapes look the same at any scale
    const padX = 90 * u;
    const padY = 55 * u;
    svg.setAttribute('viewBox', [minX - padX, minY - padY, maxX - minX + 2 * padX, maxY - minY + 2 * padY].join(' '));
    svg.style.setProperty('--u', u);

    const R = 21 * u;
    const gEdges = el('g', { class: 'edges' }, svg);
    const gRoute = el('g', { class: 'route-layer' }, svg);
    const gNodes = el('g', { class: 'nodes' }, svg);

    const edgeEls = new Map();
    building.edges.forEach((e) => {
      const a = building.nodeById.get(e.a);
      const b = building.nodeById.get(e.b);
      const g = el('g', { class: 'edge', 'data-key': e.key, tabindex: '0', role: 'button' }, gEdges);
      el('line', { class: 'edge-line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-width': 6 * u }, g);
      el('line', { class: 'edge-hit', x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-width': 22 * u }, g);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const cross = el('g', { class: 'edge-cross', transform: `translate(${mx} ${my})` }, g);
      el('circle', { r: 9 * u }, cross);
      el('path', { d: `M${-4 * u} ${-4 * u}L${4 * u} ${4 * u}M${4 * u} ${-4 * u}L${-4 * u} ${4 * u}`, 'stroke-width': 2.2 * u }, cross);
      // Place the weight beside the corridor (perpendicular offset), above or to the right.
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      let nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
      if (Math.abs(ny) < 0.3) { nx = Math.abs(nx); }
      const w = el('text', { class: 'edge-weight', x: mx + nx * 18 * u, y: my + ny * 18 * u, 'font-size': 15 * u, 'stroke-width': 5 * u, 'dominant-baseline': 'central' }, g);
      w.textContent = String(e.weight);
      g.addEventListener('click', () => handlers.onEdge(e.key));
      g.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handlers.onEdge(e.key); }
      });
      edgeEls.set(e.key, { g, weight: w });
    });

    const nodeEls = new Map();
    building.nodes.forEach((n) => {
      const g = el('g', { class: `node node-${n.type}`, 'data-id': n.id, tabindex: '0', role: 'button', transform: `translate(${n.x} ${n.y})` }, gNodes);
      el('circle', { class: 'node-halo', r: R * 1.55 }, g);
      if (n.type === 'room' || n.type === 'exit') el('rect', { class: 'node-shape', x: -R * 1.15, y: -R * 0.85, width: R * 2.3, height: R * 1.7, rx: 5 * u, 'stroke-width': 3.2 * u }, g);
      else el('circle', { class: 'node-shape', r: R * 0.9, 'stroke-width': 3.2 * u }, g);
      const id = el('text', { class: 'node-id', y: 0, 'font-size': 15 * u }, g);
      id.textContent = n.id;
      const label = el('text', { class: 'node-label', y: R + 20 * u, 'font-size': 13 * u, 'stroke-width': 5 * u }, g);
      el('path', { class: 'node-x', d: `M${-R * 0.5} ${-R * 0.5}L${R * 0.5} ${R * 0.5}M${R * 0.5} ${-R * 0.5}L${-R * 0.5} ${R * 0.5}`, 'stroke-width': 3.8 * u }, g);
      g.addEventListener('click', () => handlers.onNode(n.id));
      g.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handlers.onNode(n.id); }
      });
      const title = el('title', null, g);
      nodeEls.set(n.id, { g, label, title });
    });

    let routeSig = null;

    /**
     * view = { start, blockedNodes, blockedEdges, closedExits, selected,
     *          route, nodeName(node), nodeAria(node), edgeAria(edge) }
     */
    function update(view) {
      const onRoute = new Set(view.route && view.route.status === 'OK' ? view.route.path : []);
      const routeEdges = new Set(view.route && view.route.status === 'OK' ? view.route.edges : []);

      building.nodes.forEach((n) => {
        const { g, label, title } = nodeEls.get(n.id);
        g.classList.toggle('is-start', n.id === view.start);
        g.classList.toggle('is-blocked', view.blockedNodes.has(n.id));
        g.classList.toggle('is-closed', n.type === 'exit' && view.closedExits.has(n.id));
        g.classList.toggle('on-route', onRoute.has(n.id));
        g.classList.toggle('is-target', view.route && view.route.status === 'OK' && view.route.exit === n.id);
        g.classList.toggle('is-selected', !!view.selected && view.selected.kind === 'node' && view.selected.id === n.id);
        // Shorten long dataset labels on the map; the full text stays in the
        // tooltip, the accessible name and the side panel.
        const name = view.nodeName(n);
        label.textContent = name.length > MAX_LABEL ? name.slice(0, MAX_LABEL - 1) + '…' : name;
        title.textContent = n.id + ' · ' + name;
        g.setAttribute('aria-label', view.nodeAria(n));
      });

      building.edges.forEach((e) => {
        const { g, weight } = edgeEls.get(e.key);
        g.classList.toggle('is-blocked', view.blockedEdges.has(e.key));
        g.classList.toggle('on-route', routeEdges.has(e.key));
        g.classList.toggle('is-selected', !!view.selected && view.selected.kind === 'edge' && view.selected.id === e.key);
        weight.textContent = view.formatNumber(e.weight);
        g.setAttribute('aria-label', view.edgeAria(e));
      });

      const sig = view.route && view.route.status === 'OK' ? view.route.path.join('>') : '';
      if (sig !== routeSig) {
        routeSig = sig;
        while (gRoute.firstChild) gRoute.removeChild(gRoute.firstChild);
        if (sig) {
          const pts = view.route.path.map((id) => {
            const n = building.nodeById.get(id);
            return n.x + ',' + n.y;
          }).join(' ');
          el('polyline', { class: 'route-glow', points: pts, 'stroke-width': 16 * u }, gRoute);
          const line = el('polyline', { class: 'route-line', points: pts, 'stroke-width': 6 * u, 'stroke-dasharray': `${14 * u} ${10 * u}` }, gRoute);
          // Restart the draw-in animation for the new route.
          gRoute.classList.remove('route-enter');
          void gRoute.getBoundingClientRect();
          gRoute.classList.add('route-enter');
          line.style.setProperty('--dash', (24 * u) + 'px');
        }
      }
    }

    return { update };
  }

  SE.createMap = createMap;
})(typeof self !== 'undefined' ? self : this);
