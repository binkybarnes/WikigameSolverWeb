"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";
import axios from "axios";

interface WikipediaThumbnail {
  url: string;
  width: number;
  height: number;
  mimetype: string;
  duration: number | null;
}

interface WikipediaSuggestion {
  id: number;
  key: string;
  title: string;
  excerpt: string;
  description: string | null;
  thumbnail?: WikipediaThumbnail | null;
}

interface WikipediaAutocompleteProps {
  id: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function WikipediaAutocomplete({
  id,
  placeholder,
  value,
  onChange,
  className,
}: WikipediaAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<WikipediaSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const SUGGESTION_LIMIT = 8;
  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.get(
        `https://en.wikipedia.org/w/rest.php/v1/search/title`,
        {
          params: {
            q: query,
            limit: SUGGESTION_LIMIT,
          },
        },
      );

      // Axios automatically parses JSON
      setSuggestions(response.data.pages || []);
      console.log(response.data);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce API calls
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 50);
  };

  const handleSuggestionClick = (suggestion: WikipediaSuggestion) => {
    onChange(suggestion.title);
    setShowSuggestions(false);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          className={className}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute top-1/2 right-3 -translate-y-1/2 transform">
            <div className="border-muted-foreground/30 border-t-muted-foreground h-4 w-4 animate-spin rounded-full border-2" />
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <Card
          ref={suggestionsRef}
          className="border-border bg-popover absolute top-full right-0 left-0 z-50 mt-1 border p-0 shadow-lg"
        >
          <div className="p-1">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`flex cursor-pointer items-start gap-3 rounded-md p-1 transition-colors ${index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"} `}
              >
                <div className="bg-muted flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md">
                  {suggestion.thumbnail ? (
                    <img
                      src={suggestion.thumbnail?.url}
                      alt=""
                      className="h-12 w-12 rounded object-contain"
                    />
                  ) : (
                    <Search className="text-muted-foreground h-6 w-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-medium">
                    {suggestion.title}
                  </div>
                  {suggestion.description && (
                    <div className="text-muted-foreground mt-1 truncate text-sm">
                      {suggestion.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
