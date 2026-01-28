import { describe, it, expect } from "vitest";
import {
  inferDomains,
  domainMatches,
  DOMAIN_KEYWORDS,
} from "../domain-inferrer";

describe("domain-inferrer", () => {
  describe("DOMAIN_KEYWORDS", () => {
    it("should have keywords for all domains", () => {
      expect(DOMAIN_KEYWORDS.files.length).toBeGreaterThan(0);
      expect(DOMAIN_KEYWORDS.vcs.length).toBeGreaterThan(0);
      expect(DOMAIN_KEYWORDS.web.length).toBeGreaterThan(0);
      expect(DOMAIN_KEYWORDS.data.length).toBeGreaterThan(0);
      expect(DOMAIN_KEYWORDS.ops.length).toBeGreaterThan(0);
      expect(DOMAIN_KEYWORDS.comm.length).toBeGreaterThan(0);
      expect(DOMAIN_KEYWORDS.finance.length).toBeGreaterThan(0);
      expect(DOMAIN_KEYWORDS.security.length).toBeGreaterThan(0);
      expect(DOMAIN_KEYWORDS.ai.length).toBeGreaterThan(0);
      expect(DOMAIN_KEYWORDS.travel.length).toBeGreaterThan(0);
    });
  });

  describe("inferDomains", () => {
    it("should infer files domain from file-related keywords", () => {
      const domains = inferDomains(["file", "read", "directory"]);
      expect(domains).toContain("files");
      expect(domains[0]).toBe("files"); // Should be highest scored
    });

    it("should infer vcs domain from git keywords", () => {
      const domains = inferDomains(["git", "commit", "branch"]);
      expect(domains).toContain("vcs");
      expect(domains[0]).toBe("vcs");
    });

    it("should infer web domain from http keywords", () => {
      const domains = inferDomains(["fetch", "url", "api"]);
      expect(domains).toContain("web");
    });

    it("should infer data domain from database keywords", () => {
      const domains = inferDomains(["database", "query", "sql"]);
      expect(domains).toContain("data");
    });

    it("should infer travel domain from flight keywords", () => {
      const domains = inferDomains(["flight", "booking", "airport"]);
      expect(domains).toContain("travel");
      expect(domains[0]).toBe("travel");
    });

    it("should infer multiple domains sorted by relevance", () => {
      const domains = inferDomains(["file", "git", "commit"]);
      expect(domains.length).toBeGreaterThan(1);
      expect(domains).toContain("files");
      expect(domains).toContain("vcs");
    });

    it("should return empty array for unrecognized keywords", () => {
      const domains = inferDomains(["xyz", "abc", "123"]);
      expect(domains).toEqual([]);
    });

    it("should handle partial keyword matches", () => {
      const domains = inferDomains(["filesystem"]); // contains 'file'
      expect(domains).toContain("files");
    });
  });

  describe("domainMatches", () => {
    it("should return true when domain is in inferred list", () => {
      const result = domainMatches("files", ["files", "vcs"]);
      expect(result.matches).toBe(true);
      expect(result.rank).toBe(0);
    });

    it("should return correct rank for secondary domain", () => {
      const result = domainMatches("vcs", ["files", "vcs", "data"]);
      expect(result.matches).toBe(true);
      expect(result.rank).toBe(1);
    });

    it("should return false when domain not in list", () => {
      const result = domainMatches("travel", ["files", "vcs"]);
      expect(result.matches).toBe(false);
      expect(result.rank).toBe(-1);
    });

    it("should handle undefined domain", () => {
      const result = domainMatches(undefined, ["files", "vcs"]);
      expect(result.matches).toBe(false);
      expect(result.rank).toBe(-1);
    });
  });
});
