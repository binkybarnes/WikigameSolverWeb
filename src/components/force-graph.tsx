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

// Helper functions for layered layout (unchanged)
function buildDepthGroups(nodes: { id: Id; depth?: number }[]) {
  const groups = new Map<number, Id[]>();
  for (const n of nodes) {
    const d = n.depth ?? 0;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(n.id);
  }
  return groups;
}

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

function median(arr: number[]) {
  if (arr.length === 0) return Number.NaN;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function orderColumnsByMedian(
  depthGroups: Map<number, Id[]>,
  depthOf: Map<Id, number>,
  { out, inc }: { out: Map<Id, Set<Id>>; inc: Map<Id, Set<Id>> },
  sweeps = 2
) {
  const maxDepth = Math.max(...depthGroups.keys());
  const order = new Map<number, Id[]>();
  for (const [d, ids] of depthGroups) order.set(d, [...ids]);

  for (let s = 0; s < sweeps; s++) {
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
  return order;
}

function zoomToFit(
  canvas: HTMLCanvasElement,
  zoom: d3.ZoomBehavior<HTMLCanvasElement, unknown>,
  nodes: Node[],
  width: number,
  height: number,
  nodeRadius = 14,
  marginX = 10,
  marginY = 10
) {
  if (!nodes.length) return;

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
  const scale = Math.min(1.2, scaleFitWidth, scaleFitHeight);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const tx = width / 2 - scale * cx;
  const ty = height / 2 - scale * cy;
  const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

  d3.select(canvas)
    .transition()
    .duration(400)
    .call(zoom.transform as any, transform);
}

export function ForceGraph({ paths, startPage, endPage }: D3ForceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [hoveredLink, setHoveredLink] = useState<Link | null>(null);
  const [showAllTitles, setShowAllTitles] = useState(true);
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({ nodes: [], links: [] });
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const initialPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);

  const getWikipediaUrl = (title: string) =>
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

  useEffect(() => {
    if (paths.length === 0) return;
    const nodesMap = new Map<string, Node>();
    const linksSet = new Set<string>();
    const links: Link[] = [];
    paths.forEach((path, pathIndex) => {
      path.forEach((page, index) => {
        if (!nodesMap.has(page)) {
          nodesMap.set(page, {
            id: page,
            name: page.replace(/_/g, " "),
            isStart: page === startPage,
            isEnd: page === endPage,
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
          links.push({ source, target, fromPage: source.replace(/_/g, " "), toPage: target.replace(/_/g, " ") });
        }
      }
    });
    setGraphData({ nodes: Array.from(nodesMap.values()), links });
  }, [paths, startPage, endPage]);

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

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || graphData.nodes.length === 0) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(dpr, dpr);

    const computedStyle = getComputedStyle(containerRef.current!);
    const baseFontFamily = computedStyle.fontFamily || "sans-serif";
    const baseFontSize = parseFloat(computedStyle.fontSize) || 14;
    const baseFont = `${baseFontSize}px ${baseFontFamily}`;

    const marginX = 80,
      marginY = 60,
      ROW_SPACING = 150;
    const maxDepth = Math.max(...graphData.nodes.map((n) => n.depth || 0));
    const idToNode = new Map(graphData.nodes.map((n) => [n.id, n]));
    const depthOf = new Map(graphData.nodes.map((n) => [n.id, n.depth ?? 0]));
    const depthGroupsIds = buildDepthGroups(graphData.nodes);
    const { out, inc } = buildAdjacency(graphData.links as any);
    const orderedByDepth = orderColumnsByMedian(depthGroupsIds, depthOf, { out, inc }, 2);
    const colHeights = new Map<number, number>();
    for (const [d, ids] of orderedByDepth) colHeights.set(d, ids.length > 1 ? (ids.length - 1) * ROW_SPACING : 0);
    const maxColH = Math.max(0, ...colHeights.values());
    const weights: number[] = [];
    for (let d = 0; d <= maxDepth; d++) weights.push(1 + (maxColH > 0 ? (colHeights.get(d) ?? 0) / maxColH : 0));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const usableW = maxColH > 0 ? maxColH * (width / height) : width - 2 * marginX;
    const xAtDepth = new Map<number, number>();
    let acc = 0;
    for (let d = 0; d <= maxDepth; d++) {
      const centerFrac = (acc + weights[d] / 2) / weightSum;
      xAtDepth.set(d, marginX + centerFrac * usableW);
      acc += weights[d];
    }
    initialPositionsRef.current.clear();
    for (const [d, ids] of orderedByDepth) {
      const colH = colHeights.get(d)!;
      const startY = (height - colH) / 2;
      ids.forEach((id, i) => {
        const node = idToNode.get(id)!;
        const x = xAtDepth.get(d)!;
        const y = ids.length > 1 ? startY + i * ROW_SPACING : height / 2;
        node.x = x;
        node.y = y;
        initialPositionsRef.current.set(id, { x, y });
      });
    }

    const simulation = d3
      .forceSimulation<Node>(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink<Node, Link>(graphData.links)
          .id((d) => d.id)
          .distance(300)
          .strength(0.01)
      )
      .force("x", d3.forceX<Node>((d) => xAtDepth.get(d.depth ?? 0)!).strength(1.0))
      .force("y", d3.forceY<Node>((d) => initialPositionsRef.current.get(d.id)?.y ?? height / 2).strength(1.0));
    simulationRef.current = simulation;

    let currentTransform = d3.zoomIdentity;
    let activeHoverNode: Node | null = null;
    let activeHoverLink: Link | null = null;
    let isDragging = false;

    const drawGraph = () => {
      context.save();
      context.clearRect(0, 0, width, height);
      context.translate(currentTransform.x, currentTransform.y);
      context.scale(currentTransform.k, currentTransform.k);

      const defaultLinkColor = "#64748b",
        hoverLinkColor = "#06b6d4";
      context.globalAlpha = 0.8;
      graphData.links.forEach((link) => {
        context.beginPath();
        context.moveTo((link.source as Node).x!, (link.source as Node).y!);
        context.lineTo((link.target as Node).x!, (link.target as Node).y!);
        context.strokeStyle = link === activeHoverLink ? hoverLinkColor : defaultLinkColor;
        context.lineWidth = link === activeHoverLink ? 2.5 : 1.5;
        context.stroke();
      });

      context.globalAlpha = 1.0;
      graphData.nodes.forEach((node) => {
        context.beginPath();
        const radius = node.isStart || node.isEnd ? 14 : 10;
        context.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
        context.fillStyle = node.isStart || node.isEnd ? "#06b6d4" : "#94a3b8";
        context.strokeStyle = node === activeHoverNode ? "#0891b2" : node.isStart || node.isEnd ? "#0891b2" : "#64748b";
        context.lineWidth = node === activeHoverNode ? 3 : 1.5;
        context.fill();
        context.stroke();
      });

      const labelScale = Math.max(0.4, Math.min(1.5, 1 / currentTransform.k));
      const effectiveFontSize = baseFontSize * labelScale;
      context.font = `bold ${effectiveFontSize}px ${baseFontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillStyle = computedStyle.color || "#111827";
      graphData.nodes.forEach((node) => {
        if (showAllTitles || node.isStart || node.isEnd || node === activeHoverNode) {
          const offset = ((node.isStart || node.isEnd ? 14 : 10) + 5) / currentTransform.k;
          context.fillText(node.name, node.x!, node.y! - offset);
        }
      });
      context.restore();
    };
    simulation.on("tick", drawGraph);

    const findSubjectNode = (event: d3.D3DragEvent<HTMLCanvasElement, Node, Node> | PointerEvent) => {
      // use the underlying native event if present (d3.drag/d3.zoom pass a wrapper)
      const srcEvent = event.sourceEvent || event;
      const [mx, my] = d3.pointer(srcEvent, canvas);
      const [wx, wy] = currentTransform.invert([mx, my]);

      let foundNode = simulation.find(wx, wy, 30 / currentTransform.k);
      if (foundNode) return foundNode;

      context.font = baseFont;
      for (const node of graphData.nodes) {
        if (showAllTitles || node.isStart || node.isEnd) {
          const textWidth = context.measureText(node.name).width / 2;
          const offset = (node.isStart || node.isEnd ? 14 : 10) + 5;
          const yTop = node.y! - offset - baseFontSize;
          const yBottom = node.y! - offset;
          if (wx >= node.x! - textWidth && wx <= node.x! + textWidth && wy >= yTop && wy <= yBottom) {
            return node;
          }
        }
      }
      return null;
    };

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => {
        const e = (event as any).sourceEvent || event;
        // only allow wheel or mousedown when NOT clicking a subject node
        return e.type === "wheel" || (e.type === "mousedown" && !findSubjectNode(e));
      })
      .on("zoom", (event) => {
        currentTransform = event.transform;
        drawGraph();
      });
    d3.select(canvas).call(zoom);
    zoomRef.current = zoom;

    if (canvasRef.current && zoomRef.current) {
      zoomToFit(canvasRef.current, zoomRef.current, graphData.nodes, width, height);
    }

    const drag = d3
      .drag<HTMLCanvasElement, Node, Node>()
      .subject(findSubjectNode)
      .on("start", (event) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
        isDragging = true;
        canvas.style.cursor = "grabbing";
      })
      .on("drag", (event) => {
        const src = (event as any).sourceEvent || event;
        const [mx, my] = d3.pointer(src, canvas);
        const [wx, wy] = currentTransform.invert([mx, my]);
        event.subject.fx = wx;
        event.subject.fy = wy;
        drawGraph();
      })
      .on("end", (event) => {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
        setTimeout(() => {
          isDragging = false;
          canvas.style.cursor = "grab";
        }, 0);
      });
    d3.select(canvas).call(drag);

    const handlePointerMove = (event: PointerEvent) => {
      if (isDragging) return;
      const subject = findSubjectNode(event);
      canvas.style.cursor = subject ? "pointer" : "grab";

      let foundLink: Link | null = null;
      if (!subject) {
        const [mx, my] = d3.pointer(event);
        const [wx, wy] = currentTransform.invert([mx, my]);
        let minDistance = Infinity;
        const threshold = 10 / currentTransform.k;
        for (const link of graphData.links) {
          const p: [number, number] = [wx, wy];
          const a: [number, number] = [(link.source as Node).x!, (link.source as Node).y!];
          const b: [number, number] = [(link.target as Node).x!, (link.target as Node).y!];
          const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
          if (l2 === 0) continue;
          let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2;
          t = Math.max(0, Math.min(1, t));
          const dist = Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1])));
          if (dist < threshold && dist < minDistance) {
            minDistance = dist;
            foundLink = link;
          }
        }
      }
      if (activeHoverNode !== subject || activeHoverLink !== foundLink) {
        activeHoverNode = subject;
        activeHoverLink = foundLink;
        setHoveredNode(subject);
        setHoveredLink(foundLink);
        drawGraph();
      }
    };
    const handleClick = (event: PointerEvent) => {
      if (isDragging || event.defaultPrevented) return;

      // compute node & link at the click position (don't trust activeHoverNode)
      const subject = findSubjectNode(event);
      if (subject) {
        window.open(getWikipediaUrl(subject.id), "_blank");
        return;
      }

      // find link under pointer (same logic as handlePointerMove)
      const [mx, my] = d3.pointer(event, canvas);
      const [wx, wy] = currentTransform.invert([mx, my]);
      let foundLink: Link | null = null;
      let minDistance = Infinity;
      const threshold = 10 / currentTransform.k;
      for (const link of graphData.links) {
        const p: [number, number] = [wx, wy];
        const a: [number, number] = [(link.source as Node).x!, (link.source as Node).y!];
        const b: [number, number] = [(link.target as Node).x!, (link.target as Node).y!];
        const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
        if (l2 === 0) continue;
        let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2;
        t = Math.max(0, Math.min(1, t));
        const dist = Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1])));
        if (dist < threshold && dist < minDistance) {
          minDistance = dist;
          foundLink = link;
        }
      }

      if (foundLink) {
        window.open(getWikipediaUrl((foundLink.target as Node).id), "_blank");
      }
    };

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("click", handleClick);

    return () => {
      simulation.stop();
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("click", handleClick);
      d3.select(canvas).on(".zoom", null).on(".drag", null);
    };
  }, [graphData, dimensions, showAllTitles]);

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
      if (canvasRef.current && zoomRef.current) {
        zoomToFit(canvasRef.current, zoomRef.current, graphData.nodes, dimensions.width, dimensions.height);
      }
      simulationRef.current.alpha(1).restart();
    }
  };

  const toggleTitleVisibility = () => setShowAllTitles((v) => !v);

  return (
    <div className="space-y-4 flex-1 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-xs">
            {graphData.nodes.length} nodes • {graphData.links.length} connections
          </Badge>
          {graphData.nodes.length > 100 && (
            <Badge variant="secondary" className="text-xs">
              Large dataset - rendered with Canvas
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
        <div ref={containerRef} className="w-full h-full bg-background border rounded-lg overflow-hidden touch-none">
          <canvas ref={canvasRef} className="w-full h-full min-h-[500px]" />
        </div>
        {hoveredNode && (
          <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg max-w-xs z-10 pointer-events-none">
            <div className="font-medium text-sm">{hoveredNode.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {hoveredNode.isStart && "Start page • "}
              {hoveredNode.isEnd && "Goal page • "}Click to visit Wikipedia
            </div>
          </div>
        )}
        {hoveredLink && !hoveredNode && (
          <div className="absolute top-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg max-w-xs z-10 pointer-events-none">
            <div className="font-medium text-sm">
              {hoveredLink.fromPage} → {hoveredLink.toPage}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Connection between pages</div>
          </div>
        )}
        <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-2 border pointer-events-none">
          <div className="text-xs text-muted-foreground">Drag nodes • Pan & zoom • Click to visit Wikipedia</div>
        </div>
      </div>
    </div>
  );
}
