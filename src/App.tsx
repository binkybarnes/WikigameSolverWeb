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

export default function WikipediaPathFinder() {
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [activeTab, setActiveTab] = useState("finder");

  const handleSearch = async () => {
    if (!startPage.trim() || !endPage.trim()) return;

    setIsSearching(true);
    setHasResults(false);

    // Simulate search delay
    setTimeout(() => {
      setIsSearching(false);
      setHasResults(true);
    }, 200);
  };

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // const pathRef = useRef<PathVisualizationHandle | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement;
      const entered = !!fsEl;
      setIsFullscreen(entered);
      // ask PathVisualization to fit (zoomToFit)
      // pathRef.current?.fit();
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
