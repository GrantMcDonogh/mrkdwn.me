import { describe, it, expect } from "vitest";
import { sections, allEndpoints } from "./DocsPage";

describe("DocsPage endpoint data", () => {
  it("documents all 16 API v1 endpoints", () => {
    expect(allEndpoints).toHaveLength(16);
  });

  it("has unique endpoint IDs", () => {
    const ids = allEndpoints.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique section IDs", () => {
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every endpoint has a non-empty summary", () => {
    for (const endpoint of allEndpoints) {
      expect(endpoint.summary.length).toBeGreaterThan(0);
    }
  });

  it("every endpoint has a curl example and response example", () => {
    for (const endpoint of allEndpoints) {
      expect(endpoint.curl.length).toBeGreaterThan(0);
      expect(endpoint.response.length).toBeGreaterThan(0);
    }
  });

  it("every endpoint path starts with /api/v1/", () => {
    for (const endpoint of allEndpoints) {
      expect(endpoint.path).toMatch(/^\/api\/v1\//);
    }
  });

  it("uses only valid HTTP methods", () => {
    const validMethods = new Set(["GET", "POST", "PATCH", "DELETE"]);
    for (const endpoint of allEndpoints) {
      expect(validMethods.has(endpoint.method)).toBe(true);
    }
  });

  it("every response example is valid JSON", () => {
    for (const endpoint of allEndpoints) {
      expect(() => JSON.parse(endpoint.response)).not.toThrow();
    }
  });

  it("every response example has ok: true envelope", () => {
    for (const endpoint of allEndpoints) {
      const parsed = JSON.parse(endpoint.response);
      expect(parsed.ok).toBe(true);
      expect("data" in parsed).toBe(true);
    }
  });

  it("covers the expected API paths", () => {
    const paths = allEndpoints.map((e) => `${e.method} ${e.path}`);
    expect(paths).toContain("GET /api/v1/vault");
    expect(paths).toContain("GET /api/v1/folders");
    expect(paths).toContain("POST /api/v1/folders");
    expect(paths).toContain("PATCH /api/v1/folders/rename");
    expect(paths).toContain("PATCH /api/v1/folders/move");
    expect(paths).toContain("DELETE /api/v1/folders");
    expect(paths).toContain("GET /api/v1/notes");
    expect(paths).toContain("GET /api/v1/notes/get");
    expect(paths).toContain("GET /api/v1/notes/search");
    expect(paths).toContain("GET /api/v1/notes/backlinks");
    expect(paths).toContain("GET /api/v1/notes/unlinked-mentions");
    expect(paths).toContain("POST /api/v1/notes");
    expect(paths).toContain("PATCH /api/v1/notes/update");
    expect(paths).toContain("PATCH /api/v1/notes/rename");
    expect(paths).toContain("PATCH /api/v1/notes/move");
    expect(paths).toContain("DELETE /api/v1/notes");
  });

  it("has three sections: Vault, Folders, Notes", () => {
    expect(sections.map((s) => s.title)).toEqual(["Vault", "Folders", "Notes"]);
  });

  it("POST/PATCH endpoints have body params, GET/DELETE do not", () => {
    for (const endpoint of allEndpoints) {
      if (endpoint.method === "POST" || endpoint.method === "PATCH") {
        expect(endpoint.body?.length).toBeGreaterThan(0);
      } else {
        expect(endpoint.body).toBeUndefined();
      }
    }
  });

  it("GET endpoints with query params have params defined", () => {
    const getWithParams = allEndpoints.filter(
      (e) => e.method === "GET" && e.curl.includes("?")
    );
    for (const endpoint of getWithParams) {
      expect(endpoint.params?.length).toBeGreaterThan(0);
    }
  });
});
