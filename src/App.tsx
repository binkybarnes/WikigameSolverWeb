"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  ArrowRight,
  Zap,
  Globe,
  Trophy,
  Clock,
  Target,
  Cable,
} from "lucide-react";
import { Maximize, Minimize } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Leaderboard } from "@/components/leaderboard";
import { PathVisualization } from "@/components/path-visualization";
import { WikipediaAutocomplete } from "@/components/wikipedia-autocomplete";
import { createPageInfoMap, type PageInfoMap } from "./lib/fetch-descriptions";
import { formatComputeTime } from "./lib/utils";

export default function WikipediaPathFinder() {
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [activeTab, setActiveTab] = useState("finder");
  const [error, setError] = useState<string | null>(null);

  const [searchResults, setSearchResults] = useState<{
    pathCount: number;
    pathLength: number;
    computeTime: number;
  } | null>(null);

  const scrollPositionRef = useRef(0);

  const [paths, setPaths] = useState<number[][]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfoMap>({});

  // // GET DESCRIPTIONS MAP
  // useEffect(() => {
  //   const allPageIds = paths.flat();
  //   const uniquePageIds = [...new Set(allPageIds)];

  //   if (uniquePageIds.length > 0) {
  //     (async () => {
  //       const infoMap = await createPageInfoMap(uniquePageIds);
  //       setPageInfo(infoMap);
  //     })();
  //   }
  // }, [paths]);

  const API_URL = import.meta.env.VITE_API_URL;

  const searchCache = useRef(new Map<string, any>());

  const outputAsIds = true;

  const handleSearch = async () => {
    const startPageNormal = startPage.trim().replaceAll(" ", "_");
    const endPageNormal = endPage.trim().replaceAll(" ", "_");

    if (!startPageNormal || !endPageNormal) return;
    setIsSearching(true);
    setHasResults(false);
    setError(null);
    setSearchResults(null);

    // Compute the ETag based on your inputs
    const etag = `${startPageNormal}-${endPageNormal}-${outputAsIds}`;

    if (searchCache.current.has(etag)) {
      console.log("Cache hit: using stored result");
      const cachedResult = searchCache.current.get(etag);
      console.log("cached data:", cachedResult);
      setPaths(cachedResult.paths);
      setPageInfo(cachedResult.pageInfo);
      setSearchResults({
        pathCount: cachedResult.num_paths,
        pathLength: cachedResult.paths[0]?.length,
        computeTime: cachedResult.elapsed_s,
      });

      setHasResults(true);
      setIsSearching(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Encoding": "gzip, deflate, br",
        },
        body: JSON.stringify({
          start: startPageNormal,
          end: endPageNormal,
          output_as_ids: outputAsIds,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setError(
            "Rate limit exceeded! Please wait before making another request.",
          );
          return;
        }

        try {
          const data = await response.json();
          if (data.error) {
            setError(data.error);
          } else {
            setError(`HTTP error: ${response.status}`);
          }
        } catch {
          setError(`HTTP error: ${response.status}`);
        }

        return;
      }

      const data = await response.json();
      searchCache.current.set(etag, data);

      console.log("Search result:", data);
      setPaths(data.paths);
      setSearchResults({
        pathCount: data.num_paths,
        pathLength: data.paths[0]?.length,
        computeTime: data.elapsed_s,
      });

      // 🔥 fetch page info right here
      const allPageIds = data.paths.flat();
      const uniquePageIds = [...new Set(allPageIds)];

      let infoMap: PageInfoMap = {};
      if (uniquePageIds.length > 0) {
        infoMap = await createPageInfoMap(uniquePageIds as number[]);
        setPageInfo(infoMap);
      }
      console.log(infoMap);

      // cache both paths + page info
      searchCache.current.set(etag, { ...data, pageInfo: infoMap });

      setHasResults(true);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // const pathRef = useRef<PathVisualizationHandle | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);

      if (!isFs) {
        // WE ARE EXITING: RESTORE the scroll position
        setTimeout(() => {
          window.scrollTo({ top: scrollPositionRef.current, behavior: "auto" });
        }, 0); // The setTimeout ensures the browser has finished its reflow.
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (el) {
      el.style.overflow = "auto"; // or "scroll"
    }

    try {
      if (!document.fullscreenElement) {
        // request fullscreen on the wrapper
        scrollPositionRef.current = window.scrollY;
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      // actual isFullscreen state and fit will be handled by fullscreenchange listener
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Header */}
      <header className="border-border bg-card/50 border-b backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-md">
                <Globe className="text-primary-foreground h-4 w-4" />
              </div>
              <div>
                <h1 className="text-foreground font-mono text-xl font-bold tracking-tight">
                  Wikipedia Paths Finder
                </h1>
                <p className="text-muted-foreground text-base">
                  Discover all shortest paths between any two Wikipedia articles
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8 grid w-full grid-cols-2">
            <TabsTrigger
              value="finder"
              className="flex items-center gap-2 text-base"
            >
              <Search className="h-4 w-4" />
              Path Finder
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="flex items-center gap-2 text-base"
            >
              <Trophy className="h-4 w-4" />
              Leaderboards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="finder" className="space-y-8">
            {/* Search Interface */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-mono text-xl">
                  <Cable className="text-primary h-5 w-5" />
                  Find Connections
                </CardTitle>
                <CardDescription className="text-foreground text-base">
                  Enter two Wikipedia page titles to find all shortest paths
                  between them
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="start-page"
                      className="text-foreground text-base font-medium"
                    >
                      Start Page
                    </label>
                    <WikipediaAutocomplete
                      id="start-page"
                      placeholder="e.g., Albert Einstein"
                      value={startPage}
                      onChange={setStartPage}
                      className="bg-input border-border focus:ring-primary/20 focus:border-primary text-base transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="end-page"
                      className="text-foreground text-base font-medium"
                    >
                      End Page
                    </label>
                    <WikipediaAutocomplete
                      id="end-page"
                      placeholder="e.g., Quantum Physics"
                      value={endPage}
                      onChange={setEndPage}
                      className="bg-input border-border focus:ring-primary/20 focus:border-primary auto text-base transition-colors"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSearch}
                  disabled={!startPage.trim() || !endPage.trim() || isSearching}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground w-full px-6 py-3 text-base font-medium transition-all duration-200 md:w-auto"
                >
                  {isSearching ? (
                    <>
                      <div className="border-primary-foreground/30 border-t-primary-foreground mr-2 h-4 w-4 animate-spin rounded-full border-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Find Paths
                    </>
                  )}
                </Button>
                {error && (
                  <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
                    <div className="text-destructive flex items-center gap-2">
                      <div className="bg-destructive flex h-4 w-4 items-center justify-center rounded-full">
                        <span className="text-destructive-foreground text-xs font-bold">
                          !
                        </span>
                      </div>
                      <span className="text-base">Error</span>
                    </div>
                    <p className="text-destructive/80 mt-1 text-base">
                      {error}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {searchResults && (
              <Card className="border-primary/20 bg-primary/5 border-2 shadow-lg">
                <CardContent className="">
                  <div className="flex items-center justify-center gap-8 text-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
                        <Target className="text-primary h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-foreground font-mono text-3xl font-bold">
                          {searchResults.pathCount}
                        </div>
                        <div className="text-muted-foreground text-lg">
                          Shortest Paths Found
                        </div>
                      </div>
                    </div>

                    <div className="bg-border h-16 w-px" />

                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
                        <ArrowRight className="text-primary h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-foreground font-mono text-3xl font-bold">
                          {searchResults.pathLength}
                        </div>
                        <div className="text-muted-foreground text-lg">
                          Steps per Path
                        </div>
                      </div>
                    </div>

                    <div className="bg-border h-16 w-px" />

                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
                        <Clock className="text-primary h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-foreground font-mono text-3xl font-bold">
                          {formatComputeTime(searchResults.computeTime)}
                        </div>
                        <div className="text-muted-foreground text-lg">
                          Compute Time
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Graph Visualization Area */}
            <Card ref={wrapperRef} className="shadow-sm">
              <CardHeader className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 font-mono text-xl">
                    <ArrowRight className="text-primary h-5 w-5" />
                    Paths Visualization
                  </CardTitle>
                  <CardDescription className="text-base">
                    All shortest paths between articles will appear here
                  </CardDescription>
                </div>

                {/* Fullscreen button */}
                <Button size="sm" variant="outline" onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </Button>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col">
                <PathVisualization
                  // ref={pathRef}
                  startPage={startPage}
                  endPage={endPage}
                  isSearching={isSearching}
                  hasResults={hasResults}
                  paths={paths}
                  pageInfo={pageInfo}
                  error={error}
                />
              </CardContent>
            </Card>

            {/* Status Bar */}
            <div className="text-muted-foreground bg-card/50 border-border flex items-center justify-between rounded-lg border px-4 py-2 text-sm">
              <div className="flex items-center gap-4">
                <span>Ready</span>
                <span>•</span>
                <span>Wikipedia API Connected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-primary h-2 w-2 animate-pulse rounded-full" />
                <span>Live</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Leaderboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
