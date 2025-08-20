"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, List, Network, ExternalLink, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { ForceGraph } from "./force-graph";
import { Button } from "./ui/button";
// import { mockPaths } from "./data";

interface PathVisualizationProps {
  startPage: string;
  endPage: string;
  isSearching: boolean;
  hasResults: boolean;
  paths: string[][];
  error?: string | null;
}

export function PathVisualization({
  startPage,
  endPage,
  isSearching,
  hasResults,
  paths,
  error,
}: PathVisualizationProps) {
  const [viewMode, setViewMode] = useState<"list" | "graph" | "grid">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Increased items per page for more compact list

  const getWikipediaUrl = (title: string) => {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  };

  const totalPages = Math.ceil(paths.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPaths = paths.slice(startIndex, endIndex);

  const renderPagination = (totalPages: number, currentPage: number, setCurrentPage: (page: number) => void) => {
    if (totalPages <= 1) return null;

    const getVisiblePages = () => {
      if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }

      const pages = [];

      // Always show first page
      pages.push(1);

      if (currentPage > 4) {
        pages.push("...");
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 3) {
        pages.push("...");
      }

      // Always show last page
      if (totalPages > 1 && !pages.includes(totalPages)) {
        pages.push(totalPages);
      }

      return pages;
    };

    const visiblePages = getVisiblePages();

    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="hidden sm:flex"
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {visiblePages.map((page, index) =>
            page === "..." ? (
              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() => setCurrentPage(page as number)}
              >
                {page}
              </Button>
            )
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="hidden sm:flex"
          >
            Last
          </Button>
        </div>
      </div>
    );
  };

  const renderListView = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Found {paths.length} shortest paths (length: {paths[0]?.length - 1 || 0})
        </div>
        <div className="text-xs text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(endIndex, paths.length)} of {paths.length}
        </div>
      </div>

      <div className="space-y-2 min-h-[350px]">
        {currentPaths.map((path, index) => {
          const actualIndex = startIndex + index;
          return (
            <Card key={actualIndex} className={`transition-all duration-200 cursor-pointer hover:shadow-md`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                    Path {actualIndex + 1} • {path.length - 1} steps
                  </Badge>
                  <ChevronRight className={`w-3 h-3 transition-transform`} />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {path.map((page, pageIndex) => (
                    <div key={pageIndex} className="flex items-center gap-1.5">
                      <a
                        href={getWikipediaUrl(page)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted hover:bg-muted/80 rounded text-xs font-medium transition-colors group"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {page.replace(/_/g, " ")}
                        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      {pageIndex < path.length - 1 && <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {renderPagination(totalPages, currentPage, setCurrentPage)}
    </div>
  );

  const renderGraphView = () => (
    <div className="space-y-4 flex-1 flex flex-col">
      <div className="text-sm text-muted-foreground text-center">
        Interactive force-directed visualization • Drag nodes and click to visit Wikipedia pages
      </div>

      <ForceGraph paths={paths} />

      <div className="text-xs text-muted-foreground text-center">
        Showing all {paths.length} paths with optimized layout for performance
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

  if (error) {
    return (
      <div className="min-h-[400px] bg-muted/30 rounded-lg border-2 border-dashed border-destructive/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive/70 mx-auto" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Search Failed</p>
            <p className="text-xs text-muted-foreground max-w-md">
              Unable to find paths between the specified Wikipedia pages. Please check the page titles and try again.
            </p>
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
