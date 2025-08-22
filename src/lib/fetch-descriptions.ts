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
async function fetchPageInfoBatch(pageIds: number[], retries = 3, backoff = 500): Promise<PageInfoMap> {
  const url = "https://en.wikipedia.org/w/api.php";
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    pageids: pageIds.join("|"),
    prop: "pageimages|description",
    piprop: "thumbnail",
    pithumbsize: "200", // 200px is a good size for thumbnails
    origin: "*", // Required for CORS
  });

  try {
    const res = await fetch(`${url}?${params.toString()}`, { cache: "force-cache" });

    // Handle rate limiting (429) with exponential backoff
    if (res.status === 429 && retries > 0) {
      console.warn(`Rate limited. Retrying in ${backoff}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchPageInfoBatch(pageIds, retries - 1, backoff * 2);
    }

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    const pages = data.query?.pages || {};

    // Use reduce to transform the API response into our desired PageInfoMap structure
    const pageInfoMap: PageInfoMap = Object.values(pages).reduce((acc: PageInfoMap, page: any) => {
      acc[page.pageid] = {
        title: page.title,
        description: page.description ?? "No description available.",
        thumbnailUrl: page.thumbnail?.source ?? null,
      };
      return acc;
    }, {});

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
export async function createPageInfoMap(uniquePageIds: number[]): Promise<PageInfoMap> {
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
