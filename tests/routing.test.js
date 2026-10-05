'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseBuildingJSON, validateBuilding } = require('../src/validate.js');
const { findEscapeRoute, edgeKey } = require('../src/graph.js');

const officialText = fs.readFileSync(path.join(__dirname, '..', 'building.json'), 'utf8');

function load(text = officialText) {
  const result = parseBuildingJSON(text);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.building;
}

// Each check starts from initial_state, as in the official sample checks.
function state(building, start, overrides = {}) {
  const init = building.initialState;
  return {
    start,
    blockedNodes: new Set(init.blockedNodes),
    blockedEdges: new Set(init.blockedEdges),
    closedExits: new Set(init.closedExits),
    ...overrides
  };
}

function valid(raw) {
  const v = validateBuilding(raw);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  return v.building;
}

function codes(raw) {
  return validateBuilding(raw).errors.map((e) => e.code);
}

// ---- Official building.json --------------------------------------------

test('official building.json imports cleanly', () => {
  const b = load();
  assert.equal(b.name, 'East Annex - Practice Building');
  assert.equal(b.nodes.length, 8);
  assert.equal(b.edges.length, 9);
  assert.deepEqual(b.initialState, { start: null, blockedNodes: [], blockedEdges: [], closedExits: [] });
});

test('official check 1 — Baseline: select R1', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, 'R1'));
  assert.equal(r.status, 'OK');
  assert.deepEqual(r.path, ['R1', 'C1', 'C2', 'E1']);
  assert.equal(r.exit, 'E1');
  assert.equal(r.cost, 7);
});

test('official check 2 — Blocked junction: select R1, block C2', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, 'R1', { blockedNodes: new Set(['C2']) }));
  assert.equal(r.status, 'OK');
  assert.deepEqual(r.path, ['R1', 'C1', 'C3', 'C4', 'E2']);
  assert.equal(r.exit, 'E2');
  assert.equal(r.cost, 11);
});

test('official check 3 — Exits closed: select R1, close E1 and E2', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, 'R1', { closedExits: new Set(['E1', 'E2']) }));
  assert.equal(r.status, 'NO_ROUTE');
});

test('official check 4 — Different start: select R2', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, 'R2'));
  assert.equal(r.status, 'OK');
  assert.deepEqual(r.path, ['R2', 'C3', 'C4', 'E2']);
  assert.equal(r.cost, 7);
});

test('official check 5 — Blocked start: select R1, then block R1', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, 'R1', { blockedNodes: new Set(['R1']) }));
  assert.equal(r.status, 'START_BLOCKED');
});

test('a blocked corridor removes only that connection', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, 'R1', { blockedEdges: new Set([edgeKey('C2', 'E1')]) }));
  // C2 is still reachable; best is now R1-C1-C2-C4-E2 = 10.
  assert.deepEqual(r.path, ['R1', 'C1', 'C2', 'C4', 'E2']);
  assert.equal(r.cost, 10);
});

test('no start selected yet', () => {
  const b = load();
  assert.equal(findEscapeRoute(b, state(b, null)).status, 'NO_START');
});

// ---- Exact tie-break rule ------------------------------------------------

test('tie-break: equal cost picks the smallest exit ID before path order', () => {
  // S-A-E2 and S-B-E1 both cost 2. Path S,A,E2 is lexicographically smaller,
  // but the rule compares exit IDs first, so E1 must win.
  const b = valid({
    building: 'Tie test',
    nodes: [
      { id: 'S', label: 'Start', type: 'room', x: 0, y: 0 },
      { id: 'A', label: 'A', type: 'junction', x: 1, y: -1 },
      { id: 'B', label: 'B', type: 'junction', x: 1, y: 1 },
      { id: 'E2', label: 'Exit 2', type: 'exit', x: 2, y: -1 },
      { id: 'E1', label: 'Exit 1', type: 'exit', x: 2, y: 1 }
    ],
    edges: [
      { id: 'a', from: 'S', to: 'A', cost: 1 }, { id: 'b', from: 'A', to: 'E2', cost: 1 },
      { id: 'c', from: 'S', to: 'B', cost: 1 }, { id: 'd', from: 'B', to: 'E1', cost: 1 }
    ],
    initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] }
  });
  const r = findEscapeRoute(b, state(b, 'S'));
  assert.equal(r.exit, 'E1');
  assert.deepEqual(r.path, ['S', 'B', 'E1']);
});

