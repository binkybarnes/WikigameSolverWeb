"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  List,
  Network,
  ExternalLink,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Search,
  X,
} from "lucide-react";
import { ForceGraph } from "./path-visualization-modes/force-graph";
import { Button } from "./ui/button";
// import { mockPaths } from "./data";
import { type PageInfoMap } from "@/lib/fetch-descriptions";

interface PathVisualizationProps {
  startPage: string;
  endPage: string;
  isSearching: boolean;
  hasResults: boolean;
  paths: number[][];
  pageInfo: PageInfoMap;
  error?: string | null;
}

export function PathVisualization({
  startPage,
  endPage,
  isSearching,
  hasResults,
  paths,
  pageInfo,
  error,
}: PathVisualizationProps) {
  const [viewMode, setViewMode] = useState<"list" | "graph" | "grid">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const itemsPerPage = 9; // Increased items per page for more compact list

  const getWikipediaUrl = (title: string) => {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  };

  const totalPages = Math.ceil(paths.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPaths = showAll ? paths : paths.slice(startIndex, endIndex);

  const memoizedListItems = useMemo(() => {
    return currentPaths.map((path, index) => {
      const actualIndex = showAll ? index : startIndex + index;

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
              {path.map((pageId, pageIndex) => {
                const page = pageInfo[pageId];
                if (!page) return null;

                return (
                  <div key={pageIndex} className="flex items-center gap-1.5">
                    <a
                      href={getWikipediaUrl(page.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted hover:bg-muted/80 rounded text-xs font-medium transition-colors group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {page.title.replace(/_/g, " ")}
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    {pageIndex < path.length - 1 && <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      );
    });
  }, [currentPaths, showAll, startIndex, pageInfo]);

  const currentGridPaths = showAll ? paths : paths.slice(startIndex, endIndex);

  const memoizedGridItems = useMemo(() => {
    return currentGridPaths.map((path, pathIndex) => {
      const actualPathIndex = showAll ? pathIndex : startIndex + pathIndex;

      return (
        <Card
          key={actualPathIndex}
          className="p-0 gap-0 overflow-hidden hover:shadow-md transition-all duration-200 group"
        >
          <div className="p-3 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">
                Path {actualPathIndex + 1}
              </Badge>
              <span className="text-xs text-muted-foreground">{path.length - 1} steps</span>
            </div>
          </div>

          <CardContent className="p-0">
            <div className="space-y-0">
              {path.map((pageId, pageIndex) => {
                const isStartOrEnd = pageIndex === 0 || pageIndex === path.length - 1;
                const page = pageInfo[pageId];
                if (!page) return null;
                const url = getWikipediaUrl(page.title);

                return (
                  <div
                    onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                    key={pageIndex}
                    className="cursor-pointer border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex-shrink-0">
                        <img
                          src={page.thumbnailUrl || "/vite.svg"}
                          alt={page.title}
                          className="w-12 h-8 object-cover rounded"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm line-clamp-1">{page.title}</h4>
                          {isStartOrEnd && (
                            <Badge className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs px-1.5 py-0">
                              {pageIndex === 0 ? "Start" : "End"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{page.description}</p>
                      </div>

                      {pageIndex < path.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      );
    });
  }, [currentGridPaths, showAll, startIndex, pageInfo]);

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
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)} className="text-xs">
            {showAll ? "Show Pages" : "Show All"}
          </Button>
          {!showAll && (
            <div className="text-xs text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, paths.length)} of {paths.length}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 min-h-[350px]">{memoizedListItems}</div>

      {!showAll && renderPagination(totalPages, currentPage, setCurrentPage)}
    </div>
  );

  const renderGridView = () => {
    const totalGridPages = Math.ceil(paths.length / itemsPerPage);
    const gridStartIndex = (currentPage - 1) * itemsPerPage;
    const gridEndIndex = gridStartIndex + itemsPerPage;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Found {paths.length} shortest paths (length: {paths[0]?.length - 1 || 0})
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)} className="text-xs">
              {showAll ? "Show Pages" : "Show All"}
            </Button>
            {!showAll && (
              <div className="text-xs text-muted-foreground">
                Showing {gridStartIndex + 1}-{Math.min(gridEndIndex, paths.length)} of {paths.length}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 min-h-[350px]">
          {memoizedGridItems}
        </div>

        {!showAll && renderPagination(totalGridPages, currentPage, setCurrentPage)}
      </div>
    );
  };

  const renderGraphView = () => (
    <div className="space-y-4 flex-1 flex flex-col">
      <div className="text-sm text-muted-foreground text-center">
        Interactive force-directed visualization • Drag nodes and click to visit Wikipedia pages
      </div>

      <div className="flex items-center justify-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for a page in the graph..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearchTerm("")}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <ForceGraph paths={paths} pageInfo={pageInfo} searchTerm={searchTerm} />

      <div className="text-xs text-muted-foreground text-center">
        Showing all {paths.length} paths with optimized layout for performance
        {searchTerm && <span className="block mt-1 text-amber-600">Highlighting nodes matching "{searchTerm}"</span>}
      </div>
    </div>
  );

  const handleViewModeChange = (value: string) => {
    setViewMode(value as "list" | "graph" | "grid");
    setCurrentPage(1);
  };

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
        <Tabs value={viewMode} onValueChange={handleViewModeChange}>
          <TabsList className="grid w-fit grid-cols-3">
            <TabsTrigger value="grid" className="flex items-center gap-2">
              <Grid3X3 className="w-4 h-4" />
              Grid View
            </TabsTrigger>
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

      {viewMode === "list" ? renderListView() : viewMode === "grid" ? renderGridView() : renderGraphView()}
    </div>
  );
}
