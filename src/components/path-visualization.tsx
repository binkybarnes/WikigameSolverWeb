"use client";

import { useState, type RefObject } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, List, Network, ExternalLink } from "lucide-react";
import { ForceGraph } from "./force-graph";
import { mockPaths } from "./data";

interface PathVisualizationProps {
  startPage: string;
  endPage: string;
  isSearching: boolean;
  hasResults: boolean;
}

export function PathVisualization({ startPage, endPage, isSearching, hasResults }: PathVisualizationProps) {
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");

  const getWikipediaUrl = (title: string) => {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  };

  const renderListView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Found {mockPaths.length} shortest paths (length: {Math.min(...mockPaths.map((p) => p.length))})
        </div>
        {mockPaths.length > 10 && (
          <div className="text-xs text-muted-foreground">Showing first 10 of {mockPaths.length} paths</div>
        )}
      </div>

      {/* <ScrollArea className="h-[350px] pr-4"> */}
      <div className="space-y-3 p-4">
        {mockPaths.slice(0, 10).map((path, idx) => (
          <Card key={idx} className={`transition-all duration-200 hover:shadow-md`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-xs">
                  Path {idx} • {path.length} steps
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {path.map((page, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <a
                      href={getWikipediaUrl(page)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/80 rounded text-xs font-medium transition-colors group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {page}
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    {index < path.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* </ScrollArea> */}
    </div>
  );

  const renderGraphView = () => (
    <div className="space-y-4 flex-1 flex flex-col">
      <div className="text-sm text-muted-foreground text-center">
        Interactive force-directed visualization • Drag nodes and click to visit Wikipedia pages
      </div>

      <ForceGraph paths={mockPaths} startPage={startPage} endPage={endPage} />

      <div className="text-xs text-muted-foreground text-center">
        Showing all {mockPaths.length} paths with optimized layout for performance
      </div>
    </div>
  );

  // Mock data for demonstration

  if (isSearching) {
    return (
      <div className="min-h-[400px] bg-muted/30 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Analyzing Wikipedia connections...</p>
            <p className="text-xs text-muted-foreground">This may take a few moments</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="min-h-[400px] bg-muted/30 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
        {startPage && endPage ? (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-4 text-sm">
              <Badge variant="secondary" className="px-3 py-1">
                {startPage}
              </Badge>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <Badge variant="secondary" className="px-3 py-1">
                {endPage}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Click "Find Paths" to discover all connections</p>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <Network className="w-12 h-12 text-muted-foreground/50 mx-auto" />
            <p className="text-sm text-muted-foreground">Enter two Wikipedia pages to visualize their connections</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 flex-1 flex-col flex">
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "list" | "graph")}>
          <TabsList className="grid w-fit grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="graph" className="flex items-center gap-2">
              <Network className="w-4 h-4" />
              Graph View
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === "list" ? renderListView() : renderGraphView()}
    </div>
  );
}
