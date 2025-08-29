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

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number; // total number of entries in this leaderboard
}

type LeaderboardType = "longest" | "most";
type OnSearchHandler = (startTitle: string, endTitle: string) => void;

// A new component to render a single leaderboard row
// It receives the entry data and the page info map as props
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
      <div className="flex w-80 items-center gap-2 truncate">
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
    <div
      onClick={handleClick}
      className="bg-muted/30 border-border hover:bg-muted/50 flex cursor-pointer items-center rounded-lg border p-3"
    >
      {/* Left section: Rank and Username */}
      <div className="flex w-32 items-center gap-3 md:w-40">
        <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold">
          {entry.rank + 1}
        </div>
        <div className="text-muted-foreground truncate text-sm">
          {entry.username}
        </div>
      </div>

      {/* Middle section: Path */}
      <div className="flex flex-1 items-center justify-center gap-2 px-2 md:gap-4">
        {renderPage(startPage)}
        <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
        {renderPage(endPage)}
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
  );
};

export function Leaderboard({ onSearch }: { onSearch: OnSearchHandler }) {
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
  const totalPages = data.total / itemsPerPage;

  // const scrollPositions = useRef({ longest: 0, most: 0 });

  const dataCache = useRef<Record<string, LeaderboardResponse>>({});
  const pageInfoMapCache = useRef<Record<string, PageInfoMap>>({});
  const etagCache = useRef<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const url = `${API_URL}/leaderboard/${activeLeaderboardTab}?offset=${offset}&limit=${itemsPerPage}`;

      try {
        setIsLoading(true);

        // Prepare headers
        const headers: Record<string, string> = {};
        if (etagCache.current[url]) {
          headers["If-None-Match"] = etagCache.current[url];
        }

        // Fetch leaderboard data
        const response = await axios.get<LeaderboardResponse>(url, {
          headers,
          validateStatus: (status) => status === 200 || status === 304,
        });

        if (response.status === 200) {
          // Update ETag for this URL
          const newEtag = response.headers["etag"];
          if (newEtag) etagCache.current[url] = newEtag;

          const leaderboardData = response.data;
          setData(leaderboardData); // immediate UI update

          dataCache.current[url] = leaderboardData;

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
            pageInfoMapCache.current[url] = infoMap;
          }
        } else if (response.status === 304) {
          // No changes, keep existing data
          console.log("Leaderboard not modified, using cached data");
          const cachedData = dataCache.current[url];
          const cachedPageInfoMap = pageInfoMapCache.current[url];
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
  }, [activeLeaderboardTab, offset, itemsPerPage]);

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
          <TabsList className="grid w-full grid-cols-2">
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
