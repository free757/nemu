import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SegmentItem } from "@/types/atlas";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Smart time range parser.
 * Handles formats like: "0:00.00–0:03.00", "0:00.00 - 0:03.00", "0:00.00-0:03.00"
 */
export function parseTimeRange(rangeStr: string): { startTime: string; endTime: string } | null {
  if (!rangeStr) return null;
  const parts = rangeStr.trim().split(/[\s–—-]+/);
  if (parts.length >= 2) {
    return {
      startTime: parts[0].trim(),
      endTime: parts[1].trim(),
    };
  }
  return null;
}

/**
 * Smart Bulk Parser for text containing multiple timestamps and labels.
 * Example input:
 * 0:00.00–0:03.00
 * pick up and place wrench with right hand
 *
 * 0:03.00–0:07.33
 * pick up and place wrench with right hand
 */
export function parseBulkSegmentsText(bulkText: string): SegmentItem[] {
  const lines = bulkText.split("\n").map((line) => line.trim()).filter(Boolean);
  const segments: SegmentItem[] = [];

  let currentStartTime = "";
  let currentEndTime = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const timeMatch = parseTimeRange(line);

    if (timeMatch) {
      currentStartTime = timeMatch.startTime;
      currentEndTime = timeMatch.endTime;
    } else if (currentStartTime && currentEndTime) {
      segments.push({
        id: `seg-${Date.now()}-${segments.length + 1}`,
        startTime: currentStartTime,
        endTime: currentEndTime,
        currentLabel: line,
        status: "idle",
      });
      currentStartTime = "";
      currentEndTime = "";
    }
  }

  return segments;
}