test('tie-break: lower cost always beats a smaller exit ID', () => {
  const b = valid({
    building: 'Cost first',
    nodes: [
      { id: 'S', label: 'Start', type: 'room', x: 0, y: 0 },
      { id: 'E1', label: 'Exit 1', type: 'exit', x: 1, y: 0 },
      { id: 'E2', label: 'Exit 2', type: 'exit', x: -1, y: 0 }
    ],
    edges: [{ id: 'a', from: 'S', to: 'E1', cost: 5 }, { id: 'b', from: 'S', to: 'E2', cost: 4 }],
    initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] }
  });
  const r = findEscapeRoute(b, state(b, 'S'));
  assert.equal(r.exit, 'E2');
  assert.equal(r.cost, 4);
});

test('tie-break: same exit and cost picks the smallest node-ID sequence, independent of file order', () => {
  const nodes = [
    { id: 'S', label: 'Start', type: 'room', x: 0, y: 0 },
    { id: 'C9', label: 'C9', type: 'junction', x: 1, y: 1 },
    { id: 'C10', label: 'C10', type: 'junction', x: 1, y: -1 },
    { id: 'X', label: 'Exit', type: 'exit', x: 2, y: 0 }
  ];
  const edges = [
    { id: 'e1', from: 'S', to: 'C9', cost: 2 }, { id: 'e2', from: 'C9', to: 'X', cost: 2 },
    { id: 'e3', from: 'S', to: 'C10', cost: 1 }, { id: 'e4', from: 'C10', to: 'X', cost: 3 }
  ];
  const init = { blocked_nodes: [], blocked_edges: [], closed_exits: [] };
  const b1 = valid({ building: 'T', nodes, edges, initial_state: init });
  const b2 = valid({ building: 'T', nodes: nodes.slice().reverse(), edges: edges.slice().reverse(), initial_state: init });
  const r1 = findEscapeRoute(b1, state(b1, 'S'));
  const r2 = findEscapeRoute(b2, state(b2, 'S'));
  // "C10" < "C9" in plain string order.
  assert.deepEqual(r1.path, ['S', 'C10', 'X']);
  assert.deepEqual(r2.path, r1.path);
  assert.equal(r1.cost, 4);
});

test('closed exits are never used, even as intermediate nodes', () => {
  const b = valid({
    building: 'Through exit',
    nodes: [
      { id: 'A', label: 'A', type: 'room', x: 0, y: 0 },
      { id: 'E1', label: 'Exit 1', type: 'exit', x: 1, y: 0 },
      { id: 'E2', label: 'Exit 2', type: 'exit', x: 2, y: 0 }
    ],
    edges: [{ id: 'a', from: 'A', to: 'E1', cost: 1 }, { id: 'b', from: 'E1', to: 'E2', cost: 1 }],
    initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: ['E1'] }
  });
  assert.equal(findEscapeRoute(b, state(b, 'A')).status, 'NO_ROUTE');
});

test('disconnected graphs are valid; unreachable exits give no route', () => {
  const b = valid({
    building: 'Split',
    nodes: [
      { id: 'R1', label: 'Room', type: 'room', x: 0, y: 0 },
      { id: 'C1', label: 'Hall', type: 'junction', x: 1, y: 0 },
      { id: 'E1', label: 'Exit', type: 'exit', x: 5, y: 0 }
    ],
    edges: [{ id: 'a', from: 'R1', to: 'C1', cost: 1 }],
    initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] }
  });
  assert.equal(findEscapeRoute(b, state(b, 'R1')).status, 'NO_ROUTE');
});

test('initial_state hazards are applied from blocked_edges IDs', () => {
  const raw = JSON.parse(officialText);
  raw.initial_state.blocked_edges = ['L02'];
  const b = valid(raw);
  assert.deepEqual(b.initialState.blockedEdges, [edgeKey('C1', 'C2')]);
  const r = findEscapeRoute(b, state(b, 'R1'));
  assert.deepEqual(r.path, ['R1', 'C1', 'C3', 'C4', 'E2']);
  assert.equal(r.cost, 11);
});

// ---- Strict validation ---------------------------------------------------

