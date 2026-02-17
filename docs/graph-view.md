# Graph View

## Overview

The Graph View provides an interactive, force-directed network visualization of note relationships within a vault. Each note is represented as a node, and wiki links between notes create edges. This feature helps users visualize the structure and connectivity of their knowledge base, inspired by the graph view in the desktop Obsidian application.

## Technology

- **D3.js v7** — Used for the force simulation, SVG rendering, zoom/pan, and drag interactions.

## Architecture

**File:** `src/components/graph/GraphView.tsx`

The `GraphView` component:

1. Fetches all notes in the active vault.
2. Parses wiki links from each note's content to build a link graph.
3. Creates a D3 force simulation with nodes and links.
4. Renders an SVG with interactive nodes and edges.
5. Updates when data changes via Convex subscriptions.

## Data Processing

### Building the Graph

1. **Nodes**: Each note becomes a node with:
   - `id`: The note's `_id`
   - `title`: The note's title
   - Visual properties (radius, color)

2. **Links**: For each note, the content is scanned for `[[...]]` patterns:
   - The target title is extracted from each wiki link.
   - A lookup matches the title to an existing note in the vault.
   - If a match is found, a link is created: `{ source: currentNoteId, target: matchedNoteId }`.
   - Duplicate links between the same pair of notes are deduplicated.

3. **Link Count**: Each node's size is proportional to the number of incoming + outgoing links, giving highly-connected notes visual prominence.

### Example

```
Notes: [A, B, C, D]
A contains: [[B]], [[C]]
B contains: [[C]]
C contains: (no links)
D contains: [[A]]

Graph:
  D → A → B
       ↘   ↘
        C ←─┘
```

## Force Simulation

The D3 force simulation applies physics-based forces to position nodes:

| Force | Configuration | Purpose |
|-------|--------------|---------|
| `forceLink` | Distance based on link count | Pulls linked nodes closer together |
| `forceManyBody` | Negative charge (repulsion) | Prevents nodes from overlapping |
| `forceCenter` | Center of SVG viewport | Keeps the graph centered |
| `forceCollide` | Radius-based collision | Prevents node overlap |

### Simulation Parameters

- **Link distance**: Scales with the number of links (more links → shorter distance for strongly connected nodes).
- **Charge strength**: Negative value creates repulsion between all nodes.
- **Center force**: Gently pulls nodes toward the center of the viewport.
- **Collision radius**: Based on node radius plus padding.

## Rendering

### SVG Structure

```
<svg>
  <g class="zoom-container">       ← Transform group for zoom/pan
    <g class="links">              ← Edge lines
      <line />                     ← One per link
      ...
    </g>
    <g class="nodes">              ← Node circles + labels
      <g class="node">            ← One per note
        <circle />                 ← Node visual
        <text />                   ← Note title label
      </g>
      ...
    </g>
  </g>
</svg>
```

### Node Appearance

| Property | Value | Notes |
|----------|-------|-------|
| Shape | Circle | SVG `<circle>` |
| Base radius | 6px | Minimum size |
| Scaled radius | 6 + (linkCount * 2)px | Larger = more connections |
| Color (default) | `#7f6df2` (accent) | Obsidian accent purple |
| Color (active) | `#8b7cf3` (accent-hover) | Currently open note |
| Stroke | Lighter accent on hover | Visual feedback |
| Label | Note title | Positioned below the node |
| Label color | `#dcddde` (text) | Obsidian text color |

### Edge Appearance

| Property | Value |
|----------|-------|
| Shape | Straight line |
| Color | `#3e3e3e` (border color) with partial opacity |
| Width | 1px |

## Interactions

### Node Click

Clicking a node opens the corresponding note in the editor:

1. Click event on a node circle.
2. Extracts the note ID from the node data.
3. Dispatches `OPEN_NOTE` action to the workspace context.

### Node Drag

Nodes can be dragged to manually reposition them:

1. **Drag start**: Fixes the node's position (`fx`, `fy`), pauses gravity for that node.
2. **During drag**: Updates node position to follow cursor.
3. **Drag end**: Releases the fixed position, allowing the simulation to resume.

The simulation is "reheated" (alpha reset) on drag to allow the graph to re-settle.

### Zoom & Pan

- **Zoom**: Mouse scroll zooms in/out (D3 zoom behavior).
- **Pan**: Click and drag on the background pans the view.
- **Zoom extent**: Constrained between 0.1x and 4x zoom.

### Tooltips

- Hovering over a node displays the note's full title in a tooltip.
- Useful when labels are truncated or overlapping.

## Active Note Highlighting

The currently active note (open in the editor) is visually distinguished:

- **Larger radius**: Active node gets a size boost.
- **Different color**: Uses the hover accent color.
- **Glow effect**: Optional stroke/shadow to make it stand out.

The `activeNoteId` is passed from the workspace state to the graph component.

## Lifecycle

### Mount

1. SVG element is created and attached to the container `div`.
2. D3 zoom behavior is initialized on the SVG.
3. Force simulation is created with initial node/link data.
4. Tick function renders node/link positions on each simulation step.

### Update (data changes)

1. When notes change (created, deleted, renamed, content edited), `useQuery` returns new data.
2. The graph data (nodes/links) is recomputed with `useMemo`.
3. The D3 simulation is updated with new nodes and links.
4. New nodes enter, removed nodes exit, existing nodes update.
5. Simulation is reheated to re-settle the layout.

### Unmount

1. Force simulation is stopped.
2. SVG elements are cleaned up.
3. Event listeners are removed.

## Panel Placement

The graph view is displayed in the **right panel** of the app layout:

- Toggled via the workspace state: `rightPanel === "graph"`.
- Activated through:
  - Toolbar button in the app layout header.
  - Command palette: "Toggle Graph View" command.
- The panel shares space with backlinks and search (only one right panel visible at a time).

## Performance

- The force simulation runs for a fixed number of iterations, then cools down (alpha decays).
- Only visible notes are rendered (all notes in the vault — no pagination).
- For vaults with many notes (1000+), the simulation may become sluggish. No virtualization is currently implemented.
