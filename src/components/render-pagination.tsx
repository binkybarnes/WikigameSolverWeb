import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";

export const renderPagination = (
  totalPages: number,
  currentPage: number,
  setCurrentPage: (page: number) => void,
) => {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [];

    // Always show first page
    pages.push(1);

    if (currentPage > 4) {
      pages.push("...");
    }

    // Show pages around current page
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (currentPage < totalPages - 3) {
      pages.push("...");
    }

    // Always show last page
    if (totalPages > 1 && !pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className="hidden sm:flex"
        >
          First
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>
      </div>

      <div className="flex items-center gap-1">
        {visiblePages.map((page, index) =>
          page === "..." ? (
            <span
              key={`ellipsis-${index}`}
              className="text-muted-foreground px-2"
            >
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPage(page as number)}
            >
              {page}
            </Button>
          ),
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
          className="hidden sm:flex"
        >
          Last
        </Button>
      </div>
    </div>
  );
};
