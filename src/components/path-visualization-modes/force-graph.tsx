"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, Eye, EyeOff } from "lucide-react";
import * as d3 from "d3";
import type { PageInfoMap } from "@/lib/fetch-descriptions";
import { useTheme } from "next-themes";

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  isStart?: boolean;
  isEnd?: boolean;
  group?: number;
  depth?: number;
  isSearchMatch?: boolean;
  isSearchConnected?: boolean;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  fromPage: string;
  toPage: string;
  isSearchHighlighted?: boolean;
}

interface D3ForceGraphProps {
  paths: number[][];
  pageInfo: PageInfoMap;
  searchTerm?: string;
}

// Helper functions for layered layout (unchanged)
function buildDepthGroups(nodes: { id: string; depth?: number }[]) {
  const groups = new Map<number, string[]>();
  for (const n of nodes) {
    const d = n.depth ?? 0;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(n.id);
  }
  return groups;
}

function buildAdjacency(
  links: { source: string | { id: string }; target: string | { id: string } }[],
) {
  const out = new Map<string, Set<string>>();
  const inc = new Map<string, Set<string>>();
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
  depthGroups: Map<number, string[]>,
  depthOf: Map<string, number>,
  {
    out,
    inc,
  }: { out: Map<string, Set<string>>; inc: Map<string, Set<string>> },
  sweeps = 2,
) {
  const maxDepth = Math.max(...depthGroups.keys());
  const order = new Map<number, string[]>();
  for (const [d, ids] of depthGroups) order.set(d, [...ids]);

  for (let s = 0; s < sweeps; s++) {
    for (let d = 1; d <= maxDepth; d++) {
      const prev = order.get(d - 1)!;
      const indexPrev = new Map(prev.map((id, i) => [id, i]));
      const cur = order.get(d)!;
      cur.sort((a, b) => {
        const ma = median(
          [...(inc.get(a) ?? [])].map((p) => indexPrev.get(p) ?? 0),
        );
        const mb = median(
          [...(inc.get(b) ?? [])].map((p) => indexPrev.get(p) ?? 0),
        );
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
        const ma = median(
          [...(out.get(a) ?? [])].map((c) => indexNext.get(c) ?? 0),
        );
        const mb = median(
          [...(out.get(b) ?? [])].map((c) => indexNext.get(c) ?? 0),
        );
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
  marginY = 10,
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

export function ForceGraph({
  paths,
  pageInfo,
  searchTerm = "",
}: D3ForceGraphProps) {
  const { theme } = useTheme();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [hoveredLink, setHoveredLink] = useState<Link | null>(null);
  const [showAllTitles, setShowAllTitles] = useState(true);
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({
    nodes: [],
    links: [],
  });
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const initialPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(
    null,
  );
  const prevStructuralDataRef = useRef<{
    nodeCount: number;
    linkCount: number;
    pathsLength: number;
  }>({
    nodeCount: 0,
    linkCount: 0,
    pathsLength: 0,
  }); // used so toggling titles or filter graph shouldnt cause zoomtofit
  const prevDimensionsRef = useRef<{ width: number; height: number }>(
    dimensions,
  ); // however dimensions changing

  const startPageId = paths.length > 0 ? paths[0][0] : null;
  const endPageId = paths.length > 0 ? paths[0][paths[0].length - 1] : null;
  const startPage = startPageId ? (pageInfo[startPageId]?.title ?? null) : null;
  const endPage = endPageId ? (pageInfo[endPageId]?.title ?? null) : null;

  const getWikipediaUrl = (title: string) =>
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

  useEffect(() => {
    if (paths.length === 0) return;
    const nodesMap = new Map<string, Node>();
    const linksSet = new Set<string>();
    const links: Link[] = [];
    paths.forEach((path, pathIndex) => {
      path.forEach((pageId, index) => {
        const page = pageInfo[pageId].title;
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
        const sourceId = path[i];
        const targetId = path[i + 1];
        const source = pageInfo[sourceId].title;
        const target = pageInfo[targetId].title;

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

    const searchLower = searchTerm.toLowerCase().trim();
    const searchMatchNodes = new Set<string>();

    if (searchLower) {
      nodesMap.forEach((node, id) => {
        if (node.name.toLowerCase().includes(searchLower)) {
          node.isSearchMatch = true;
          searchMatchNodes.add(id);
        } else {
          node.isSearchMatch = false;
        }
      });

      nodesMap.forEach((node, id) => {
        if (!node.isSearchMatch) {
          const isConnected = links.some((link) => {
            const sourceId =
              typeof link.source === "string" ? link.source : link.source.id;
            const targetId =
              typeof link.target === "string" ? link.target : link.target.id;
            return (
              (searchMatchNodes.has(sourceId) && targetId === id) ||
              (searchMatchNodes.has(targetId) && sourceId === id)
            );
          });
          node.isSearchConnected = isConnected;
        }
      });

      links.forEach((link) => {
        const sourceId =
          typeof link.source === "string" ? link.source : link.source.id;
        const targetId =
          typeof link.target === "string" ? link.target : link.target.id;
        link.isSearchHighlighted =
          searchMatchNodes.has(sourceId) || searchMatchNodes.has(targetId);
      });
    } else {
      nodesMap.forEach((node) => {
        node.isSearchMatch = false;
        node.isSearchConnected = false;
      });
      links.forEach((link) => {
        link.isSearchHighlighted = false;
      });
    }

    setGraphData({ nodes: Array.from(nodesMap.values()), links });
  }, [paths, startPage, endPage, searchTerm, pageInfo]);

  useEffect(() => {
    // Handler for the stubborn fullscreen exit - this is our primary fix.
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;

      if (!isFullscreen && containerRef.current) {
        // WE ARE EXITING: Force the height back to 500.
        console.log("Fullscreen exited! Forcing height to 500px.");
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: 500 });
      } else if (isFullscreen && containerRef.current) {
        // WE ARE ENTERING: Let the container fill the screen.
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Observer for all OTHER resizing (e.g., dragging the browser window).
    const observer = new ResizeObserver((entries) => {
      // Only run this observer logic if we are NOT in fullscreen.
      // This lets the 'handleFullscreenChange' be the only authority on fullscreen changes.
      if (entries[0] && !document.fullscreenElement) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Cleanup function removes both the listener and the observer.
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      !canvasRef.current ||
      !containerRef.current ||
      graphData.nodes.length === 0
    )
      return;

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
    const orderedByDepth = orderColumnsByMedian(
      depthGroupsIds,
      depthOf,
      { out, inc },
      2,
    );
    const colHeights = new Map<number, number>();
    for (const [d, ids] of orderedByDepth)
      colHeights.set(d, ids.length > 1 ? (ids.length - 1) * ROW_SPACING : 0);
    const maxColH = Math.max(0, ...colHeights.values());
    const weights: number[] = [];
    for (let d = 0; d <= maxDepth; d++)
      weights.push(1 + (maxColH > 0 ? (colHeights.get(d) ?? 0) / maxColH : 0));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const usableW =
      maxColH > 0 ? maxColH * (width / height) : width - 2 * marginX;
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
          .distance(3000)
          .strength(0.01),
      )
      .force(
        "x",
        d3.forceX<Node>((d) => xAtDepth.get(d.depth ?? 0)!).strength(1.0),
      )
      .force(
        "y",
        d3
          .forceY<Node>(
            (d) => initialPositionsRef.current.get(d.id)?.y ?? height / 2,
          )
          .strength(1.0),
      );
    simulationRef.current = simulation;

    // let currentTransform = d3.zoomIdentity;
    let activeHoverNode: Node | null = null;
    let activeHoverLink: Link | null = null;

    const drawGraph = () => {
      const currentTransform = d3.zoomTransform(canvas);

      context.save();
      context.clearRect(0, 0, width, height);
      context.translate(currentTransform.x, currentTransform.y);
      context.scale(currentTransform.k, currentTransform.k);

      // const defaultLinkColor = "#64748b",
      //   hoverLinkColor = "#06b6d4",
      //   searchHighlightLinkColor = "#f59e0b",
      //   dimmedLinkColor = "#94a3b8";

      const defaultLinkColor = theme === "dark" ? "#cbd5e1" : "#64748b"; // lighter for dark mode
      const hoverLinkColor = theme === "dark" ? "#22d3ee" : "#06b6d4";
      const searchHighlightLinkColor = theme === "dark" ? "#facc15" : "#f59e0b";
      const dimmedLinkColor = theme === "dark" ? "#a7b9d1" : "#94a3b8"; // maybe lighter variant if needed

      const hasSearchTerm = searchTerm.trim().length > 0;

      context.globalAlpha = 0.8;
      graphData.links.forEach((link) => {
        context.beginPath();
        context.moveTo((link.source as Node).x!, (link.source as Node).y!);
        context.lineTo((link.target as Node).x!, (link.target as Node).y!);

        let strokeStyle = defaultLinkColor;
        let lineWidth = 1.5;

        if (link === activeHoverLink) {
          strokeStyle = hoverLinkColor;
          lineWidth = 2.5;
        } else if (hasSearchTerm) {
          if (link.isSearchHighlighted) {
            strokeStyle = searchHighlightLinkColor;
            lineWidth = 2;
          } else {
            strokeStyle = dimmedLinkColor;
            context.globalAlpha = 0.3;
          }
        }

        context.strokeStyle = strokeStyle;
        context.lineWidth = lineWidth;

        context.stroke();

        if (hasSearchTerm && !link.isSearchHighlighted) {
          context.globalAlpha = 0.8;
        }
      });

      context.globalAlpha = 1.0;
      graphData.nodes.forEach((node) => {
        context.beginPath();
        const radius = node.isStart || node.isEnd ? 14 : 10;
        context.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);

        let fillStyle = "#94a3b8";
        let strokeStyle = "#64748b";
        let lineWidth = 1.5;

        if (node.isStart || node.isEnd) {
          fillStyle = "#06b6d4";
          strokeStyle = "#0891b2";
        }

        if (hasSearchTerm) {
          if (node.isSearchMatch) {
            fillStyle = "#f59e0b";
            strokeStyle = "#d97706";
            lineWidth = 2.5;
          } else if (node.isSearchConnected) {
            // Keep original colors but with full opacity
          } else {
            context.globalAlpha = 0.4;
          }
        }

        if (node === activeHoverNode) {
          strokeStyle = "#0891b2";
          lineWidth = 3;
        }

        context.fillStyle = fillStyle;
        context.strokeStyle = strokeStyle;
        context.lineWidth = lineWidth;

        context.fill();
        context.stroke();

        if (hasSearchTerm && !node.isSearchMatch && !node.isSearchConnected) {
          context.globalAlpha = 1.0;
        }
      });

      const baseMax = 3.5;
      const dynamicMax = Math.min(
        8,
        baseMax + Math.log10(graphData.nodes.length + 1),
      ); // more nodes, bigger the label can scale to
      const labelScale = Math.max(
        0.4,
        Math.min(dynamicMax, 1 / currentTransform.k),
      );
      const effectiveFontSize = baseFontSize * labelScale;
      context.font = `bold ${effectiveFontSize}px ${baseFontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillStyle = computedStyle.color || "#111827";

      graphData.nodes.forEach((node) => {
        const shouldShowLabel =
          showAllTitles ||
          node.isStart ||
          node.isEnd ||
          node === activeHoverNode ||
          (searchTerm.trim() && node.isSearchMatch);

        if (shouldShowLabel) {
          const offset = (node.isStart || node.isEnd ? 14 : 10) + 5;

          if (
            searchTerm.trim() &&
            !node.isSearchMatch &&
            !node.isStart &&
            !node.isEnd
          ) {
            context.globalAlpha = 0.5;
          }

          context.fillText(node.name, node.x!, node.y! - offset);

          if (
            searchTerm.trim() &&
            !node.isSearchMatch &&
            !node.isStart &&
            !node.isEnd
          ) {
            context.globalAlpha = 1.0;
          }
        }
      });
      context.restore();
    };
    simulation.on("tick", drawGraph);

    const findSubjectNode = (
      event: d3.D3DragEvent<HTMLCanvasElement, Node, Node> | PointerEvent,
    ) => {
      // use the underlying native event if present (d3.drag/d3.zoom pass a wrapper)
      const srcEvent = event.sourceEvent || event;
      const [mx, my] = d3.pointer(srcEvent, canvas);

      const currentTransform = d3.zoomTransform(canvas);
      const [wx, wy] = currentTransform.invert([mx, my]);

      let foundNode = simulation.find(wx, wy, 30 / currentTransform.k);
      if (foundNode) return foundNode;

      context.font = baseFontSize + "px " + baseFontFamily;
      for (const node of graphData.nodes) {
        if (showAllTitles || node.isStart || node.isEnd) {
          const textWidth = context.measureText(node.name).width / 2;
          const offset = (node.isStart || node.isEnd ? 14 : 10) + 5;
          const yTop = node.y! - offset - baseFontSize;
          const yBottom = node.y! - offset;
          if (
            wx >= node.x! - textWidth &&
            wx <= node.x! + textWidth &&
            wy >= yTop &&
            wy <= yBottom
          ) {
            return node;
          }
        }
      }
      return null;
    };

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.005, 4])
      .filter((event) => {
        const e = (event as any).sourceEvent || event;
        // only allow wheel or mousedown when NOT clicking a subject node
        return (
          e.type === "wheel" || (e.type === "mousedown" && !findSubjectNode(e))
        );
      })
      .on("zoom", (event) => {
        // currentTransform = event.transform;
        drawGraph();
      });
    d3.select(canvas).call(zoom);
    zoomRef.current = zoom;

    const currentStructuralData = {
      nodeCount: graphData.nodes.length,
      linkCount: graphData.links.length,
      pathsLength: paths.length,
    };

    const hasStructuralChanges =
      prevStructuralDataRef.current.nodeCount !==
        currentStructuralData.nodeCount ||
      prevStructuralDataRef.current.linkCount !==
        currentStructuralData.linkCount ||
      prevStructuralDataRef.current.pathsLength !==
        currentStructuralData.pathsLength;

    const dimensionsChanged =
      prevDimensionsRef.current.width !== dimensions.width ||
      prevDimensionsRef.current.height !== dimensions.height;

    if (hasStructuralChanges || dimensionsChanged) {
      if (canvasRef.current && zoomRef.current) {
        zoomToFit(
          canvasRef.current,
          zoomRef.current,
          graphData.nodes,
          width,
          height,
        );
      }
    }

    let dragStartPos: [number, number] | null = null;
    let dragMoved = false;

    const drag = d3
      .drag<HTMLCanvasElement, Node, Node>()
      .subject(findSubjectNode)
      .on("start", (event) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;

        const src = (event as any).sourceEvent || event;
        dragStartPos = d3.pointer(src, canvas);
        dragMoved = false;

        canvas.style.cursor = "grabbing";
      })
      .on("drag", (event) => {
        const currentTransform = d3.zoomTransform(canvas);
        const [mx, my] = d3.pointer(event.sourceEvent, canvas);
        const [wx, wy] = currentTransform.invert([mx, my]);

        event.subject.fx = wx;
        event.subject.fy = wy;

        if (dragStartPos) {
          const dx = mx - dragStartPos[0];
          const dy = my - dragStartPos[1];
          if (Math.hypot(dx, dy) > 5) dragMoved = true;
        }
      })
      .on("end", (event) => {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
        dragStartPos = null;

        canvas.style.cursor = "grab";
      });
    d3.select(canvas).call(drag);

    const handlePointerMove = (event: PointerEvent) => {
      const subject = findSubjectNode(event);
      canvas.style.cursor = subject ? "pointer" : "grab";

      let foundLink: Link | null = null;
      if (!subject) {
        const [mx, my] = d3.pointer(event);

        const currentTransform = d3.zoomTransform(canvas);
        const [wx, wy] = currentTransform.invert([mx, my]);
        let minDistance = Infinity;
        const threshold = 10 / currentTransform.k;
        for (const link of graphData.links) {
          const p: [number, number] = [wx, wy];
          const a: [number, number] = [
            (link.source as Node).x!,
            (link.source as Node).y!,
          ];
          const b: [number, number] = [
            (link.target as Node).x!,
            (link.target as Node).y!,
          ];
          const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
          if (l2 === 0) continue;
          let t =
            ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) /
            l2;
          t = Math.max(0, Math.min(1, t));
          const dist = Math.hypot(
            p[0] - (a[0] + t * (b[0] - a[0])),
            p[1] - (a[1] + t * (b[1] - a[1])),
          );
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
      if (event.defaultPrevented) return;
      if (dragMoved) return;

      // compute node & link at the click position (don't trust activeHoverNode)
      const subject = findSubjectNode(event);
      if (subject) {
        window.open(getWikipediaUrl(subject.id), "_blank");
        return;
      }

      // find link under pointer (same logic as handlePointerMove)
      const [mx, my] = d3.pointer(event, canvas);
      const currentTransform = d3.zoomTransform(canvas);
      const [wx, wy] = currentTransform.invert([mx, my]);
      let foundLink: Link | null = null;
      let minDistance = Infinity;
      const threshold = 10 / currentTransform.k;
      for (const link of graphData.links) {
        const p: [number, number] = [wx, wy];
        const a: [number, number] = [
          (link.source as Node).x!,
          (link.source as Node).y!,
        ];
        const b: [number, number] = [
          (link.target as Node).x!,
          (link.target as Node).y!,
        ];
        const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
        if (l2 === 0) continue;
        let t =
          ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2;
        t = Math.max(0, Math.min(1, t));
        const dist = Math.hypot(
          p[0] - (a[0] + t * (b[0] - a[0])),
          p[1] - (a[1] + t * (b[1] - a[1])),
        );
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

    prevStructuralDataRef.current = currentStructuralData;
    prevDimensionsRef.current = dimensions;

    return () => {
      simulation.stop();
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("click", handleClick);
      d3.select(canvas).on(".zoom", null).on(".drag", null);
    };
  }, [graphData, dimensions, showAllTitles, searchTerm, paths.length, theme]);

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
        zoomToFit(
          canvasRef.current,
          zoomRef.current,
          graphData.nodes,
          dimensions.width,
          dimensions.height,
        );
      }
      simulationRef.current.alpha(1).restart();
    }
  };

  const toggleTitleVisibility = () => setShowAllTitles((v) => !v);

  return (
    <div className="flex flex-1 flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-xs">
            {graphData.nodes.length} nodes • {graphData.links.length}{" "}
            connections
          </Badge>
          {/* {graphData.nodes.length > 100 && (
            <Badge variant="secondary" className="text-xs">
              Large dataset - rendered with Canvas
            </Badge>
          )} */}
          {searchTerm.trim() && (
            <Badge className="bg-amber-500 text-xs text-white hover:bg-amber-600">
              {graphData.nodes.filter((n) => n.isSearchMatch).length} matches
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleTitleVisibility}>
            {showAllTitles ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            <span className="ml-1 text-xs">Titles</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            <span className="ml-1 text-xs">Reset</span>
          </Button>
        </div>
      </div>
      <div className="relative flex-1">
        <div
          ref={containerRef}
          className="bg-background h-full min-h-[500px] touch-none overflow-hidden rounded-lg border"
        >
          <canvas ref={canvasRef} />
        </div>
        {hoveredNode && (
          <div className="bg-background/95 pointer-events-none absolute top-4 left-4 z-10 max-w-xs rounded-lg border p-3 shadow-lg backdrop-blur-sm">
            <div className="text-sm font-medium">{hoveredNode.name}</div>
            <div className="text-muted-foreground mt-1 text-xs">
              {hoveredNode.isStart && "Start page • "}
              {hoveredNode.isEnd && "Goal page • "}
              {hoveredNode.isSearchMatch && "Search match • "}
              Click to visit Wikipedia
            </div>
          </div>
        )}
        {hoveredLink && !hoveredNode && (
          <div className="bg-background/95 pointer-events-none absolute top-4 right-4 z-10 max-w-xs rounded-lg border p-3 shadow-lg backdrop-blur-sm">
            <div className="text-sm font-medium">
              {hoveredLink.fromPage} → {hoveredLink.toPage}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              Connection between pages
            </div>
          </div>
        )}
        <div className="bg-background/90 pointer-events-none absolute right-4 bottom-4 rounded-lg border p-2 backdrop-blur-sm">
          <div className="text-muted-foreground text-xs">
            Drag nodes • Pan & zoom • Click to visit Wikipedia
          </div>
        </div>
      </div>
    </div>
  );
}
