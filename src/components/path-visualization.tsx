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
        <Card
          key={actualIndex}
          className={`py-3 transition-all duration-200 hover:shadow-md`}
        >
          <CardContent className="p-3">
            <div className="mb-1 flex items-center justify-between">
              <Badge variant="outline" className="px-2 py-0.5 text-xs">
                Path {actualIndex + 1} • {path.length - 1} steps
              </Badge>
              <ChevronRight className={`h-3 w-3 transition-transform`} />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {path.map((pageId, pageIndex) => {
                const page = pageInfo[pageId];
                if (!page) return null;

                return (
                  <div
                    key={pageIndex}
                    className="flex cursor-pointer items-center gap-1.5"
                  >
                    <a
                      href={getWikipediaUrl(page.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-muted hover:bg-muted/80 group inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {page.title.replace(/_/g, " ")}
                      <ExternalLink className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                    {pageIndex < path.length - 1 && (
                      <ArrowRight className="text-muted-foreground h-2.5 w-2.5" />
                    )}
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
          className="group gap-0 overflow-hidden p-0 transition-all duration-200 hover:shadow-md"
        >
          <div className="bg-muted/30 border-b p-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">
                Path {actualPathIndex + 1}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {path.length - 1} steps
              </span>
            </div>
          </div>

          <CardContent className="p-0">
            <div className="space-y-0">
              {path.map((pageId, pageIndex) => {
                const isStartOrEnd =
                  pageIndex === 0 || pageIndex === path.length - 1;
                const page = pageInfo[pageId];
                if (!page) return null;
                const url = getWikipediaUrl(page.title);

                return (
                  <div
                    onClick={() =>
                      window.open(url, "_blank", "noopener,noreferrer")
                    }
                    key={pageIndex}
                    className="border-b last:border-b-0"
                  >
                    <div className="hover:bg-muted/30 flex cursor-pointer items-center gap-3 p-3 transition-colors">
                      <div className="bg-muted flex h-16 w-16 flex-shrink-0 items-center justify-center rounded">
                        <img
                          src={page.thumbnailUrl || "/vite.svg"}
                          alt={page.title}
                          className="h-14 w-14 object-contain"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <h4 className="line-clamp-1 text-sm font-medium">
                            {page.title}
                          </h4>
                        </div>
                        <p className="text-muted-foreground mb-1 line-clamp-1 text-xs">
                          {page.description}
                        </p>
                      </div>

                      {pageIndex < path.length - 1 && (
                        <ArrowRight className="text-muted-foreground h-3 w-3 flex-shrink-0" />
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

  const renderPagination = (
    totalPages: number,
    currentPage: number,
    setCurrentPage: (page: number) => void,
  ) => {
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
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {visiblePages.map((page, index) =>
            page === "..." ? (
              <span
                key={`ellipsis-${index}`}
                className="text-muted-foreground px-2"
              >
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(page as number)}
              >
                {page}
              </Button>
            ),
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
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
        <div className="text-muted-foreground text-sm">
          Found {paths.length} shortest paths (length: {paths[0]?.length || 0})
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-xs"
          >
            {showAll ? "Show Pages" : "Show All"}
          </Button>
          {!showAll && (
            <div className="text-muted-foreground text-xs">
              Showing {startIndex + 1}-{Math.min(endIndex, paths.length)} of{" "}
              {paths.length}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-[350px] space-y-2">{memoizedListItems}</div>

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
          <div className="text-muted-foreground text-sm">
            Found {paths.length} shortest paths (length:{" "}
            {paths[0]?.length - 1 || 0})
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-xs"
            >
              {showAll ? "Show Pages" : "Show All"}
            </Button>
            {!showAll && (
              <div className="text-muted-foreground text-xs">
                Showing {gridStartIndex + 1}-
                {Math.min(gridEndIndex, paths.length)} of {paths.length}
              </div>
            )}
          </div>
        </div>

        <div className="grid min-h-[350px] grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
          {memoizedGridItems}
        </div>

        {!showAll &&
          renderPagination(totalGridPages, currentPage, setCurrentPage)}
      </div>
    );
  };

  const renderGraphView = () => (
    <div className="flex flex-1 flex-col space-y-4">
      <div className="text-muted-foreground text-center text-sm">
        Interactive force-directed visualization • Drag nodes and click to visit
        Wikipedia pages
      </div>

      <div className="flex items-center justify-center">
        <div className="relative w-full max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            type="text"
            placeholder="Search for a page in the graph..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 pl-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 transform p-0"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <ForceGraph paths={paths} pageInfo={pageInfo} searchTerm={searchTerm} />

      <div className="text-muted-foreground text-center text-xs">
        Showing all {paths.length} paths with optimized layout for performance
        {searchTerm && (
          <span className="mt-1 block text-amber-600">
            Highlighting nodes matching "{searchTerm}"
          </span>
        )}
      </div>
    </div>
  );

  const handleViewModeChange = (value: string) => {
    setViewMode(value as "list" | "graph" | "grid");
    setCurrentPage(1);
  };

  if (isSearching) {
    return (
      <div className="bg-muted/30 border-border flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
        <div className="space-y-4 text-center">
          <div className="border-primary/30 border-t-primary mx-auto h-8 w-8 animate-spin rounded-full border-2" />
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">
              Analyzing Wikipedia connections...
            </p>
            <p className="text-muted-foreground text-xs">
              This may take a few moments
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-muted/30 border-destructive/20 flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
        <div className="space-y-4 text-center">
          <AlertCircle className="text-destructive/70 mx-auto h-12 w-12" />
          <div className="space-y-2">
            <p className="text-destructive text-sm font-medium">
              Search Failed
            </p>
            <p className="text-muted-foreground max-w-md text-xs">
              Unable to find paths between the specified Wikipedia pages. Please
              check the page titles and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="bg-muted/30 border-border flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
        {startPage && endPage ? (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-4 text-sm">
              <Badge variant="secondary" className="px-3 py-1">
                {startPage}
              </Badge>
              <ArrowRight className="text-muted-foreground h-4 w-4" />
              <Badge variant="secondary" className="px-3 py-1">
                {endPage}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Click "Find Paths" to discover all connections
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-center">
            <Network className="text-muted-foreground/50 mx-auto h-12 w-12" />
            <p className="text-muted-foreground text-sm">
              Enter two Wikipedia pages to visualize their connections
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={handleViewModeChange}>
          <TabsList className="grid w-fit grid-cols-3">
            <TabsTrigger value="grid" className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              Grid View
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="graph" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              Graph View
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === "list"
        ? renderListView()
        : viewMode === "grid"
          ? renderGridView()
          : renderGraphView()}
    </div>
  );
}
