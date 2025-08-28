// Define the structure for a single page's information
export interface PageInfo {
  title: string;
  description: string;
  thumbnailUrl: string | null; // Thumbnail might not exist
}

// Define the structure for our final map: { [pageId]: PageInfo }
export type PageInfoMap = Record<number, PageInfo>;

// A sensible limit for the MediaWiki API
const API_PAGE_ID_LIMIT = 50;

/**
 * Fetches information for a single batch of page IDs from the MediaWiki API.
 * This is the core API call logic with retry mechanism.
 * @param pageIds - An array of page IDs, should not exceed API_PAGE_ID_LIMIT.
 * @param retries - Number of retry attempts for rate limiting.
 * @param backoff - Initial backoff delay in ms for retries.
 * @returns A promise that resolves to a PageInfoMap for the given batch.
 */
async function fetchPageInfoBatch(
  pageIds: number[],
  retries = 3,
  backoff = 500,
): Promise<PageInfoMap> {
  const url = "https://en.wikipedia.org/w/api.php";
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    pageids: pageIds.join("|"),
    prop: "pageimages|description",
    piprop: "thumbnail",
    pithumbsize: "200", // 200px is a good size for thumbnails
    origin: "*", // Required for CORS
    redirects: "1",
  });

  try {
    const res = await fetch(`${url}?${params.toString()}`, {
      cache: "force-cache",
    });

    // Handle rate limiting (429) with exponential backoff
    if (res.status === 429 && retries > 0) {
      console.warn(
        `Rate limited. Retrying in ${backoff}ms... (${retries} retries left)`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchPageInfoBatch(pageIds, retries - 1, backoff * 2);
    }

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    const pages = data.query?.pages || {};

    const pageInfoMap: PageInfoMap = {};
    const titleToPageId: Record<string, number> = {};

    for (const p of Object.values<any>(pages)) {
      // Some pages can be missing (e.g. -1) — guard against that?
      if (!p || !p.pageid) continue;
      pageInfoMap[p.pageid] = {
        title: p.title,
        description: p.description ?? "No description available.",
        thumbnailUrl: p.thumbnail?.source ?? null,
      };
      titleToPageId[p.title] = p.pageid;
    }

    // Handle redirects
    if (
      Array.isArray(data.query?.redirects) &&
      data.query.redirects.length > 0
    ) {
      const redirectTitles = data.query.redirects.map((r: any) => r.from);

      // Second fetch: resolve redirect titles → pageids
      const infoParams = new URLSearchParams({
        action: "query",
        format: "json",
        titles: redirectTitles.join("|"),
        prop: "info",
        origin: "*",
      });

      const infoRes = await fetch(`${url}?${infoParams.toString()}`);
      const infoData = await infoRes.json();
      const infoPages = infoData.query?.pages || {};

      // Map each redirect id → its target info
      for (const r of data.query.redirects) {
        const fromTitle: string = r.from;
        const toTitle: string = r.to;
        const targetPageId = titleToPageId[toTitle];
        if (!targetPageId) continue;

        // Find the redirect pageid from infoData
        const redirectPage = Object.values<any>(infoPages).find(
          (p: any) => p.title === fromTitle,
        );
        if (!redirectPage) continue;

        const redirectPageId = redirectPage.pageid;

        // Add redirect entry pointing to target's info
        const targetInfo = pageInfoMap[targetPageId];

        pageInfoMap[redirectPageId] = {
          ...targetInfo,
          title: fromTitle, // keep the redirect’s title
        };
      }
    }

    return pageInfoMap;
  } catch (error) {
    console.error("Error fetching page info batch:", error);
    return {}; // Return an empty object on failure for this batch
  }
}

/**
 * Main orchestrator function.
 * Fetches information for any number of page IDs by splitting them into batches
 * that respect the MediaWiki API limits.
 * @param uniquePageIds - An array of unique Wikipedia page IDs.
 * @returns A promise that resolves to a single PageInfoMap containing all requested pages.
 */
export async function createPageInfoMap(
  uniquePageIds: number[],
): Promise<PageInfoMap> {
  const chunks: number[][] = [];

  // Split the IDs into chunks of the appropriate size
  for (let i = 0; i < uniquePageIds.length; i += API_PAGE_ID_LIMIT) {
    chunks.push(uniquePageIds.slice(i, i + API_PAGE_ID_LIMIT));
  }

  // Fetch all chunks in parallel for maximum efficiency
  const chunkPromises = chunks.map((chunk) => fetchPageInfoBatch(chunk));
  const settledChunks = await Promise.all(chunkPromises);

  // Merge the results from all chunks into a single map
  const finalMap: PageInfoMap = settledChunks.reduce((acc, currentMap) => {
    return { ...acc, ...currentMap };
  }, {});

  return finalMap;
}
