"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ArrowRight, Zap, Globe, Trophy } from "lucide-react";
import { Maximize, Minimize } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Leaderboard } from "@/components/leaderboard";
import { PathVisualization } from "@/components/path-visualization";
import { createPageInfoMap, type PageInfoMap } from "./lib/fetch-descriptions";

export default function WikipediaPathFinder() {
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [activeTab, setActiveTab] = useState("finder");
  const [error, setError] = useState<string | null>(null);

  const scrollPositionRef = useRef(0);

  const [paths, setPaths] = useState<number[][]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfoMap>({});

  // GET DESCRIPTIONS MAP
  useEffect(() => {
    const allPageIds = paths.flat();
    const uniquePageIds = [...new Set(allPageIds)];

    if (uniquePageIds.length > 0) {
      (async () => {
        const infoMap = await createPageInfoMap(uniquePageIds);
        setPageInfo(infoMap);
      })();
    }
  }, [paths]);

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

    // Compute the ETag based on your inputs
    const etag = `${startPageNormal}-${endPageNormal}-${outputAsIds}`;

    if (searchCache.current.has(etag)) {
      console.log("Cache hit: using stored result");
      const cachedResult = searchCache.current.get(etag);
      console.log("cached data:", cachedResult);
      setPaths(cachedResult.paths);

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
          setError("Rate limit exceeded! Please wait before making another request.");
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
      searchCache.current.set(etag, { paths: data.paths, pageInfo: infoMap });

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-md">
                <Globe className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold font-mono tracking-tight">Wikipedia Paths Finder</h1>
                <p className="text-sm text-muted-foreground">
                  Discover all shortest paths between any two Wikipedia articles
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="finder" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Path Finder
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Leaderboards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="finder" className="space-y-8">
            {/* Search Interface */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-mono">
                  <Zap className="w-5 h-5 text-primary" />
                  Find Connections
                </CardTitle>
                <CardDescription>
                  Enter two Wikipedia page titles to find all shortest paths between them
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="start-page" className="text-sm font-medium text-foreground">
                      Start Page
                    </label>
                    <Input
                      id="start-page"
                      placeholder="e.g., Albert Einstein"
                      value={startPage}
                      onChange={(e) => setStartPage(e.target.value)}
                      className="bg-input border-border focus:ring-primary/20 focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="end-page" className="text-sm font-medium text-foreground">
                      End Page
                    </label>
                    <Input
                      id="end-page"
                      placeholder="e.g., Quantum Physics"
                      value={endPage}
                      onChange={(e) => setEndPage(e.target.value)}
                      className="bg-input border-border focus:ring-primary/20 focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSearch}
                  disabled={!startPage.trim() || !endPage.trim() || isSearching}
                  className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all duration-200"
                >
                  {isSearching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Find Paths
                    </>
                  )}
                </Button>
                {error && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2 text-destructive">
                      <div className="w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                        <span className="text-destructive-foreground text-xs font-bold">!</span>
                      </div>
                      <span className="font-medium">Error</span>
                    </div>
                    <p className="text-sm text-destructive/80 mt-1">{error}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Graph Visualization Area */}
            <Card ref={wrapperRef} className="shadow-sm">
              <CardHeader className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 font-mono">
                    <ArrowRight className="w-5 h-5 text-primary" />
                    Paths Visualization
                  </CardTitle>
                  <CardDescription>All shortest paths between articles will appear here</CardDescription>
                </div>

                {/* Fullscreen button */}
                <Button size="sm" variant="outline" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </Button>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
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
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-card/50 px-4 py-2 rounded-lg border border-border">
              <div className="flex items-center gap-4">
                <span>Ready</span>
                <span>•</span>
                <span>Wikipedia API Connected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
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
