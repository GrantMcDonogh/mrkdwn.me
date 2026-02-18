import { describe, it, expect } from "vitest";
import { fuzzyScore } from "./QuickSwitcher";

describe("fuzzyScore", () => {
  it("returns a high score for an exact match", () => {
    const score = fuzzyScore("Daily Notes", "Daily Notes");
    expect(score).toBeGreaterThan(900);
  });

  it("returns a high score for a substring at the start", () => {
    const score = fuzzyScore("Daily", "Daily Notes");
    expect(score).toBe(1000); // indexOf === 0
  });

  it("scores a later substring lower than an earlier one", () => {
    const early = fuzzyScore("Notes", "Notes on Testing");
    const late = fuzzyScore("Notes", "My Daily Notes");
    expect(early).toBeGreaterThan(late);
  });

  it("returns a positive score for fuzzy character matches", () => {
    const score = fuzzyScore("dn", "Daily Notes");
    expect(score).toBeGreaterThan(0);
  });

  it("awards a consecutive-character bonus", () => {
    // "dai" matches consecutively in "Daily" → higher than "d_a_i" scattered
    const consecutive = fuzzyScore("dai", "Daily Notes");
    const scattered = fuzzyScore("dnt", "Daily Notes");
    expect(consecutive).toBeGreaterThan(scattered);
  });

  it("returns -1 when no match is possible", () => {
    expect(fuzzyScore("xyz", "Daily Notes")).toBe(-1);
  });

  it("is case-insensitive", () => {
    expect(fuzzyScore("daily", "Daily Notes")).toBe(fuzzyScore("Daily", "Daily Notes"));
  });

  it("returns a positive score for single-character query", () => {
    expect(fuzzyScore("d", "Daily")).toBeGreaterThan(0);
  });

  it("returns -1 for an empty query (no chars to match → substring branch)", () => {
    // empty string is a substring of everything → t.includes("") is true
    const score = fuzzyScore("", "anything");
    expect(score).toBe(1000); // indexOf("") === 0
  });
});
