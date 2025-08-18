import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Trophy, Target, TrendingUp, Users } from "lucide-react"

interface LeaderboardEntry {
  id: string
  username: string
  value: number
  startPage: string
  endPage: string
  pathLength?: number
  totalPaths?: number
}

const longestPathsData: LeaderboardEntry[] = [
  { id: "1", username: "PathMaster", value: 12, startPage: "Philosophy", endPage: "Quantum Computing", pathLength: 12 },
  {
    id: "2",
    username: "WikiExplorer",
    value: 11,
    startPage: "Ancient Rome",
    endPage: "Machine Learning",
    pathLength: 11,
  },
  { id: "3", username: "LinkHunter", value: 10, startPage: "Shakespeare", endPage: "Cryptocurrency", pathLength: 10 },
  { id: "4", username: "ConnectionSeeker", value: 9, startPage: "DNA", endPage: "Renaissance Art", pathLength: 9 },
  { id: "5", username: "PathFinder42", value: 8, startPage: "Black Holes", endPage: "Medieval History", pathLength: 8 },
]

const mostPathsData: LeaderboardEntry[] = [
  { id: "1", username: "WikiNinja", value: 247, totalPaths: 247 },
  { id: "2", username: "PathMaster", value: 189, totalPaths: 189 },
  { id: "3", username: "LinkExpert", value: 156, totalPaths: 156 },
  { id: "4", username: "ConnectionPro", value: 134, totalPaths: 134 },
  { id: "5", username: "WikiExplorer", value: 98, totalPaths: 98 },
]

export function Leaderboard() {
  const [activeTab, setActiveTab] = useState("longest")

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono">
          <Trophy className="w-5 h-5 text-primary" />
          Leaderboards
        </CardTitle>
        <CardDescription>Top performers in Wikipedia path discovery</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="longest" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Longest Paths
            </TabsTrigger>
            <TabsTrigger value="most" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Most Paths
            </TabsTrigger>
          </TabsList>

          <TabsContent value="longest" className="space-y-4 mt-6">
            <div className="space-y-3">
              {longestPathsData.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-mono font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{entry.username}</span>
                        <Badge variant="secondary" className="text-xs">
                          {entry.pathLength} steps
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.startPage} → {entry.endPage}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-primary">{entry.value}</div>
                    <div className="text-xs text-muted-foreground">steps</div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="most" className="space-y-4 mt-6">
            <div className="space-y-3">
              {mostPathsData.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-mono font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{entry.username}</span>
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Active
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">Total paths discovered</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-primary">{entry.value}</div>
                    <div className="text-xs text-muted-foreground">paths</div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
