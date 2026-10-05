/*
 * Smart Escape — building JSON import and validation.
 *
 * Accepts a building description, checks it thoroughly and returns a
 * normalised model. Field names are read tolerantly (e.g. `weight` / `cost` /
 * `distance`, `from` / `source`) so slightly different JSON layouts still load.
 * Every problem is reported as { code, params, message } so the UI can show it
 * in either language.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SmartEscape = Object.assign(root.SmartEscape || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TYPE_ALIASES = {
    room: 'room', office: 'room', classroom: 'room', lab: 'room', hall_room: 'room',
    junction: 'junction', corridor: 'junction', hallway: 'junction', hall: 'junction',
    intersection: 'junction', stairs: 'junction', stair: 'junction', lobby: 'junction',
    exit: 'exit', emergency_exit: 'exit', fire_exit: 'exit'
  };

  const MESSAGES = {
    INVALID_JSON: 'The file is not valid JSON ({detail}).',
    NOT_OBJECT: 'The top level of the file must be a JSON object.',
    NO_NODES: 'No "nodes" list was found.',
    NO_EDGES: 'No "edges" list was found.',
    NODE_NOT_OBJECT: 'Node #{index} is not an object.',
    NODE_NO_ID: 'Node #{index} has no "id".',
    NODE_DUPLICATE_ID: 'Node id "{id}" is used more than once.',
    NODE_BAD_TYPE: 'Node "{id}" has unknown type "{type}" (use room, junction or exit).',
    NODE_BAD_COORD: 'Node "{id}" needs numeric "x" and "y" coordinates.',
    EDGE_NOT_OBJECT: 'Corridor #{index} is not an object.',
    EDGE_MISSING_END: 'Corridor #{index} needs both endpoints ("from" and "to").',
    EDGE_UNKNOWN_NODE: 'Corridor #{index} refers to unknown node "{id}".',
    EDGE_SELF_LOOP: 'Corridor #{index} connects "{id}" to itself.',
    EDGE_BAD_WEIGHT: 'Corridor #{index} ({a}–{b}) needs a finite, non-negative "weight".',
    EDGE_DUPLICATE: 'There is more than one corridor between "{a}" and "{b}".',
    EDGE_DUPLICATE_ID: 'Corridor id "{id}" is used more than once.',
    EXIT_UNKNOWN: 'The "exits" list refers to unknown node "{id}".',
    NO_EXIT: 'The building has no exit nodes.',
    NO_START_CANDIDATE: 'The building has no room or junction to start from.',
    STATE_UNKNOWN_START: 'initial_state.start "{id}" is not a node.',
    STATE_START_IS_EXIT: 'initial_state.start "{id}" must be a room or junction, not an exit.',
    STATE_UNKNOWN_NODE: 'initial_state blocks unknown node "{id}".',
    STATE_UNKNOWN_EDGE: 'initial_state blocks unknown corridor "{id}".',
    STATE_UNKNOWN_EXIT: 'initial_state closes "{id}", which is not an exit.',
    STATE_NOT_LIST: 'initial_state.{field} must be a list.',
    WARN_EXIT_AS_BLOCKED: 'Exit "{id}" was listed in blocked_nodes; it is treated as a closed exit.',
    WARN_ISOLATED_NODE: 'Node "{id}" is not connected to any corridor.',
    WARN_NO_INITIAL_STATE: 'No initial_state was found; starting with nothing blocked.'
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

  function pick(obj, names) {
    for (const n of names) if (obj[n] !== undefined && obj[n] !== null) return obj[n];
    return undefined;
  }

  function toList(value) {
    if (Array.isArray(value)) return value;
    if (isPlainObject(value)) {
      return Object.keys(value).map((k) =>
        isPlainObject(value[k]) ? Object.assign({ id: k }, value[k]) : value[k]);
    }
    return null;
  }

  function idOf(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
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

    // Data may sit at the top level or inside a "building" object.
    const src = isPlainObject(raw.building) && (raw.building.nodes || raw.building.edges) ? raw.building : raw;
    const meta = isPlainObject(raw.building) ? raw.building : {};

    // ---- Nodes -----------------------------------------------------------
    const nodesRaw = toList(pick(src, ['nodes', 'locations', 'vertices']));
    if (!nodesRaw) {
      errors.push(issue('NO_NODES'));
      return fail();
    }

    const nodes = [];
    const nodeById = new Map();
    nodesRaw.forEach((n, i) => {
      const index = i + 1;
      if (!isPlainObject(n)) { errors.push(issue('NODE_NOT_OBJECT', { index })); return; }
      const id = idOf(n.id);
      if (!id) { errors.push(issue('NODE_NO_ID', { index })); return; }
      if (nodeById.has(id)) { errors.push(issue('NODE_DUPLICATE_ID', { id })); return; }

      const rawType = pick(n, ['type', 'kind', 'category']);
      let type = typeof rawType === 'string' ? TYPE_ALIASES[rawType.trim().toLowerCase()] : undefined;
      if (!type && (n.is_exit === true || n.exit === true)) type = 'exit';
      if (!type) { errors.push(issue('NODE_BAD_TYPE', { id, type: rawType === undefined ? '' : rawType })); }

      const pos = isPlainObject(n.position) ? n.position : n;
      const x = pos.x;
      const y = pos.y;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
        errors.push(issue('NODE_BAD_COORD', { id }));
      }

      const labelBn = pick(n, ['label_bn', 'name_bn', 'labelBn', 'nameBn']) ||
        (isPlainObject(n.label) ? n.label.bn : undefined) || (isPlainObject(n.name) ? n.name.bn : undefined);
      let label = pick(n, ['label', 'name', 'title']);
      if (isPlainObject(label)) label = label.en;
      const node = {
        id,
        type: type || 'junction',
        x, y,
        label: typeof label === 'string' && label.trim() ? label.trim() : id,
        labelBn: typeof labelBn === 'string' && labelBn.trim() ? labelBn.trim() : null
      };
      nodes.push(node);
      nodeById.set(id, node);
    });

    // An optional separate "exits" list marks nodes as exits.
    const exitsRaw = toList(src.exits);
    if (exitsRaw) {
      exitsRaw.forEach((e) => {
        const id = idOf(isPlainObject(e) ? pick(e, ['id', 'node', 'node_id']) : e);
        const node = nodeById.get(id);
        if (!node) errors.push(issue('EXIT_UNKNOWN', { id }));
        else node.type = 'exit';
      });
    }

    // ---- Edges -----------------------------------------------------------
    const edgesRaw = toList(pick(src, ['edges', 'corridors', 'connections', 'links']));
    if (!edgesRaw) {
      errors.push(issue('NO_EDGES'));
      return fail();
    }

    const edges = [];
    const edgeByKey = new Map();
    const edgeById = new Map();
    edgesRaw.forEach((e, i) => {
      const index = i + 1;
      let a, b, w, id;
      if (Array.isArray(e)) {
        [a, b, w] = e;
      } else if (isPlainObject(e)) {
        a = pick(e, ['from', 'source', 'a', 'u', 'start']);
        b = pick(e, ['to', 'target', 'b', 'v', 'end']);
        if ((a === undefined || b === undefined) && Array.isArray(e.nodes)) [a, b] = e.nodes;
        w = pick(e, ['weight', 'cost', 'distance', 'length', 'w']);
        id = idOf(e.id);
      } else {
        errors.push(issue('EDGE_NOT_OBJECT', { index }));
        return;
      }
      a = idOf(a);
      b = idOf(b);
      if (!a || !b) { errors.push(issue('EDGE_MISSING_END', { index })); return; }
      let bad = false;
      if (!nodeById.has(a)) { errors.push(issue('EDGE_UNKNOWN_NODE', { index, id: a })); bad = true; }
      if (!nodeById.has(b)) { errors.push(issue('EDGE_UNKNOWN_NODE', { index, id: b })); bad = true; }
      if (a === b) { errors.push(issue('EDGE_SELF_LOOP', { index, id: a })); bad = true; }
      if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) {
        errors.push(issue('EDGE_BAD_WEIGHT', { index, a, b }));
        bad = true;
      }
      if (bad) return;

      const key = edgeKey(a, b);
      if (edgeByKey.has(key)) { errors.push(issue('EDGE_DUPLICATE', { a, b })); return; }
      if (!id) id = a + '-' + b;
      if (edgeById.has(id)) { errors.push(issue('EDGE_DUPLICATE_ID', { id })); return; }
      const edge = { id, key, a, b, weight: w };
      edges.push(edge);
      edgeByKey.set(key, edge);
      edgeById.set(id, edge);
    });

    // ---- Whole-graph checks ---------------------------------------------
    if (!nodes.some((n) => n.type === 'exit')) errors.push(issue('NO_EXIT'));
    if (!nodes.some((n) => n.type !== 'exit')) errors.push(issue('NO_START_CANDIDATE'));

    const degree = new Map(nodes.map((n) => [n.id, 0]));
    edges.forEach((e) => { degree.set(e.a, degree.get(e.a) + 1); degree.set(e.b, degree.get(e.b) + 1); });
    nodes.forEach((n) => { if (degree.get(n.id) === 0) warnings.push(issue('WARN_ISOLATED_NODE', { id: n.id })); });

    // ---- initial_state ---------------------------------------------------
    const isRaw = pick(raw, ['initial_state', 'initialState']) || pick(src, ['initial_state', 'initialState']);
    const initialState = { start: null, blockedNodes: [], blockedEdges: [], closedExits: [] };
    if (!isPlainObject(isRaw)) {
      warnings.push(issue('WARN_NO_INITIAL_STATE'));
    } else {
      const startRaw = pick(isRaw, ['start', 'start_node', 'start_location', 'startNode', 'current_location', 'user_location']);
      if (startRaw !== undefined) {
        const start = idOf(startRaw);
        const node = nodeById.get(start);
        if (!node) errors.push(issue('STATE_UNKNOWN_START', { id: start }));
        else if (node.type === 'exit') errors.push(issue('STATE_START_IS_EXIT', { id: start }));
        else initialState.start = start;
      }

      const listField = (names, field) => {
        const v = pick(isRaw, names);
        if (v === undefined) return [];
        if (!Array.isArray(v)) { errors.push(issue('STATE_NOT_LIST', { field })); return []; }
        return v;
      };

      listField(['blocked_nodes', 'blockedNodes', 'blocked_locations'], 'blocked_nodes').forEach((v) => {
        const id = idOf(v);
        const node = nodeById.get(id);
        if (!node) errors.push(issue('STATE_UNKNOWN_NODE', { id }));
        else if (node.type === 'exit') {
          warnings.push(issue('WARN_EXIT_AS_BLOCKED', { id }));
          if (!initialState.closedExits.includes(id)) initialState.closedExits.push(id);
        } else if (!initialState.blockedNodes.includes(id)) initialState.blockedNodes.push(id);
      });

      listField(['blocked_edges', 'blockedEdges', 'blocked_corridors', 'blockedCorridors'], 'blocked_edges').forEach((v) => {
        const edge = resolveEdgeRef(v, edgeById, edgeByKey);
        if (!edge) errors.push(issue('STATE_UNKNOWN_EDGE', { id: describeEdgeRef(v) }));
        else if (!initialState.blockedEdges.includes(edge.key)) initialState.blockedEdges.push(edge.key);
      });

      listField(['closed_exits', 'closedExits', 'blocked_exits'], 'closed_exits').forEach((v) => {
        const id = idOf(v);
        const node = nodeById.get(id);
        if (!node || node.type !== 'exit') errors.push(issue('STATE_UNKNOWN_EXIT', { id }));
        else if (!initialState.closedExits.includes(id)) initialState.closedExits.push(id);
      });
    }

    if (errors.length) return fail();

    const name = typeof meta.name === 'string' ? meta.name : (typeof raw.name === 'string' ? raw.name : '');
    const nameBn = typeof meta.name_bn === 'string' ? meta.name_bn : (typeof raw.name_bn === 'string' ? raw.name_bn : '');
    return {
      ok: true,
      errors,
      warnings,
      building: { name, nameBn, nodes, nodeById, edges, edgeByKey, edgeById, initialState }
    };
  }

  // A blocked corridor may be written as its id, "A-B", ["A","B"] or {from,to}.
  function resolveEdgeRef(v, edgeById, edgeByKey) {
    if (typeof v === 'string') {
      const s = v.trim();
      if (edgeById.has(s)) return edgeById.get(s);
      const parts = s.split(/\s*(?:\||-|–|,|\/)\s*/);
      if (parts.length === 2) return edgeByKey.get(edgeKey(parts[0], parts[1])) || null;
      return null;
    }
    if (Array.isArray(v) && v.length === 2) return edgeByKey.get(edgeKey(idOf(v[0]), idOf(v[1]))) || null;
    if (isPlainObject(v)) {
      if (v.id !== undefined && edgeById.has(idOf(v.id))) return edgeById.get(idOf(v.id));
      const a = idOf(pick(v, ['from', 'source', 'a', 'u']));
      const b = idOf(pick(v, ['to', 'target', 'b', 'v']));
      return edgeByKey.get(edgeKey(a, b)) || null;
    }
    return null;
  }

  function describeEdgeRef(v) {
    try { return typeof v === 'string' ? v : JSON.stringify(v); } catch (e) { return String(v); }
  }

  return { parseBuildingJSON, validateBuilding, edgeKey, formatMessage: format, VALIDATION_MESSAGES: MESSAGES };
});
