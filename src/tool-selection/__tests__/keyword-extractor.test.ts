import { describe, it, expect } from "vitest";
import {
  extractKeywords,
  extractKeywordsFromSources,
} from "../keyword-extractor";

describe("keyword-extractor", () => {
  describe("extractKeywords", () => {
    it("should extract keywords from simple text", () => {
      const keywords = extractKeywords("read the file content");
      expect(keywords).toContain("read");
      expect(keywords).toContain("file");
      expect(keywords).toContain("content");
      expect(keywords).not.toContain("the"); // stop word
    });

    it("should filter out short words", () => {
      const keywords = extractKeywords("go to db");
      expect(keywords).not.toContain("go");
      expect(keywords).not.toContain("to");
      expect(keywords).not.toContain("db");
    });

    it("should clean punctuation", () => {
      const keywords = extractKeywords("file.json read() content!");
      // file.json becomes filejson after removing non-alphanumeric
      expect(keywords).toContain("filejson");
      expect(keywords).toContain("read");
      expect(keywords).toContain("content");
    });

    it("should lowercase all keywords", () => {
      const keywords = extractKeywords("FILE JSON READ");
      expect(keywords).toContain("file");
      expect(keywords).toContain("json");
      expect(keywords).toContain("read");
    });

    it("should filter stop words", () => {
      const keywords = extractKeywords("what is the best way to do this");
      expect(keywords).not.toContain("what");
      expect(keywords).not.toContain("the");
      // "way" is not a stop word in the implementation
      expect(keywords).toContain("way");
      expect(keywords).not.toContain("this");
      expect(keywords).toContain("best");
    });

    it("should handle empty string", () => {
      const keywords = extractKeywords("");
      expect(keywords).toEqual([]);
    });
  });

  describe("extractKeywordsFromSources", () => {
    it("should extract keywords from multiple sources", () => {
      const keywords = extractKeywordsFromSources([
        "read file",
        "write database",
        undefined,
      ]);
      expect(keywords).toContain("read");
      expect(keywords).toContain("file");
      expect(keywords).toContain("write");
      expect(keywords).toContain("database");
    });

    it("should handle all undefined sources", () => {
      const keywords = extractKeywordsFromSources([undefined, undefined]);
      expect(keywords).toEqual([]);
    });
  });
});
