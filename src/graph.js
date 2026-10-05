/*
 * Smart Escape — undirected weighted graph and deterministic Dijkstra routing.
 *
 * Routes are always computed from the imported building and the live hazard
 * state; nothing about the sample building is hard-coded here.
 *
 * Exact routing rule (deterministic):
 *   1. minimum total cost (sum of edge costs);
 *   2. on equal cost, the lexicographically smallest exit ID;
 *   3. if paths to that exit also tie, the lexicographically smallest sequence
 *      of node IDs (compared ID by ID, plain string order).
 * Blocked nodes (and so their corridors), blocked edges and closed exits are
 * excluded entirely, including as intermediate nodes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SmartEscape = Object.assign(root.SmartEscape || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EPS = 1e-9;

  function edgeKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
  }

  /** Adjacency list for an undirected graph; neighbours sorted by id. */
  function buildAdjacency(building) {
    const adj = new Map();
    building.nodes.forEach((n) => adj.set(n.id, []));
    building.edges.forEach((e) => {
      adj.get(e.a).push({ to: e.b, weight: e.weight, key: e.key });
      adj.get(e.b).push({ to: e.a, weight: e.weight, key: e.key });
    });
    adj.forEach((list) => list.sort((p, q) => (p.to < q.to ? -1 : p.to > q.to ? 1 : 0)));
    return adj;
  }

  function comparePaths(p, q) {
    const n = Math.min(p.length, q.length);
    for (let i = 0; i < n; i++) {
      if (p[i] !== q[i]) return p[i] < q[i] ? -1 : 1;
    }
    return p.length - q.length;
  }

  /** Is (costA, pathA) strictly better than (costB, pathB)? */
  function better(costA, pathA, costB, pathB) {
    if (costB === undefined) return true;
    if (costA < costB - EPS) return true;
    if (costA > costB + EPS) return false;
    return comparePaths(pathA, pathB) < 0;
  }

  function toSet(v) {
    return v instanceof Set ? v : new Set(v || []);
  }

  /**
   * Find the lowest-cost route from state.start to any open exit.
   *
   * state = { start, blockedNodes, blockedEdges, closedExits }
   *   blockedNodes / closedExits: node ids; blockedEdges: edge keys ("A|B").
   *
   * Returns one of
   *   { status: 'OK', path, edges, cost, exit }
   *   { status: 'NO_START' }          no start chosen
   *   { status: 'INVALID_START' }     start is unknown or is an exit
   *   { status: 'START_BLOCKED' }     the start location itself is blocked
   *   { status: 'NO_ROUTE' }          no open exit can be reached
   */
  function findEscapeRoute(building, state, adjacency) {
    const start = state && state.start;
    if (!start) return { status: 'NO_START' };
    const startNode = building.nodeById.get(start);
    if (!startNode || startNode.type === 'exit') return { status: 'INVALID_START' };

    const blockedNodes = toSet(state.blockedNodes);
    const blockedEdges = toSet(state.blockedEdges);
    const closedExits = toSet(state.closedExits);
    if (blockedNodes.has(start)) return { status: 'START_BLOCKED' };

    const adj = adjacency || buildAdjacency(building);
    const passable = (id) => {
      if (blockedNodes.has(id)) return false;
      const node = building.nodeById.get(id);
      return !(node.type === 'exit' && closedExits.has(id));
    };

    const dist = new Map([[start, 0]]);
    const path = new Map([[start, [start]]]);
    const settled = new Set();

    for (;;) {
      // Pick the cheapest unsettled node (ties broken by path order).
      let u = null;
      dist.forEach((d, id) => {
        if (settled.has(id)) return;
        if (u === null || better(d, path.get(id), dist.get(u), path.get(u))) u = id;
      });
      if (u === null) break;
      settled.add(u);

      // Reaching an exit means leaving the building: do not route through it.
      if (building.nodeById.get(u).type === 'exit') continue;

      const du = dist.get(u);
      for (const { to, weight, key } of adj.get(u)) {
        if (settled.has(to) || blockedEdges.has(key) || !passable(to)) continue;
        const nd = du + weight;
        const candidate = path.get(u).concat(to);
        if (better(nd, candidate, dist.get(to), path.get(to))) {
          dist.set(to, nd);
          path.set(to, candidate);
        }
      }
    }

    // Each node's path is already the smallest node-ID sequence among its
    // cheapest paths; choose the exit by cost, then by exit ID.
    let best = null;
    building.nodes.forEach((n) => {
      if (n.type !== 'exit' || !dist.has(n.id)) return;
      const d = dist.get(n.id);
      if (best === null || d < best.cost - EPS || (Math.abs(d - best.cost) <= EPS && n.id < best.exit)) {
        best = { cost: d, path: path.get(n.id), exit: n.id };
      }
    });
    if (!best) return { status: 'NO_ROUTE' };

    const edges = [];
    for (let i = 1; i < best.path.length; i++) edges.push(edgeKey(best.path[i - 1], best.path[i]));
    return { status: 'OK', path: best.path.slice(), edges, cost: roundCost(best.cost), exit: best.exit };
  }

  function roundCost(c) {
    return Math.round(c * 1e6) / 1e6;
  }

  return { buildAdjacency, findEscapeRoute, comparePaths, edgeKey };
});
