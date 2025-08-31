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
  LogOut,
  Settings,
  User,
  Merge,
  Github,
  ArrowRightLeft,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";

import { Maximize, Minimize } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Leaderboard } from "@/components/leaderboard";
import { PathVisualization } from "@/components/path-visualization";
import { WikipediaAutocomplete } from "@/components/wikipedia-autocomplete";
import { createPageInfoMap, type PageInfoMap } from "./lib/fetch-descriptions";
import { formatComputeTime, type UserType } from "./lib/utils";
import { UserDropdown } from "./components/user-dropdown";
import SignInModal from "./components/sign-in-modal";
import ChangeUsernameModal from "./components/change-username-modal";
import axios from "axios";
import RandomPagesButton from "./components/random-pages-button";

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
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isChangeUsernameModalOpen, setIsChangeUsernameModalOpen] =
    useState(false);

  const [user, setUser] = useState<UserType | null>(null);

  const API_URL = import.meta.env.VITE_API_URL;

  // in a top-level component or App.tsx
  useEffect(() => {
    async function loadMe() {
      try {
        const res = await axios.get(`${API_URL}/me`, {
          withCredentials: true, // same as credentials: 'include'
        });

        // Axios automatically parses JSON
        setUser({
          userId: res.data.user_id,
          username: res.data.username,
          provider: res.data.provider,
        });
        console.log(res.data);
      } catch (e: any) {
        if (e.response) {
          // server responded with a status other than 2xx
          console.error("me failed:", e.response.data);
        } else {
          // network error or other
          console.error("failed to /me", e);
        }
      }
    }

    loadMe();
  }, [API_URL]);

  const searchCache = useRef(new Map<string, any>());

  const outputAsIds = true;

  const handleSearch = async (startOverride?: string, endOverride?: string) => {
    const startPageToUse = startOverride || startPage;
    const endPageToUse = endOverride || endPage;

    const startPageNormal = startPageToUse.trim().replaceAll(" ", "_");
    const endPageNormal = endPageToUse.trim().replaceAll(" ", "_");

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
        pathCount: cachedResult.paths.length,
        pathLength: cachedResult.paths[0]?.length,
        computeTime: cachedResult.elapsed_s,
      });

      setHasResults(true);
      setIsSearching(false);
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/search`,
        {
          start: startPageNormal,
          end: endPageNormal,
          output_as_ids: outputAsIds,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true, // same as credentials: "include"
          validateStatus: () => true, // handle status manually
        },
      );

      if (response.status === 429) {
        setError(
          "Rate limit exceeded! Please wait before making another request.",
        );
        return;
      }

      if (response.status < 200 || response.status >= 300) {
        setError(response.data?.error || `HTTP error: ${response.status}`);
        return;
      }

      const data = response.data;
      searchCache.current.set(etag, data);

      console.log("Search result:", data);
      setPaths(data.paths);
      setSearchResults({
        pathCount: data.paths.length,
        pathLength: data.paths[0]?.length,
        computeTime: data.elapsed_s,
      });

      // 🔥 fetch page info
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

  const handleLeaderboardSearch = (startTitle: string, endTitle: string) => {
    // 1. Switch to the finder tab
    setActiveTab("finder");

    // 2. Set the input fields' state
    setStartPage(startTitle);
    setEndPage(endTitle);

    // 3. Trigger the search with the new values
    handleSearch(startTitle, endTitle);

    // Optional: Scroll to the top of the page
    window.scrollTo({ top: 0, behavior: "instant" });
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
        <div className="container mx-auto py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                <Globe className="text-primary-foreground h-4 w-4" />
              </div>
              <div>
                <h1 className="text-foreground font-mono text-xl font-bold tracking-tight">
                  Wikipedia Paths Finder
                </h1>
                <p className="text-muted-foreground hidden text-base md:block">
                  Discover all shortest paths between any two Wikipedia articles
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/binkybarnes/WikigameSolver"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="hover:bg-muted flex h-9 w-9 cursor-pointer items-center justify-center rounded transition-colors">
                  <FaGithub className="h-6 w-6" />
                </div>
              </a>

              <ThemeToggle />
              <UserDropdown
                user={user}
                setUser={setUser}
                onSignInClick={() => setIsSignInOpen(true)}
                onChangeUsernameClick={() => setIsChangeUsernameModalOpen(true)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8 flex w-full">
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
                <CardTitle className="flex items-center gap-2 font-mono text-2xl">
                  <Cable className="text-primary h-6 w-6 shrink-0" />
                  Find the shortest paths between...
                </CardTitle>
                {/* <CardDescription className="text-foreground text-base">
                  Enter two Wikipedia page titles to find all shortest paths
                  between them
                </CardDescription> */}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4 md:flex-row">
                  <div className="w-full flex-1 space-y-2">
                    <WikipediaAutocomplete
                      id="start-page"
                      placeholder="e.g., Italian brainrot"
                      value={startPage}
                      onChange={setStartPage}
                      className="bg-input border-border focus:ring-primary/20 focus:border-primary mt-2 h-12 text-2xl transition-colors"
                    />
                  </div>

                  {/* Swap Button */}
                  <div className="hidden md:block">
                    <button
                      type="button"
                      onClick={() => {
                        const temp = startPage;
                        setStartPage(endPage);
                        setEndPage(temp);
                        handleSearch();
                      }}
                      className="hover:bg-muted flex h-12 w-12 cursor-pointer items-center justify-center rounded p-2 transition-colors"
                    >
                      <ArrowRightLeft className="h-8 w-8" />
                    </button>
                  </div>

                  <div className="w-full flex-1 space-y-2">
                    <WikipediaAutocomplete
                      id="end-page"
                      placeholder="e.g., Fast inverse square root"
                      value={endPage}
                      onChange={setEndPage}
                      className="bg-input border-border focus:ring-primary/20 focus:border-primary auto mt-2 h-12 text-2xl transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={() => handleSearch()}
                    disabled={
                      !startPage.trim() || !endPage.trim() || isSearching
                    }
                    className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 px-6 py-3 text-base font-medium transition-all duration-200 md:flex-none"
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

                  <Button
                    onClick={() => {
                      const temp = startPage;
                      setStartPage(endPage);
                      setEndPage(temp);
                      handleSearch();
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-base md:hidden"
                  >
                    <ArrowRightLeft className="h-8 w-8" />
                  </Button>

                  {/* Random Button */}
                  <RandomPagesButton
                    setStartPage={setStartPage}
                    setEndPage={setEndPage}
                    handleSearch={handleSearch}
                  />
                </div>

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
                      <div className="bg-primary/10 hidden h-12 w-12 items-center justify-center rounded-full md:flex">
                        <ArrowRight className="text-primary h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-foreground font-mono text-3xl font-bold">
                          {searchResults.pathLength - 1}
                        </div>
                        <div className="text-muted-foreground text-lg">
                          Steps per Path
                        </div>
                      </div>
                    </div>

                    <div className="bg-border h-16 w-px" />

                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 hidden h-12 w-12 items-center justify-center rounded-full md:flex">
                        <Merge className="text-primary h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-foreground font-mono text-3xl font-bold">
                          {searchResults.pathCount}
                        </div>
                        <div className="text-muted-foreground text-lg">
                          Paths Found
                        </div>
                      </div>
                    </div>

                    <div className="bg-border h-16 w-px" />

                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 hidden h-12 w-12 items-center justify-center rounded-full md:flex">
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
                  <CardTitle className="text-md flex items-center gap-2 font-mono">
                    <ArrowRight className="text-primary h-5 w-5" />
                    All shortest paths will appear here
                  </CardTitle>
                  {/* <CardDescription className="text-base">
                    All shortest paths between articles will appear here
                  </CardDescription> */}
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
            {/* <div className="text-muted-foreground bg-card/50 border-border flex items-center justify-between rounded-lg border px-4 py-2 text-sm">
              <div className="flex items-center gap-4">
                <span>Ready</span>
                <span>•</span>
                <span>Wikipedia API Connected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-primary h-2 w-2 animate-pulse rounded-full" />
                <span>Live</span>
              </div>
            </div> */}
          </TabsContent>

          <TabsContent value="leaderboard">
            <Leaderboard onSearch={handleLeaderboardSearch} />
          </TabsContent>
        </Tabs>
      </main>

      {/* modals live here */}
      <SignInModal
        setUser={setUser}
        isOpen={isSignInOpen}
        setIsOpen={setIsSignInOpen}
        setIsChangeUsernameModalOpen={setIsChangeUsernameModalOpen}
      />
      <ChangeUsernameModal
        isOpen={isChangeUsernameModalOpen}
        setIsOpen={setIsChangeUsernameModalOpen}
        setUser={setUser}
      />
    </div>
  );
}

// TODO: make switching to leaderboard keep scroll position, and also when clicking on leaderboard row should save scroll position.
