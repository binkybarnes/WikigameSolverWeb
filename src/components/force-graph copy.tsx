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

export function ForceGraph({ paths, startPage, endPage }: D3ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [hoveredLink, setHoveredLink] = useState<Link | null>(null);
  const [showAllTitles, setShowAllTitles] = useState(false);
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
        setDimensions({ width: rect.width, height: 500 });
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
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    // ---------------------- INITIAL POSITIONS ----------------------
    const maxDepth = Math.max(...graphData.nodes.map((n) => n.depth || 0));
    const depthGroups = new Map<number, Node[]>();
    graphData.nodes.forEach((node) => {
      const depth = node.depth || 0;
      if (!depthGroups.has(depth)) depthGroups.set(depth, []);
      depthGroups.get(depth)!.push(node);
    });

    initialPositionsRef.current.clear();
    depthGroups.forEach((nodes, depth) => {
      const x = (depth / maxDepth) * (width - 200) + 100;
      const verticalSpacing = Math.max(80, (height - 100) / Math.max(nodes.length - 1, 1));
      const startY = (height - (nodes.length - 1) * verticalSpacing) / 2;
      nodes.forEach((node, index) => {
        const y = startY + index * verticalSpacing;
        node.x = x;
        node.y = y;
        initialPositionsRef.current.set(node.id, { x, y });
      });
    });

    // ---------------------- SIMULATION ----------------------
    const simulation = d3
      .forceSimulation<Node>(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink<Node, Link>(graphData.links)
          .id((d) => d.id)
          .distance(150)
          .strength(0.2)
      )
      .force("charge", d3.forceManyBody().strength(-50)) // much weaker repulsion
      .force("x", d3.forceX((d) => ((d.depth || 0) / maxDepth) * (width - 200) + 100).strength(1)) // stronger x pull
      .force(
        "y",
        d3
          .forceY((d) => {
            const depth = d.depth || 0;
            const nodesAtDepth = depthGroups.get(depth) || [];
            const idx = nodesAtDepth.findIndex((n) => n.id === d.id);
            const verticalSpacing = Math.max(80, (height - 100) / Math.max(nodesAtDepth.length - 1, 1));
            const startY = (height - (nodesAtDepth.length - 1) * verticalSpacing) / 2;
            return startY + idx * verticalSpacing;
          })
          .strength(1)
      ) // stronger y pull

      .force("collision", d3.forceCollide().radius(40));

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
      .attr("class", "node-label fill-foreground text-xs font-medium pointer-events-none select-none")
      .attr("text-anchor", "middle")
      .attr("dy", -20)
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
  }, [showAllTitles]);

  // ---------------------- RESET ----------------------
  const handleReset = () => {
    if (simulationRef.current && initialPositionsRef.current.size > 0) {
      if (zoomRef.current && svgRef.current) {
        d3.select(svgRef.current).transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
      }

      graphData.nodes.forEach((node) => {
        const initialPos = initialPositionsRef.current.get(node.id);
        if (initialPos) {
          node.x = initialPos.x;
          node.y = initialPos.y;
          node.fx = null;
          node.fy = null;
        }
      });

      simulationRef.current.alpha(0.3).restart();
    }
  };

  const toggleTitleVisibility = () => setShowAllTitles((v) => !v);

  const nodeCount = graphData.nodes.length;
  const edgeCount = graphData.links.length;

  return (
    <div className="space-y-4">
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

      <div className="relative">
        <div ref={containerRef} className="w-full bg-background border rounded-lg overflow-hidden">
          <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full" />
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
