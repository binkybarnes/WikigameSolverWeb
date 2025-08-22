"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";

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

export function WikipediaAutocomplete({ id, placeholder, value, onChange, className }: WikipediaAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<WikipediaSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const SUGGESTION_LIMIT = 10;
  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(query)}&limit=${SUGGESTION_LIMIT}`
      );
      const data = await response.json();
      setSuggestions(data.pages || []);
      console.log(data);
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
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
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
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <Card
          ref={suggestionsRef}
          className="p-0 absolute top-full left-0 right-0 z-50 mt-1 border border-border bg-popover shadow-lg"
        >
          <div className="p-1">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`
                  flex items-start gap-3 p-1 rounded-md cursor-pointer transition-colors
                  ${index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}
                `}
              >
                <div className="flex-shrink-0 w-14 h-14 bg-muted rounded-md flex items-center justify-center">
                  {suggestion.thumbnail ? (
                    <img src={suggestion.thumbnail?.url} alt="" className="w-12 h-12 rounded object-contain" />
                  ) : (
                    <Search className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{suggestion.title}</div>
                  {suggestion.description && (
                    <div className="text-xs text-muted-foreground truncate mt-1">{suggestion.description}</div>
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
