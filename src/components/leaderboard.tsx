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
import { Trophy, Target, TrendingUp, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Assuming these are defined elsewhere
import {
  type PageInfo,
  type PageInfoMap,
  createPageInfoMap,
} from "@/lib/fetch-descriptions";

// This interface matches your Axum backend response
interface LeaderboardEntry {
  start_id: number;
  end_id: number;
  score: number;
  username: string;
  rank: number;
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
        <img
          src={page.thumbnailUrl || "./vite.svg"}
          alt={page.title}
          className="h-20 w-20 rounded-sm object-cover"
        />
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
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [pageInfoMap, setPageInfoMap] = useState<PageInfoMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const scrollPositions = useRef({ longest: 0, most: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

        // 1. Fetch leaderboard data
        const response = await axios.get<LeaderboardEntry[]>(
          `${API_URL}/leaderboard/${activeLeaderboardTab}?offset=0&limit=50`,
        );
        const leaderboardData = response.data;
        setData(leaderboardData); // Set data immediately for responsive UI

        // 2. Collect unique page IDs
        const pageIds = new Set<number>();
        leaderboardData.forEach((entry) => {
          pageIds.add(entry.start_id);
          pageIds.add(entry.end_id);
        });

        // 3. Fetch all page info in parallel
        if (pageIds.size > 0) {
          const infoMap = await createPageInfoMap(Array.from(pageIds));
          setPageInfoMap(infoMap);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeLeaderboardTab]); // Re-run effect when the tab changes

  const renderedContent = (
    <div className="space-y-3">
      {isLoading && data.length === 0
        ? Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[74px] w-full" />
          ))
        : data.map((entry) => (
            <LeaderboardRow
              leaderboardType={activeLeaderboardTab}
              key={`${activeLeaderboardTab}-${entry.rank}`}
              entry={entry}
              pageInfoMap={pageInfoMap}
              onSearch={onSearch}
              scrollPositions={scrollPositions}
            />
          ))}
    </div>
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono">
          <Trophy className="text-primary h-5 w-5" />
          Leaderboards
        </CardTitle>
        <CardDescription>
          Top performers in Wikipedia path discovery
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeLeaderboardTab}
          onValueChange={(value) =>
            setActiveLeaderboardTab(value as LeaderboardType)
          }
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="longest" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Longest Paths
            </TabsTrigger>
            <TabsTrigger value="most" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
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
      </CardContent>
    </Card>
  );
}
