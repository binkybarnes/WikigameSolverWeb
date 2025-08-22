import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatComputeTime(seconds: number): string {
  if (seconds < 1e-6) {
    // nanoseconds
    return `${Math.round(seconds * 1e9)} ns`;
  } else if (seconds < 1e-3) {
    // microseconds
    return `${(seconds * 1e6).toFixed(2)} μs`;
  } else if (seconds < 1) {
    // milliseconds
    return `${(seconds * 1e3).toFixed(2)} ms`;
  } else {
    // seconds
    return `${seconds.toFixed(2)} s`;
  }
}
