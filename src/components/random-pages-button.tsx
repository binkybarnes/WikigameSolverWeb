import axios from "axios";
import { Button } from "@/components/ui/button";
import { Dice6, Shuffle } from "lucide-react";

async function fetchRandomPage(): Promise<string> {
  const { data } = await axios.get("https://en.wikipedia.org/w/api.php", {
    params: {
      action: "query",
      format: "json",
      origin: "*",
      list: "random",
      rnnamespace: "0", // only main/article pages
      rnlimit: "1",
    },
  });
  return data.query.random[0].title as string;
}

export default function RandomPagesButton({
  setStartPage,
  setEndPage,
  handleSearch,
}: {
  setStartPage: (page: string) => void;
  setEndPage: (page: string) => void;
  handleSearch: (startOverride?: string, endOverride?: string) => void;
}) {
  return (
    <Button
      onClick={async () => {
        const [random1, random2] = await Promise.all([
          fetchRandomPage(),
          fetchRandomPage(),
        ]);
        setStartPage(random1);
        setEndPage(random2);
        handleSearch(random1, random2);
      }}
      className="flex items-center gap-2 px-4 py-2 text-base"
    >
      <Dice6 className="h-4 w-4" />
      Random
    </Button>
  );
}
