/**
 * Keyword extraction utilities
 */

import { STOP_WORDS } from "./constants";

/**
 * Extract keywords from text for matching
 * Filters out stop words and short words
 */
export function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const keywords: string[] = [];

  for (const word of words) {
    const cleaned = word.replace(/[^a-z0-9]/g, "");
    if (cleaned.length > 2 && !STOP_WORDS[cleaned]) {
      keywords.push(cleaned);
    }
  }

  return keywords;
}

/**
 * Extract keywords from multiple sources
 */
export function extractKeywordsFromSources(
  sources: (string | undefined)[],
): string[] {
  const keywords: string[] = [];

  for (const source of sources) {
    if (source) {
      keywords.push(...extractKeywords(source));
    }
  }

  return keywords;
}