test('validation rejects malformed or inconsistent files', () => {
  const base = () => JSON.parse(officialText);
  const expect = (mutate, code) => {
    const raw = base();
    mutate(raw);
    assert.ok(codes(raw).includes(code), `${code} expected, got ${JSON.stringify(codes(raw))}`);
  };

  assert.equal(parseBuildingJSON('{not json').errors[0].code, 'INVALID_JSON');
  assert.ok(codes([]).includes('NOT_OBJECT'));

  expect((r) => { r.building = ''; }, 'BAD_BUILDING');
  expect((r) => { delete r.building; }, 'BAD_BUILDING');
  expect((r) => { r.nodes = {}; }, 'NODES_NOT_LIST');
  expect((r) => { delete r.edges; }, 'EDGES_NOT_LIST');
  expect((r) => { r.nodes = r.nodes.slice(0, 1); }, 'NODE_COUNT');
  expect((r) => { for (let i = 0; i < 55; i++) r.nodes.push({ id: 'N' + i, label: 'N', type: 'junction', x: 0, y: 0 }); }, 'NODE_COUNT');
  expect((r) => { r.edges = []; }, 'EDGE_COUNT');
  expect((r) => { r.nodes[1].id = 'R1'; }, 'NODE_DUPLICATE_ID');
  expect((r) => { r.nodes[0].id = ''; }, 'NODE_NO_ID');
  expect((r) => { r.nodes[0].label = ' '; }, 'NODE_NO_LABEL');
  expect((r) => { r.nodes[0].type = 'corridor'; }, 'NODE_BAD_TYPE');
  expect((r) => { r.nodes[0].type = 'Room'; }, 'NODE_BAD_TYPE');
  expect((r) => { r.nodes[0].x = '60'; }, 'NODE_BAD_COORD');
  expect((r) => { delete r.edges[0].id; }, 'EDGE_NO_ID');
  expect((r) => { r.edges[1].id = 'L01'; }, 'EDGE_DUPLICATE_ID');
  expect((r) => { r.edges[0].to = 'c1'; }, 'EDGE_UNKNOWN_NODE'); // IDs are case-sensitive
  expect((r) => { r.edges[0].to = 'R1'; }, 'EDGE_SELF_LOOP');
  expect((r) => { r.edges[0].cost = 0; }, 'EDGE_BAD_COST');
  expect((r) => { r.edges[0].cost = 2.5; }, 'EDGE_BAD_COST');
  expect((r) => { r.edges[0].cost = -1; }, 'EDGE_BAD_COST');
  expect((r) => { r.edges[0].cost = '2'; }, 'EDGE_BAD_COST');
  expect((r) => { delete r.edges[0].cost; r.edges[0].weight = 2; }, 'EDGE_BAD_COST');
  expect((r) => { r.edges.push({ id: 'L99', from: 'C1', to: 'R1', cost: 1 }); }, 'EDGE_DUPLICATE');
  expect((r) => { r.nodes.forEach((n) => { if (n.type === 'exit') n.type = 'junction'; }); }, 'NO_EXIT');
  expect((r) => { r.nodes.forEach((n) => { if (n.type !== 'exit') n.type = 'exit'; }); }, 'NO_START_CANDIDATE');
  expect((r) => { delete r.initial_state; }, 'STATE_MISSING');
  expect((r) => { delete r.initial_state.closed_exits; }, 'STATE_NOT_LIST');
  expect((r) => { r.initial_state.blocked_nodes = ['Z9']; }, 'STATE_UNKNOWN_NODE');
  expect((r) => { r.initial_state.blocked_nodes = ['E1']; }, 'STATE_NODE_IS_EXIT');
  expect((r) => { r.initial_state.blocked_edges = ['L42']; }, 'STATE_UNKNOWN_EDGE');
  expect((r) => { r.initial_state.blocked_edges = [['C1', 'C2']]; }, 'STATE_UNKNOWN_EDGE');
  expect((r) => { r.initial_state.closed_exits = ['E9']; }, 'STATE_UNKNOWN_EXIT');
  expect((r) => { r.initial_state.closed_exits = ['C1']; }, 'STATE_NOT_EXIT');
});

test('extra unknown fields are ignored', () => {
  const raw = JSON.parse(officialText);
  raw.version = 2;
  raw.nodes[0].floor = 1;
  assert.equal(validateBuilding(raw).ok, true);
});
