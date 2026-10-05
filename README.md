# Smart Escape

A frontend-only emergency evacuation route finder. Import a building as JSON. The app draws it as an SVG map and finds the lowest-cost route from your location to an open exit. It recalculates the route as soon as you block a location or corridor, or close an exit.

There's no backend, database or serverless function. Everything runs in the browser as plain HTML, CSS and JavaScript with no build step or dependencies.

## Running it

Serve the folder with any static file server, then open it in a browser:

```sh
python3 -m http.server 8080   # or: npm start
# open http://localhost:8080
```

Click **Load sample** to load the bundled `building.json`, or use **Import JSON** (or drag a file onto the map) to load your own. If you open `index.html` directly from disk, **Import JSON** still works. **Load sample** needs a server, because browsers block `fetch` on `file://` pages.

## Features

- **JSON import and validation.** Load a file with the picker or by drag and drop. Each problem in a file is reported with a clear message in English or Bangla. If an import fails, the previously loaded building stays on screen.
- **SVG map.** Every location is drawn at its supplied `x`/`y` coordinates, and the map scales to fit any coordinate range. Rooms, junctions and exits each have their own shape, and each corridor shows its cost.
- **Undirected weighted graph** with **deterministic Dijkstra** routing (see below).
- **Start selection.** Pick your starting room or junction from the drop-down list or by clicking the map. Only unblocked rooms and junctions can be chosen.
- **Hazard controls.** Block or unblock locations and corridors, and close or reopen exits, from the map, the exits list or the hazards list.
- **Automatic rerouting** on every change.
- **Reset** restores the file's `initial_state`.
- **Failure states.** The app shows **"No route available"** when no open exit can be reached, and **"Starting location blocked"** when your own location is blocked. Both appear on the map and in the route panel.
- **Bangla / English** for every visible string, including validation messages. Numbers use Bangla digits in Bangla mode, and the language choice is remembered.
- **Subtle animations.** The route line draws in and flows, your location pulses gently, hazard markers pop in, and alerts slide in. All animation is turned off when the system's reduced-motion setting is on.
- Works with the keyboard (Tab to a location or corridor, Enter to select it), in light and dark themes, and on phone-width screens.

## Routing rules

- Corridors are undirected and have non-negative weights. A route's cost is the sum of its corridor weights.
- A route can't pass through a blocked location, a blocked corridor or a closed exit.
- Reaching any exit ends the route, so a route never passes through one exit to reach another.
- **Tie-breaking (deterministic):** if two routes cost the same, the app chooses the one whose sequence of node IDs comes first in plain string order, compared one ID at a time. The same input therefore always gives the same route, whatever order the nodes and edges appear in the file.
- Routes are always computed from the imported data. No sample route is hard-coded.

With the bundled sample:

| Situation | Route | Cost |
|---|---|---|
| Initial state | R1 → C1 → C2 → E1 | 7 |
| After blocking C2 | R1 → C1 → C3 → C4 → E2 | 11 |

## Building JSON format

```json
{
  "building": { "name": "Demo Floor", "name_bn": "ডেমো ফ্লোর" },
  "nodes": [
    { "id": "R1", "type": "room", "label": "Room 101", "label_bn": "কক্ষ ১০১", "x": 100, "y": 120 },
    { "id": "C1", "type": "junction", "x": 250, "y": 120 },
    { "id": "E1", "type": "exit", "label": "North-East Exit", "x": 760, "y": 120 }
  ],
  "edges": [
    { "id": "R1-C1", "from": "R1", "to": "C1", "weight": 2 },
    { "from": "C1", "to": "E1", "weight": 5 }
  ],
  "initial_state": {
    "start": "R1",
    "blocked_nodes": [],
    "blocked_edges": [],
    "closed_exits": []
  }
}
```

- `type` must be `room`, `junction` or `exit`. Common aliases are also accepted: `corridor` and `hallway` load as `junction`, and `emergency_exit` and `fire_exit` load as `exit`. A separate `exits` list of node IDs also works.
- Edges can use `from`/`to` or `source`/`target`, and `weight`, `cost` or `distance`.
- `blocked_edges` entries can be an edge ID, `"A-B"`, `["A","B"]` or `{ "from": "A", "to": "B" }`.
- `label_bn` and `name_bn` are optional Bangla names. The English label is used when no Bangla name is given.

The import is rejected, with a message for each problem, if the file has any of these:

- invalid JSON
- missing nodes or edges
- duplicate or missing IDs
- an unknown node type
- non-numeric coordinates
- an edge to an unknown node, an edge from a node to itself, or a duplicate edge
- a negative or non-numeric weight
- no exit, or nothing to start from
- an `initial_state` that refers to a node or edge that doesn't exist

## Project layout

```
index.html          page markup
styles.css          layout, themes, map styling and animations
building.json       sample building
src/validate.js     JSON import and validation
src/graph.js        graph model and deterministic Dijkstra
src/map.js          SVG map rendering
src/i18n.js         Bangla / English strings
src/app.js          state, controls and rerouting
tests/              Node test runner tests for routing and validation
```

## Tests

```sh
npm test   # node --test, no dependencies
```

The tests cover both sample routes, corridor and exit hazards, a blocked start, unreachable exits, deterministic tie-breaking and the validation errors.
