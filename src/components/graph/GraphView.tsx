import { useEffect, useRef, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import * as d3 from "d3";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  linkCount: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export default function GraphView() {
  const [state, dispatch] = useWorkspace();
  const vaultId = state.vaultId!;
  const notes = useQuery(api.notes.list, { vaultId });
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  // Get active note id
  const activePane = state.panes.find((p) => p.id === state.activePaneId);
  const activeTab = activePane?.tabs.find(
    (t) => t.id === activePane.activeTabId
  );
  const activeNoteId = activeTab?.noteId;

  // Build graph data
  const graphData = useMemo(() => {
    if (!notes) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };

    const noteMap = new Map(notes.map((n) => [n.title.toLowerCase(), n._id]));
    const linkCounts = new Map<string, number>();
    const links: GraphLink[] = [];
    const seen = new Set<string>();

    for (const note of notes) {
      const regex = /\[\[([^\]|#]+)/g;
      let match;
      while ((match = regex.exec(note.content)) !== null) {
        const targetTitle = match[1]!.trim().toLowerCase();
        const targetId = noteMap.get(targetTitle);
        if (targetId && targetId !== note._id) {
          const key = [note._id, targetId].sort().join("-");
          if (!seen.has(key)) {
            seen.add(key);
            links.push({ source: note._id, target: targetId });
            linkCounts.set(note._id, (linkCounts.get(note._id) ?? 0) + 1);
            linkCounts.set(targetId, (linkCounts.get(targetId) ?? 0) + 1);
          }
        }
      }
    }

    const nodes: GraphNode[] = notes.map((n) => ({
      id: n._id,
      title: n.title,
      linkCount: linkCounts.get(n._id) ?? 0,
    }));

    return { nodes, links };
  }, [notes]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const { nodes, links } = graphData;
    if (nodes.length === 0) return;

    const width = svg.clientWidth || 300;
    const height = svg.clientHeight || 300;

    // Clear previous content
    d3.select(svg).selectAll("*").remove();

    const svgEl = d3
      .select(svg)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const g = svgEl.append("g");

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svgEl.call(zoom);

    // Simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(20));

    simulationRef.current = simulation;

    // Links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#3e3e3e")
      .attr("stroke-width", 1);

    // Nodes
    const nodeGroup = g
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        dispatch({
          type: "OPEN_NOTE",
          noteId: d.id as any,
        });
      })
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodeGroup
      .append("circle")
      .attr("r", (d) => Math.max(4, Math.min(12, 4 + d.linkCount * 2)))
      .attr("fill", (d) =>
        d.id === activeNoteId ? "#8b7cf3" : "#dcddde"
      )
      .attr("stroke", (d) =>
        d.id === activeNoteId ? "#8b7cf3" : "transparent"
      )
      .attr("stroke-width", 2);

    nodeGroup
      .append("text")
      .text((d) => d.title)
      .attr("font-size", 10)
      .attr("fill", "#999")
      .attr("dx", 12)
      .attr("dy", 4)
      .attr("pointer-events", "none");

    // Tooltip
    nodeGroup.append("title").text((d) => d.title);

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);

      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, activeNoteId, dispatch]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-obsidian-border">
        <span className="text-xs font-semibold uppercase text-obsidian-text-muted">
          Graph View
        </span>
      </div>
      <svg ref={svgRef} className="w-full h-[calc(100%-33px)]" />
    </div>
  );
}
