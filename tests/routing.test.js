'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseBuildingJSON, validateBuilding } = require('../src/validate.js');
const { findEscapeRoute, edgeKey } = require('../src/graph.js');

const sampleText = fs.readFileSync(path.join(__dirname, '..', 'building.json'), 'utf8');

function load(text = sampleText) {
  const result = parseBuildingJSON(text);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.building;
}

function state(building, overrides = {}) {
  const init = building.initialState;
  return {
    start: init.start,
    blockedNodes: new Set(init.blockedNodes),
    blockedEdges: new Set(init.blockedEdges),
    closedExits: new Set(init.closedExits),
    ...overrides
  };
}

test('sample building imports cleanly', () => {
  const b = load();
  assert.equal(b.nodes.length, 11);
  assert.equal(b.edges.length, 11);
  assert.equal(b.initialState.start, 'R1');
});

test('initial route is R1 -> C1 -> C2 -> E1 with cost 7', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b));
  assert.equal(r.status, 'OK');
  assert.deepEqual(r.path, ['R1', 'C1', 'C2', 'E1']);
  assert.equal(r.cost, 7);
});

test('blocking C2 reroutes to R1 -> C1 -> C3 -> C4 -> E2 with cost 11', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, { blockedNodes: new Set(['C2']) }));
  assert.equal(r.status, 'OK');
  assert.deepEqual(r.path, ['R1', 'C1', 'C3', 'C4', 'E2']);
  assert.equal(r.cost, 11);
});

test('blocking a corridor avoids it', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, { blockedEdges: new Set([edgeKey('C2', 'E1')]) }));
  assert.deepEqual(r.path, ['R1', 'C1', 'C3', 'C4', 'E2']);
  assert.equal(r.cost, 11);
});

test('closing an exit picks another exit', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, { closedExits: new Set(['E1']) }));
  assert.deepEqual(r.path, ['R1', 'C1', 'C3', 'C4', 'E2']);
  assert.equal(r.cost, 11);
});

test('blocked starting location is reported', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, { blockedNodes: new Set(['R1']) }));
  assert.equal(r.status, 'START_BLOCKED');
});

test('no route when every exit is closed', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, { closedExits: new Set(['E1', 'E2', 'E3']) }));
  assert.equal(r.status, 'NO_ROUTE');
});

test('no route when the start is cut off', () => {
  const b = load();
  const r = findEscapeRoute(b, state(b, { blockedEdges: new Set([edgeKey('R1', 'C1')]) }));
  assert.equal(r.status, 'NO_ROUTE');
});

test('routes never pass through an exit to reach another exit', () => {
  const v = validateBuilding({
    nodes: [
      { id: 'A', type: 'room', x: 0, y: 0 },
      { id: 'X1', type: 'exit', x: 1, y: 0 },
      { id: 'X2', type: 'exit', x: 2, y: 0 }
    ],
    edges: [{ from: 'A', to: 'X1', weight: 5 }, { from: 'X1', to: 'X2', weight: 1 }],
    initial_state: { start: 'A', closed_exits: ['X1'] }
  });
  assert.equal(v.ok, true);
  const r = findEscapeRoute(v.building, state(v.building));
  assert.equal(r.status, 'NO_ROUTE');
});

test('equal-cost ties are broken deterministically by node order', () => {
  const nodes = [
    { id: 'S', type: 'room', x: 0, y: 0 },
    { id: 'B', type: 'junction', x: 1, y: 1 },
    { id: 'A', type: 'junction', x: 1, y: -1 },
    { id: 'X', type: 'exit', x: 2, y: 0 }
  ];
  const edges = [
    { from: 'S', to: 'B', weight: 1 }, { from: 'B', to: 'X', weight: 1 },
    { from: 'S', to: 'A', weight: 1 }, { from: 'A', to: 'X', weight: 1 }
  ];
  const v1 = validateBuilding({ nodes, edges, initial_state: { start: 'S' } });
  const v2 = validateBuilding({ nodes: nodes.slice().reverse(), edges: edges.slice().reverse(), initial_state: { start: 'S' } });
  const r1 = findEscapeRoute(v1.building, state(v1.building));
  const r2 = findEscapeRoute(v2.building, state(v2.building));
  assert.deepEqual(r1.path, ['S', 'A', 'X']);
  assert.deepEqual(r2.path, r1.path);
});

test('validation rejects malformed input', () => {
  assert.equal(parseBuildingJSON('{not json').errors[0].code, 'INVALID_JSON');

  const codes = (raw) => validateBuilding(raw).errors.map((e) => e.code);
  assert.ok(codes([]).includes('NOT_OBJECT'));
  assert.ok(codes({ edges: [] }).includes('NO_NODES'));

  const base = () => ({
    nodes: [
      { id: 'A', type: 'room', x: 0, y: 0 },
      { id: 'E', type: 'exit', x: 1, y: 0 }
    ],
    edges: [{ from: 'A', to: 'E', weight: 1 }],
    initial_state: { start: 'A' }
  });

  let raw = base(); raw.nodes.push({ id: 'A', type: 'room', x: 2, y: 2 });
  assert.ok(codes(raw).includes('NODE_DUPLICATE_ID'));

  raw = base(); raw.nodes[0].x = 'left';
  assert.ok(codes(raw).includes('NODE_BAD_COORD'));

  raw = base(); raw.nodes[0].type = 'spaceship';
  assert.ok(codes(raw).includes('NODE_BAD_TYPE'));

  raw = base(); raw.edges.push({ from: 'A', to: 'Z', weight: 1 });
  assert.ok(codes(raw).includes('EDGE_UNKNOWN_NODE'));

  raw = base(); raw.edges[0].weight = -3;
  assert.ok(codes(raw).includes('EDGE_BAD_WEIGHT'));

  raw = base(); raw.edges.push({ from: 'E', to: 'A', weight: 4 });
  assert.ok(codes(raw).includes('EDGE_DUPLICATE'));

  raw = base(); raw.nodes[1].type = 'room';
  assert.ok(codes(raw).includes('NO_EXIT'));

  raw = base(); raw.initial_state.start = 'E';
  assert.ok(codes(raw).includes('STATE_START_IS_EXIT'));

  raw = base(); raw.initial_state.blocked_edges = ['A-Q'];
  assert.ok(codes(raw).includes('STATE_UNKNOWN_EDGE'));
});

test('initial_state accepts several corridor reference styles', () => {
  const v = validateBuilding({
    nodes: [
      { id: 'A', type: 'room', x: 0, y: 0 },
      { id: 'B', type: 'junction', x: 1, y: 0 },
      { id: 'E', type: 'exit', x: 2, y: 0 }
    ],
    edges: [{ id: 'ab', from: 'A', to: 'B', weight: 1 }, { from: 'B', to: 'E', weight: 1 }],
    initial_state: { start: 'A', blocked_edges: ['ab', ['E', 'B']] }
  });
  assert.equal(v.ok, true);
  assert.deepEqual(v.building.initialState.blockedEdges.sort(), ['A|B', 'B|E']);
});
