"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Play, Pause } from "lucide-react";

import ForceGraph2D, { type ForceGraphMethods, type NodeObject, type LinkObject } from "react-force-graph-2d";

interface Node {
  id: string;
  name: string;
  isStart?: boolean;
  isEnd?: boolean;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface Link {
  source: string;
  target: string;
  fromPage: string;
  toPage: string;
}

interface ForceGraphProps {
  paths: Array<{
    id: number;
    path: string[];
    length: number;
  }>;
  startPage: string;
  endPage: string;
}

export function ForceGraph({ paths, startPage, endPage }: ForceGraphProps) {
  const fgRef = useRef<ForceGraphMethods<NodeObject<Node>, LinkObject<Link>> | undefined>(undefined);
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({ nodes: [], links: [] });
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [hoveredLink, setHoveredLink] = useState<Link | null>(null);
  const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  const getWikipediaUrl = (title: string) => {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  };

  useEffect(() => {
    if (paths.length === 0) return;

    const nodesMap = new Map<string, Node>();
    const linksSet = new Set<string>();
    const links: Link[] = [];

    // Extract unique nodes and edges from all paths
    paths.forEach((pathData) => {
      pathData.path.forEach((page) => {
        if (!nodesMap.has(page)) {
          nodesMap.set(page, {
            id: page,
            name: page.replace(/_/g, " "),
            isStart: page === startPage,
            isEnd: page === endPage,
          });
        }
      });

      // Create links between consecutive pages in each path
      for (let i = 0; i < pathData.path.length - 1; i++) {
        const source = pathData.path[i];
        const target = pathData.path[i + 1];
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

  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById("force-graph-container");
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: 400,
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleNodeClick = useCallback((node: Node) => {
    window.open(getWikipediaUrl(node.id), "_blank");
  }, []);

  const handleNodeHover = useCallback((node: Node | null) => {
    setHoveredNode(node);
  }, []);

  const handleLinkHover = useCallback((link: Link | null) => {
    setHoveredLink(link);
  }, []);

  const handleZoomIn = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 0.8);
    }
  };

  const handleReset = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400);
    }
  };

  const togglePhysics = () => {
    setIsPhysicsEnabled(!isPhysicsEnabled);
    if (fgRef.current) {
      if (isPhysicsEnabled) {
        fgRef.current.pauseAnimation();
      } else {
        fgRef.current.resumeAnimation();
        // Add jiggle effect by slightly moving nodes
        graphData.nodes.forEach((node) => {
          if (node.fx !== undefined) delete node.fx;
          if (node.fy !== undefined) delete node.fy;
        });
      }
    }
  };

  const paintNode = useCallback(
    (node: Node, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name;
      const fontSize = Math.max(10, 12 / globalScale);
      ctx.font = `${fontSize}px Inter, sans-serif`;

      // Node styling based on type
      let nodeColor = "#6b7280"; // default gray
      let borderColor = "#374151";
      let textColor = "#ffffff";

      if (node.isStart || node.isEnd) {
        nodeColor = "#8b5cf6"; // primary purple
        borderColor = "#7c3aed";
        textColor = "#ffffff";
      } else if (hoveredNode?.id === node.id) {
        nodeColor = "#a855f7"; // lighter purple on hover
        borderColor = "#9333ea";
      }

      // Draw node
      const nodeRadius = node.isStart || node.isEnd ? 8 : 6;
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label (only on hover or for start/end nodes to reduce clutter)
      if (hoveredNode?.id === node.id || node.isStart || node.isEnd) {
        const textWidth = ctx.measureText(label).width;
        const bckgDimensions = [textWidth + 8, fontSize + 4];

        // Background
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(
          node.x! - bckgDimensions[0] / 2,
          node.y! - nodeRadius - bckgDimensions[1] - 2,
          bckgDimensions[0],
          bckgDimensions[1]
        );

        // Text
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = textColor;
        ctx.fillText(label, node.x!, node.y! - nodeRadius - bckgDimensions[1] / 2 - 2);
      }
    },
    [hoveredNode]
  );

  const paintLink = useCallback(
    (link: Link, ctx: CanvasRenderingContext2D) => {
      const source = link.source as any;
      const target = link.target as any;

      if (!source.x || !source.y || !target.x || !target.y) return;

      ctx.strokeStyle = hoveredLink === link ? "#8b5cf6" : "#4b5563";
      ctx.lineWidth = hoveredLink === link ? 2 : 1;
      ctx.globalAlpha = hoveredLink === link ? 1 : 0.6;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      // Draw arrow
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const arrowLength = 8;
      const arrowAngle = Math.PI / 6;

      ctx.beginPath();
      ctx.moveTo(
        target.x - arrowLength * Math.cos(angle - arrowAngle),
        target.y - arrowLength * Math.sin(angle - arrowAngle)
      );
      ctx.lineTo(target.x, target.y);
      ctx.lineTo(
        target.x - arrowLength * Math.cos(angle + arrowAngle),
        target.y - arrowLength * Math.sin(angle + arrowAngle)
      );
      ctx.stroke();

      ctx.globalAlpha = 1;
    },
    [hoveredLink]
  );

  if (!ForceGraph2D) {
    return (
      <div className="w-full h-[400px] bg-background border rounded-lg flex items-center justify-center">
        <div className="text-muted-foreground">Loading graph...</div>
      </div>
    );
  }

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
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={togglePhysics}>
            {isPhysicsEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="relative">
        <div id="force-graph-container" className="w-full bg-background border rounded-lg overflow-hidden">
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="transparent"
            nodeCanvasObject={paintNode}
            linkCanvasObject={paintLink}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onLinkHover={handleLinkHover}
            nodePointerAreaPaint={(node: Node, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x!, node.y!, node.isStart || node.isEnd ? 8 : 6, 0, 2 * Math.PI);
              ctx.fill();
            }}
            linkDirectionalArrowLength={0} // We draw custom arrows
            linkDirectionalArrowRelPos={1}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            cooldownTicks={nodeCount > 100 ? 50 : 100}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        </div>

        {hoveredNode && (
          <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg max-w-xs z-10">
            <div className="font-medium text-sm">{hoveredNode.name}</div>
            <div className="text-xs text-muted-foreground mt-1">Click to visit Wikipedia page</div>
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
          <div className="text-xs text-muted-foreground">Drag nodes • Scroll to zoom • Click to visit Wikipedia</div>
        </div>
      </div>
    </div>
  );
}
