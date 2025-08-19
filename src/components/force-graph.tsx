"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, Eye, EyeOff } from "lucide-react";
import * as d3 from "d3";

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  isStart?: boolean;
  isEnd?: boolean;
  group?: number;
  depth?: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  fromPage: string;
  toPage: string;
}

interface D3ForceGraphProps {
  paths: string[][];
  startPage: string;
  endPage: string;
}

type Id = string;

function buildDepthGroups(nodes: { id: Id; depth?: number }[]) {
  const groups = new Map<number, Id[]>();
  for (const n of nodes) {
    const d = n.depth ?? 0;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(n.id);
  }
  return groups;
}

// Build neighbor maps for crossing minimization
function buildAdjacency(links: { source: string | { id: Id }; target: string | { id: Id } }[]) {
  const out = new Map<Id, Set<Id>>();
  const inc = new Map<Id, Set<Id>>();
  for (const l of links) {
    const s = typeof l.source === "string" ? l.source : l.source.id;
    const t = typeof l.target === "string" ? l.target : l.target.id;
    if (!out.has(s)) out.set(s, new Set());
    if (!inc.has(t)) inc.set(t, new Set());
    out.get(s)!.add(t);
    inc.get(t)!.add(s);
  }
  return { out, inc };
}

// Median (or average if even) of neighbor positions
function median(arr: number[]) {
  if (arr.length === 0) return Number.NaN;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Barycenter/median ordering sweeps to reduce crossings
function orderColumnsByMedian(
  depthGroups: Map<number, Id[]>,
  depthOf: Map<Id, number>,
  { out, inc }: { out: Map<Id, Set<Id>>; inc: Map<Id, Set<Id>> },
  sweeps = 2
) {
  // Start with alphabetical / existing order
  const maxDepth = Math.max(...depthGroups.keys());
  const order = new Map<number, Id[]>();
  for (const [d, ids] of depthGroups) order.set(d, [...ids]);

  for (let s = 0; s < sweeps; s++) {
    // top-down (use parents)
    for (let d = 1; d <= maxDepth; d++) {
      const prev = order.get(d - 1)!;
      const indexPrev = new Map(prev.map((id, i) => [id, i]));
      const cur = order.get(d)!;
      cur.sort((a, b) => {
        const ma = median([...(inc.get(a) ?? [])].map((p) => indexPrev.get(p) ?? 0));
        const mb = median([...(inc.get(b) ?? [])].map((p) => indexPrev.get(p) ?? 0));
        if (Number.isNaN(ma) && Number.isNaN(mb)) return 0;
        if (Number.isNaN(ma)) return 1;
        if (Number.isNaN(mb)) return -1;
        return ma - mb;
      });
      order.set(d, cur);
    }
    // bottom-up (use children)
    for (let d = maxDepth - 1; d >= 0; d--) {
      const next = order.get(d + 1)!;
      const indexNext = new Map(next.map((id, i) => [id, i]));
      const cur = order.get(d)!;
      cur.sort((a, b) => {
        const ma = median([...(out.get(a) ?? [])].map((c) => indexNext.get(c) ?? 0));
        const mb = median([...(out.get(b) ?? [])].map((c) => indexNext.get(c) ?? 0));
        if (Number.isNaN(ma) && Number.isNaN(mb)) return 0;
        if (Number.isNaN(ma)) return 1;
        if (Number.isNaN(mb)) return -1;
        return ma - mb;
      });
      order.set(d, cur);
    }
  }
  return order; // Map<depth, ordered Id[]>
}

function zoomToFit(
  svg: SVGSVGElement,
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
  nodes: Node[],
  width: number,
  height: number,
  nodeRadius = 0,
  marginX = 10,
  marginY = 10
) {
  if (!nodes.length) return;

  // compute bounding box of nodes
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  nodes.forEach((n) => {
    const x = n.x ?? 0;
    const y = n.y ?? 0;
    minX = Math.min(minX, x - nodeRadius);
    maxX = Math.max(maxX, x + nodeRadius);
    minY = Math.min(minY, y - nodeRadius);
    maxY = Math.max(maxY, y + nodeRadius);
  });

  const graphWidth = Math.max(1, maxX - minX);
  const graphHeight = Math.max(1, maxY - minY);

  const scaleFitWidth = (width - 2 * marginX) / graphWidth;
  const scaleFitHeight = (height - 2 * marginY) / graphHeight;
  const scale = Math.min(1, scaleFitWidth, scaleFitHeight);

  // center graph
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const tx = width / 2 - scale * cx;
  const ty = height / 2 - scale * cy;

  const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

  // apply transform
  d3.select(svg)
    .transition()
    .duration(400)
    .call(zoom.transform as any, transform);
}

export function ForceGraph({ paths, startPage, endPage }: D3ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [hoveredLink, setHoveredLink] = useState<Link | null>(null);
  const [showAllTitles, setShowAllTitles] = useState(true);
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({ nodes: [], links: [] });
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const initialPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const getWikipediaUrl = (title: string) =>
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

  // ---------------------- GRAPH DATA ----------------------
  useEffect(() => {
    if (paths.length === 0) return;

    const nodesMap = new Map<string, Node>();
    const linksSet = new Set<string>();
    const links: Link[] = [];

    const pathLength = paths[0]?.length || 0;

    paths.forEach((path, pathIndex) => {
      path.forEach((page, index) => {
        if (!nodesMap.has(page)) {
          nodesMap.set(page, {
            id: page,
            name: page.replace(/_/g, " "),
            isStart: index === 0,
            isEnd: index === pathLength - 1,
            group: pathIndex,
            depth: index,
          });
        }
      });

      for (let i = 0; i < path.length - 1; i++) {
        const source = path[i];
        const target = path[i + 1];
        const linkKey = `${source}|${target}`;

        if (!linksSet.has(linkKey)) {
          linksSet.add(linkKey);
          links.push({
            source,
            target,
            fromPage: source.replace(/_/g, " "),
            toPage: target.replace(/_/g, " "),
          });
        }
      }
    });

    setGraphData({
      nodes: Array.from(nodesMap.values()),
      links,
    });
  }, [paths, startPage, endPage]);

  // ---------------------- DIMENSIONS ----------------------
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ---------------------- GRAPH RENDER ----------------------
  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const g = svg.append("g");

    // ---------------------- ZOOM ----------------------
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);

        const k = event.transform.k;

        // clamp scale factor
        const minScale = 0.5; // don't let text shrink below 50%
        const maxScale = 1.85; // don't let text grow beyond 200%
        const clamped = Math.max(minScale, Math.min(maxScale, 1 / k));

        g.selectAll<SVGTextElement, Node>("text.node-label").attr("transform", `translate(0, -20) scale(${clamped})`);
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    // ---------------------- INITIAL POSITIONS (layered layout) ----------------------
    const marginX = 80;
    const marginY = 60;
    const ROW_SPACING = 100;

    const maxDepth = Math.max(...graphData.nodes.map((n) => n.depth || 0));
    const idToNode = new Map(graphData.nodes.map((n) => [n.id, n]));
    const depthOf = new Map(graphData.nodes.map((n) => [n.id, n.depth ?? 0]));

    // group ids by depth
    const depthGroupsIds = buildDepthGroups(graphData.nodes);

    // reduce crossings: order each column by neighbor medians (2 sweeps)
    const { out, inc } = buildAdjacency(graphData.links as any);
    const orderedByDepth = orderColumnsByMedian(depthGroupsIds, depthOf, { out, inc }, 2);

    // vertical spacing: same across all columns
    const maxCountInAnyDepth = Math.max(...[...orderedByDepth.values()].map((ids) => ids.length));
    const availableH = Math.max(1, height - 2 * marginY);
    const rowSpacing = ROW_SPACING; //maxCountInAnyDepth > 1 ? availableH / (maxCountInAnyDepth - 1) : 0;

    // compute column heights (for proportional horizontal gaps)
    const colHeights = new Map<number, number>();
    for (const [d, ids] of orderedByDepth) {
      const h = ids.length > 1 ? (ids.length - 1) * rowSpacing : 0;
      colHeights.set(d, h);
    }
    const maxColH = Math.max(...colHeights.values());

    // assign proportional x per depth
    const weights: number[] = [];
    for (let d = 0; d <= maxDepth; d++) {
      const w = 1 + (maxColH > 0 ? colHeights.get(d)! / maxColH : 0); // 1..2
      weights.push(w);
    }
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const usableW = maxColH * (width / height); //Math.max(1, width - 2 * marginX);
    console.log(weights);

    const xAtDepth = new Map<number, number>();
    let acc = 0;
    for (let d = 0; d <= maxDepth; d++) {
      const centerFrac = (acc + weights[d] / 2) / weightSum; // center of the weighted segment
      const x = marginX + centerFrac * usableW;
      xAtDepth.set(d, x);
      acc += weights[d];
    }
    console.log(xAtDepth);

    // assign (x, y) neatly
    initialPositionsRef.current.clear();
    for (const [d, ids] of orderedByDepth) {
      const colH = colHeights.get(d)!;
      const startY = (height - colH) / 2; // center each column vertically
      ids.forEach((id, i) => {
        const node = idToNode.get(id)!;
        const x = xAtDepth.get(d)!;
        const y = ids.length > 1 ? startY + i * rowSpacing : height / 2;
        node.x = x;
        node.y = y;
        initialPositionsRef.current.set(id, { x, y });
      });
    }

    if (svgRef.current && zoomRef.current) {
      zoomToFit(svgRef.current, zoomRef.current, graphData.nodes, width, height);
    }

    // ---------------------- SIMULATION ----------------------
    const laneX = (d: any) => xAtDepth.get(d.depth ?? 0)!;
    const laneY = (d: any) => initialPositionsRef.current.get(d.id)?.y ?? height / 2;

    const simulation = d3
      .forceSimulation<Node>(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink<Node, Link>(graphData.links)
          .id((d) => d.id)
          .distance(200) // short, just to keep links taut
          .strength(0.025) // very light so it doesn't ruin the lanes
      )
      // .force("charge", d3.forceManyBody().strength(-30)) // weak repulsion
      .force("x", d3.forceX<Node>(laneX).strength(1.0)) // strong lane anchoring
      .force("y", d3.forceY<Node>(laneY).strength(0.6)); // keep near assigned row
    // .force("collision", d3.forceCollide<Node>().radius(18)); // mild anti-overlap

    simulationRef.current = simulation;

    // ---------------------- LINKS ----------------------
    const defaultLinkColor = "#64748b";
    const hoverLinkColor = "#06b6d4";

    const linkGroup = g.append("g").attr("class", "links");

    const link = linkGroup
      .selectAll(".visible-link")
      .data(graphData.links)
      .enter()
      .append("line")
      .attr("class", (d, i) => `visible-link link-${i}`)
      .attr("stroke", defaultLinkColor)
      .attr("stroke-width", 2)
      .attr("opacity", 0.95)
      .style("pointer-events", "none");

    const linkEnd = linkGroup
      .selectAll(".link-end")
      .data(graphData.links)
      .enter()
      .append("circle")
      .attr("class", (d, i) => `link-end end-${i}`)
      .attr("r", 4)
      .attr("fill", defaultLinkColor)
      .style("pointer-events", "none");

    const linkHitbox = linkGroup
      .selectAll(".link-hitbox")
      .data(graphData.links)
      .enter()
      .append("line")
      .attr("class", "link-hitbox")
      .attr("stroke", "transparent")
      .attr("stroke-width", 18)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        setHoveredLink(d);
        const i = graphData.links.indexOf(d);
        d3.select(`.link-${i}`).attr("stroke", hoverLinkColor).attr("stroke-width", 3).attr("opacity", 1);
        d3.select(`.end-${i}`).attr("fill", hoverLinkColor).attr("r", 6);
      })
      .on("mouseout", (event, d) => {
        setHoveredLink(null);
        const i = graphData.links.indexOf(d);
        d3.select(`.link-${i}`).attr("stroke", defaultLinkColor).attr("stroke-width", 2).attr("opacity", 0.95);
        d3.select(`.end-${i}`).attr("fill", defaultLinkColor).attr("r", 4);
      })
      .on("click", (event, d) => {
        const target = d.target as Node;
        if (target) window.open(getWikipediaUrl(target.id), "_blank");
      });

    // ---------------------- NODES ----------------------
    const node = g
      .append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .enter()
      .append("g")
      .attr("class", "cursor-pointer")
      .call(
        d3
          .drag<SVGGElement, Node>()
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
      )
      .on("click", (event, d) => window.open(getWikipediaUrl(d.id), "_blank"))
      .on("mouseover", (event, d) => setHoveredNode(d))
      .on("mouseout", () => setHoveredNode(null));

    node
      .append("circle")
      .attr("r", (d) => (d.isStart || d.isEnd ? 14 : 10))
      .attr("fill", (d) => (d.isStart || d.isEnd ? "#06b6d4" : "#94a3b8"))
      .attr("stroke", (d) => (d.isStart || d.isEnd ? "#0891b2" : "#64748b"))
      .attr("stroke-width", 2);

    node
      .append("text")
      .attr("class", "node-label fill-foreground text-xl font-medium select-none") // pointer-events-none
      .attr("text-anchor", "middle")
      // .attr("dy", -20)
      .style("opacity", (d) => (d.isStart || d.isEnd ? 1 : 0))
      .text((d) => d.name);

    // ---------------------- SIMULATION TICK ----------------------
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as Node).x!)
        .attr("y1", (d) => (d.source as Node).y!)
        .attr("x2", (d) => (d.target as Node).x!)
        .attr("y2", (d) => (d.target as Node).y!);

      linkEnd.attr("cx", (d) => (d.target as Node).x!).attr("cy", (d) => (d.target as Node).y!);

      linkHitbox
        .attr("x1", (d) => (d.source as Node).x!)
        .attr("y1", (d) => (d.source as Node).y!)
        .attr("x2", (d) => (d.target as Node).x!)
        .attr("y2", (d) => (d.target as Node).y!);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [graphData, dimensions]);

  // ---------------------- LABEL VISIBILITY ----------------------
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGTextElement, Node>("g > text").style("opacity", (d) => {
      if (d.isStart || d.isEnd) return 1;
      return showAllTitles ? 1 : 0;
    });
  }, [showAllTitles, dimensions]);

  // ---------------------- RESET ----------------------
  //   const handleReset = () => {
  //     if (simulationRef.current && initialPositionsRef.current.size > 0) {
  //       if (zoomRef.current && svgRef.current) {
  //         d3.select(svgRef.current).transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
  //       }

  //       graphData.nodes.forEach((node) => {
  //         const initialPos = initialPositionsRef.current.get(node.id);
  //         if (initialPos) {
  //           node.x = initialPos.x;
  //           node.y = initialPos.y;
  //           node.fx = null;
  //           node.fy = null;
  //         }
  //       });

  //       simulationRef.current.alpha(0.3).restart();
  //     }
  //   };

  const handleReset = () => {
    if (simulationRef.current && initialPositionsRef.current.size > 0) {
      graphData.nodes.forEach((node) => {
        const initialPos = initialPositionsRef.current.get(node.id);
        if (initialPos) {
          node.x = initialPos.x;
          node.y = initialPos.y;
          node.fx = null;
          node.fy = null;
        }
      });

      if (svgRef.current && zoomRef.current) {
        zoomToFit(svgRef.current, zoomRef.current, graphData.nodes, dimensions.width, dimensions.height);
      }

      simulationRef.current.alpha(0.3).restart();
    }
  };

  const toggleTitleVisibility = () => setShowAllTitles((v) => !v);

  const nodeCount = graphData.nodes.length;
  const edgeCount = graphData.links.length;

  return (
    <div className="space-y-4 flex-1 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-xs">
            {nodeCount} nodes • {edgeCount} connections
          </Badge>
          {nodeCount > 100 && (
            <Badge variant="secondary" className="text-xs">
              Large dataset - optimized rendering
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleTitleVisibility}>
            {showAllTitles ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="ml-1 text-xs">Titles</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
            <span className="ml-1 text-xs">Reset</span>
          </Button>
        </div>
      </div>

      <div className="relative flex-1">
        <div ref={containerRef} className="w-full h-full bg-background border rounded-lg overflow-hidden">
          <svg ref={svgRef} className="w-full h-full min-h-[500px]" />
          {/* width={dimensions.width} height={dimensions.height} */}
        </div>

        {hoveredNode && (
          <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg max-w-xs z-10">
            <div className="font-medium text-sm">{hoveredNode.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {hoveredNode.isStart && "Start page • "}
              {hoveredNode.isEnd && "Goal page • "}
              Click to visit Wikipedia
            </div>
          </div>
        )}

        {hoveredLink && (
          <div className="absolute top-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg max-w-xs z-10">
            <div className="font-medium text-sm">
              {hoveredLink.fromPage} → {hoveredLink.toPage}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Connection between pages</div>
          </div>
        )}

        <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-2 border">
          <div className="text-xs text-muted-foreground">Drag nodes • Pan & zoom • Click to visit Wikipedia</div>
        </div>
      </div>
    </div>
  );
}
