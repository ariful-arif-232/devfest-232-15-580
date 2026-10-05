/*
 * Smart Escape — building JSON import and validation.
 *
 * Validates the official Smart Escape schema strictly:
 *   building       non-empty string
 *   nodes[]        { id, label, type: room | junction | exit, x, y }
 *   edges[]        { id, from, to, cost }  (undirected, positive integer cost)
 *   initial_state  { blocked_nodes[], blocked_edges[], closed_exits[] }
 * Limits: 2–60 nodes, 1–150 edges, at least one room/junction and one exit.
 * IDs are case-sensitive. Disconnected graphs are valid.
 *
 * Every problem is reported as { code, params, message } so the UI can show
 * it in either language.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SmartEscape = Object.assign(root.SmartEscape || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NODE_TYPES = ['room', 'junction', 'exit'];
  const LIMITS = { minNodes: 2, maxNodes: 60, minEdges: 1, maxEdges: 150 };
  const STATE_FIELDS = ['blocked_nodes', 'blocked_edges', 'closed_exits'];

  const MESSAGES = {
    INVALID_JSON: 'The file is not valid JSON ({detail}).',
    NOT_OBJECT: 'The top level of the file must be a JSON object.',
    BAD_BUILDING: '"building" must be a non-empty building name.',
    NODES_NOT_LIST: '"nodes" must be a list.',
    EDGES_NOT_LIST: '"edges" must be a list.',
    NODE_COUNT: 'The building must have between {min} and {max} nodes (found {count}).',
    EDGE_COUNT: 'The building must have between {min} and {max} edges (found {count}).',
    NODE_NOT_OBJECT: 'Node #{index} is not an object.',
    NODE_NO_ID: 'Node #{index} needs a non-empty text "id".',
    NODE_DUPLICATE_ID: 'Node id "{id}" is used more than once.',
    NODE_NO_LABEL: 'Node "{id}" needs a non-empty "label".',
    NODE_BAD_TYPE: 'Node "{id}" has type "{type}"; it must be room, junction or exit.',
    NODE_BAD_COORD: 'Node "{id}" needs numeric "x" and "y" coordinates.',
    EDGE_NOT_OBJECT: 'Edge #{index} is not an object.',
    EDGE_NO_ID: 'Edge #{index} needs a non-empty text "id".',
    EDGE_DUPLICATE_ID: 'Edge id "{id}" is used more than once.',
    EDGE_UNKNOWN_NODE: 'Edge "{id}" refers to unknown node "{node}".',
    EDGE_SELF_LOOP: 'Edge "{id}" connects "{node}" to itself.',
    EDGE_BAD_COST: 'Edge "{id}" needs a positive integer "cost".',
    EDGE_DUPLICATE: 'Edges "{id}" and "{other}" connect the same pair of nodes.',
    NO_EXIT: 'The building needs at least one exit.',
    NO_START_CANDIDATE: 'The building needs at least one room or junction.',
    STATE_MISSING: '"initial_state" must be an object.',
    STATE_NOT_LIST: 'initial_state.{field} must be a list of IDs.',
    STATE_UNKNOWN_NODE: 'initial_state.blocked_nodes contains unknown node "{id}".',
    STATE_NODE_IS_EXIT: 'initial_state.blocked_nodes contains "{id}", which is an exit; use closed_exits for exits.',
    STATE_UNKNOWN_EDGE: 'initial_state.blocked_edges contains unknown edge "{id}".',
    STATE_UNKNOWN_EXIT: 'initial_state.closed_exits contains unknown node "{id}".',
    STATE_NOT_EXIT: 'initial_state.closed_exits contains "{id}", which is not an exit.',
    WARN_ISOLATED_NODE: 'Node "{id}" is not connected to any corridor.'
  };

  function format(template, params) {
    return template.replace(/\{(\w+)\}/g, (m, k) => (params && k in params ? String(params[k]) : m));
  }

  function issue(code, params) {
    params = params || {};
    return { code, params, message: format(MESSAGES[code] || code, params) };
  }

  function edgeKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
  }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  // IDs are case-sensitive non-empty strings, used exactly as written.
  function isId(v) {
    return typeof v === 'string' && v.length > 0;
  }

  function show(v) {
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  function parseBuildingJSON(text) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (err) {
      return { ok: false, errors: [issue('INVALID_JSON', { detail: err.message })], warnings: [], building: null };
    }
    return validateBuilding(raw);
  }

  function validateBuilding(raw) {
    const errors = [];
    const warnings = [];
    const fail = () => ({ ok: false, errors, warnings, building: null });

    if (!isPlainObject(raw)) {
      errors.push(issue('NOT_OBJECT'));
      return fail();
    }

    if (typeof raw.building !== 'string' || !raw.building.trim()) errors.push(issue('BAD_BUILDING'));

    // ---- Nodes -----------------------------------------------------------
    const nodes = [];
    const nodeById = new Map();
    if (!Array.isArray(raw.nodes)) {
      errors.push(issue('NODES_NOT_LIST'));
    } else {
      const count = raw.nodes.length;
      if (count < LIMITS.minNodes || count > LIMITS.maxNodes) {
        errors.push(issue('NODE_COUNT', { min: LIMITS.minNodes, max: LIMITS.maxNodes, count }));
      }
      raw.nodes.forEach((n, i) => {
        const index = i + 1;
        if (!isPlainObject(n)) { errors.push(issue('NODE_NOT_OBJECT', { index })); return; }
        if (!isId(n.id)) { errors.push(issue('NODE_NO_ID', { index })); return; }
        const id = n.id;
        if (nodeById.has(id)) { errors.push(issue('NODE_DUPLICATE_ID', { id })); return; }
        if (typeof n.label !== 'string' || !n.label.trim()) errors.push(issue('NODE_NO_LABEL', { id }));
        if (!NODE_TYPES.includes(n.type)) errors.push(issue('NODE_BAD_TYPE', { id, type: show(n.type) }));
        if (typeof n.x !== 'number' || typeof n.y !== 'number' || !Number.isFinite(n.x) || !Number.isFinite(n.y)) {
          errors.push(issue('NODE_BAD_COORD', { id }));
        }
        const node = { id, type: n.type, x: n.x, y: n.y, label: typeof n.label === 'string' ? n.label : id, labelBn: null };
        nodes.push(node);
        nodeById.set(id, node);
      });
    }

    // ---- Edges -----------------------------------------------------------
    const edges = [];
    const edgeByKey = new Map();
    const edgeById = new Map();
    if (!Array.isArray(raw.edges)) {
      errors.push(issue('EDGES_NOT_LIST'));
    } else {
      const count = raw.edges.length;
      if (count < LIMITS.minEdges || count > LIMITS.maxEdges) {
        errors.push(issue('EDGE_COUNT', { min: LIMITS.minEdges, max: LIMITS.maxEdges, count }));
      }
      const seenIds = new Set();
      raw.edges.forEach((e, i) => {
        const index = i + 1;
        if (!isPlainObject(e)) { errors.push(issue('EDGE_NOT_OBJECT', { index })); return; }
        if (!isId(e.id)) { errors.push(issue('EDGE_NO_ID', { index })); return; }
        const id = e.id;
        if (seenIds.has(id)) { errors.push(issue('EDGE_DUPLICATE_ID', { id })); return; }
        seenIds.add(id);

        let bad = false;
        [e.from, e.to].forEach((end) => {
          if (!isId(end) || !nodeById.has(end)) { errors.push(issue('EDGE_UNKNOWN_NODE', { id, node: show(end) })); bad = true; }
        });
        if (!bad && e.from === e.to) { errors.push(issue('EDGE_SELF_LOOP', { id, node: e.from })); bad = true; }
        if (typeof e.cost !== 'number' || !Number.isInteger(e.cost) || e.cost <= 0) {
          errors.push(issue('EDGE_BAD_COST', { id }));
          bad = true;
        }
        if (bad) return;

        const key = edgeKey(e.from, e.to);
        if (edgeByKey.has(key)) { errors.push(issue('EDGE_DUPLICATE', { id, other: edgeByKey.get(key).id })); return; }
        const edge = { id, key, a: e.from, b: e.to, weight: e.cost };
        edges.push(edge);
        edgeByKey.set(key, edge);
        edgeById.set(id, edge);
      });
    }

    // ---- Whole-graph checks ---------------------------------------------
    if (nodes.length) {
      if (!nodes.some((n) => n.type === 'exit')) errors.push(issue('NO_EXIT'));
      if (!nodes.some((n) => n.type === 'room' || n.type === 'junction')) errors.push(issue('NO_START_CANDIDATE'));
    }

    // ---- initial_state ---------------------------------------------------
    const initialState = { start: null, blockedNodes: [], blockedEdges: [], closedExits: [] };
    const st = raw.initial_state;
    if (!isPlainObject(st)) {
      errors.push(issue('STATE_MISSING'));
    } else {
      STATE_FIELDS.forEach((field) => {
        if (!Array.isArray(st[field])) errors.push(issue('STATE_NOT_LIST', { field }));
      });
      const list = (field) => (Array.isArray(st[field]) ? st[field] : []);
      const addOnce = (arr, v) => { if (!arr.includes(v)) arr.push(v); };

      list('blocked_nodes').forEach((v) => {
        const node = isId(v) ? nodeById.get(v) : null;
        if (!node) errors.push(issue('STATE_UNKNOWN_NODE', { id: show(v) }));
        else if (node.type === 'exit') errors.push(issue('STATE_NODE_IS_EXIT', { id: v }));
        else addOnce(initialState.blockedNodes, v);
      });
      list('blocked_edges').forEach((v) => {
        const edge = isId(v) ? edgeById.get(v) : null;
        if (!edge) errors.push(issue('STATE_UNKNOWN_EDGE', { id: show(v) }));
        else addOnce(initialState.blockedEdges, edge.key);
      });
      list('closed_exits').forEach((v) => {
        const node = isId(v) ? nodeById.get(v) : null;
        if (!node) errors.push(issue('STATE_UNKNOWN_EXIT', { id: show(v) }));
        else if (node.type !== 'exit') errors.push(issue('STATE_NOT_EXIT', { id: v }));
        else addOnce(initialState.closedExits, v);
      });
    }

    if (errors.length) return fail();

    // Disconnected graphs are valid; isolated nodes only get a warning.
    const degree = new Map(nodes.map((n) => [n.id, 0]));
    edges.forEach((e) => { degree.set(e.a, degree.get(e.a) + 1); degree.set(e.b, degree.get(e.b) + 1); });
    nodes.forEach((n) => { if (degree.get(n.id) === 0) warnings.push(issue('WARN_ISOLATED_NODE', { id: n.id })); });

    return {
      ok: true,
      errors,
      warnings,
      building: { name: raw.building.trim(), nameBn: '', nodes, nodeById, edges, edgeByKey, edgeById, initialState }
    };
  }

  return { parseBuildingJSON, validateBuilding, edgeKey, formatMessage: format, VALIDATION_MESSAGES: MESSAGES, LIMITS };
});
