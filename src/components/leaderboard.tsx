import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  type RefObject,
} from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Target,
  TrendingUp,
  ArrowRight,
  Merge,
  Image,
  ArrowDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Assuming these are defined elsewhere
import {
  type PageInfo,
  type PageInfoMap,
  createPageInfoMap,
} from "@/lib/fetch-descriptions";
import { renderPagination } from "./render-pagination";
import { Button } from "./ui/button";
import { EntriesPerPageSelect } from "./entries-per-page";

// This interface matches your Axum backend response
interface LeaderboardEntry {
  start_id: number;
  end_id: number;
  score: number;
  username: string;
  rank: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number; // total number of entries in this leaderboard
}

type LeaderboardType = "longest" | "most";
type OnSearchHandler = (startTitle: string, endTitle: string) => void;

const LeaderboardRow = ({
  entry,
  pageInfoMap,
  leaderboardType,
  onSearch,
}: {
  entry: LeaderboardEntry;
  pageInfoMap: PageInfoMap;
  leaderboardType: LeaderboardType;
  onSearch: OnSearchHandler;
}) => {
  const startPage = pageInfoMap[entry.start_id];
  const endPage = pageInfoMap[entry.end_id];
  console.log(startPage);
  console.log(endPage);

  const handleClick = () => {
    // Only fire the search if we have the page titles
    if (startPage && endPage) {
      onSearch(startPage.title, endPage.title);
    }
  };

  // Helper to render a page with thumbnail and title
  const renderPage = (page?: PageInfo) => {
    if (!page) {
      // Show skeleton if page info is still loading
      return (
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      );
    }
    return (
      <div className="flex w-60 items-center gap-2 truncate">
        {page.thumbnailUrl ? (
          <img
            src={page.thumbnailUrl}
            alt={page.title}
            className="h-18 w-18 rounded-sm object-cover"
          />
        ) : (
          <div className="bg-muted h-18 w-18 rounded-sm" />
        )}

        <span className="truncate text-sm font-medium">{page.title}</span>
      </div>
    );
  };

  return (
    <>
      {/* --- SMALL WIDTH: current (not commented) layout --- */}
      <div
        onClick={handleClick}
        className="bg-muted/30 border-border hover:bg-muted/50 flex cursor-pointer flex-col items-center justify-between rounded-lg border p-3 lg:hidden"
      >
        {/* Left section: Rank and Username */}
        <div className="flex w-full items-center gap-4">
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm font-bold">
            {entry.rank + 1}
          </div>
          <span className="text-muted-foreground flex-1 truncate text-xs">
            {entry.username}
          </span>
          {/* Right section: Score */}
          <div className="w-16 text-right">
            <div className="text-primary font-mono text-lg font-bold">
              {entry.score}
            </div>
            <div className="text-muted-foreground text-xs">
              {leaderboardType === "longest" ? "steps" : "paths"}
            </div>
          </div>
        </div>

        {/* Middle section: Path */}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 lg:gap-4">
          {renderPage(startPage)}
          {/* <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" /> */}
          {renderPage(endPage)}
        </div>
      </div>

      {/* --- MEDIUM+ WIDTH: previously-commented layout (shown on md+) --- */}
      <div
        onClick={handleClick}
        className="bg-muted/30 border-border hover:bg-muted/50 hidden cursor-pointer items-center rounded-lg border p-3 lg:flex"
      >
        {/* Left section: Rank and Username */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold">
            {entry.rank + 1}
          </div>
          <div className="text-muted-foreground w-[20ch] truncate text-sm">
            {entry.username}
          </div>
        </div>

        {/* Middle section: Path */}
        <div className="flex flex-1 items-center justify-center gap-2 px-2 lg:gap-4">
          {/* renderPage for bigger layout uses larger width in the commented version */}
          {/* we need a wider render for md+ screens; replicate original commented renderPage here */}
          {(() => {
            const renderPageLarge = (page?: PageInfo) => {
              if (!page) {
                return (
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                );
              }
              return (
                <div className="flex flex-1 items-center gap-2 truncate">
                  {page.thumbnailUrl ? (
                    <img
                      src={page.thumbnailUrl}
                      alt={page.title}
                      className="h-24 w-24 rounded-sm object-cover"
                    />
                  ) : (
                    <div className="bg-muted h-24 w-24 rounded-sm" />
                  )}

                  <span className="truncate text-sm font-medium">
                    {page.title}
                  </span>
                </div>
              );
            };
            return (
              <>
                {renderPageLarge(startPage)}
                <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
                {renderPageLarge(endPage)}
              </>
            );
          })()}
        </div>

        {/* Right section: Score */}
        <div className="ml-auto w-16 text-right">
          <div className="text-primary font-mono text-lg font-bold">
            {entry.score}
          </div>
          <div className="text-muted-foreground text-xs">
            {leaderboardType === "longest" ? "steps" : "paths"}
          </div>
        </div>
      </div>
    </>
  );
};

export function Leaderboard({
  onSearch,
  caches,
}: {
  onSearch: OnSearchHandler;
  caches: {
    dataCache: Record<string, LeaderboardResponse>;
    pageInfoMapCache: Record<string, PageInfoMap>;
    etagCache: Record<string, string>;
  };
}) {
  const [activeLeaderboardTab, setActiveLeaderboardTab] =
    useState<LeaderboardType>("longest");
  const [data, setData] = useState<LeaderboardResponse>({
    entries: [],
    total: 0,
  });
  const [pageInfoMap, setPageInfoMap] = useState<PageInfoMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const offset = (currentPage - 1) * itemsPerPage;
  const totalPages = Math.ceil(data.total / itemsPerPage);

  // const scrollPositions = useRef({ longest: 0, most: 0 });

  const dataCache = caches.dataCache;
  const pageInfoMapCache = caches.pageInfoMapCache;
  const etagCache = caches.etagCache;

  useEffect(() => {
    const fetchData = async () => {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const url = `${API_URL}/leaderboard/${activeLeaderboardTab}?offset=${offset}&limit=${itemsPerPage}`;

      try {
        setIsLoading(true);

        // Prepare headers
        const headers: Record<string, string> = {};
        if (etagCache[url]) {
          headers["If-None-Match"] = etagCache[url];
        }

        // Fetch leaderboard data
        const response = await axios.get<LeaderboardResponse>(url, {
          headers,
          validateStatus: (status) => status === 200 || status === 304,
        });

        if (response.status === 200) {
          // Update ETag for this URL
          const newEtag = response.headers["etag"];
          if (newEtag) etagCache[url] = newEtag;

          const leaderboardData = response.data;
          setData(leaderboardData); // immediate UI update

          dataCache[url] = leaderboardData;

          // Collect unique page IDs
          const pageIds = new Set<number>();
          leaderboardData.entries.forEach((entry) => {
            pageIds.add(entry.start_id);
            pageIds.add(entry.end_id);
          });

          // Fetch page info map
          if (pageIds.size > 0) {
            const infoMap = await createPageInfoMap(Array.from(pageIds));
            setPageInfoMap(infoMap);
            pageInfoMapCache[url] = infoMap;
          }
        } else if (response.status === 304) {
          // No changes, keep existing data
          console.log("Leaderboard not modified, using cached data");
          const cachedData = dataCache[url];
          const cachedPageInfoMap = pageInfoMapCache[url];
          if (cachedData) {
            setData(cachedData);
            setPageInfoMap(cachedPageInfoMap);
          } else {
            console.warn("304 received but no cached data found for", url);
          }
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [
    activeLeaderboardTab,
    offset,
    itemsPerPage,
    dataCache,
    etagCache,
    pageInfoMapCache,
  ]);

  const renderedContent = (
    <div className="space-y-3">
      <div className="flex justify-end">
        <EntriesPerPageSelect value={itemsPerPage} onChange={setItemsPerPage} />
      </div>
      {isLoading && data.entries.length === 0
        ? Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[74px] w-full" />
          ))
        : data.entries.map((entry) => (
            <LeaderboardRow
              leaderboardType={activeLeaderboardTab}
              key={`${activeLeaderboardTab}-${entry.rank}`}
              entry={entry}
              pageInfoMap={pageInfoMap}
              onSearch={onSearch}
            />
          ))}
    </div>
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-2xl">
          <Trophy className="text-primary h-6 w-6" />
          Leaderboards
        </CardTitle>
        <CardDescription>
          Collaborative effort towards discovering Wikipedia paths
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={activeLeaderboardTab}
          onValueChange={(value) =>
            setActiveLeaderboardTab(value as LeaderboardType)
          }
          className="w-full"
        >
          <TabsList className="flex w-full">
            <TabsTrigger
              value="longest"
              className="flex items-center gap-2 text-lg"
            >
              <ArrowRight className="h-4 w-4" />
              Longest Paths
            </TabsTrigger>
            <TabsTrigger
              value="most"
              className="flex items-center gap-2 text-lg"
            >
              <Merge className="h-4 w-4" />
              Most Paths
            </TabsTrigger>
          </TabsList>

          <TabsContent value="longest" className="mt-0">
            {renderedContent}
          </TabsContent>

          <TabsContent value="most" className="mt-0">
            {renderedContent}
          </TabsContent>
        </Tabs>
        {renderPagination(totalPages, currentPage, setCurrentPage)}
      </CardContent>
    </Card>
  );
}
