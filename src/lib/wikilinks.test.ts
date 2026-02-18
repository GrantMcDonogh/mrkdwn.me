import { describe, it, expect } from "vitest";
import {
  parseWikiLinkInner,
  contentHasBacklinkTo,
  applyWikiLinkRename,
  isUnlinkedMention,
} from "./wikilinks";

// ---------- parseWikiLinkInner ----------

describe("parseWikiLinkInner", () => {
  it("parses a plain title", () => {
    expect(parseWikiLinkInner("My Note")).toEqual({
      title: "My Note",
      alias: null,
      heading: null,
    });
  });

  it("parses an alias (pipe syntax)", () => {
    expect(parseWikiLinkInner("My Note|display text")).toEqual({
      title: "My Note",
      alias: "display text",
      heading: null,
    });
  });

  it("parses a heading reference", () => {
    expect(parseWikiLinkInner("My Note#Section")).toEqual({
      title: "My Note",
      alias: null,
      heading: "Section",
    });
  });

  it("pipe takes precedence over hash", () => {
    // "Title|Alias#Heading" → pipe wins, alias = "Alias#Heading"
    expect(parseWikiLinkInner("Title|Alias#Heading")).toEqual({
      title: "Title",
      alias: "Alias#Heading",
      heading: null,
    });
  });
});

// ---------- contentHasBacklinkTo ----------

describe("contentHasBacklinkTo", () => {
  it("detects a basic [[Title]] link", () => {
    expect(contentHasBacklinkTo("See [[Daily Log]] for details.", "Daily Log")).toBe(true);
  });

  it("detects an alias link [[Title|...", () => {
    expect(contentHasBacklinkTo("See [[Daily Log|log]] here.", "Daily Log")).toBe(true);
  });

  it("detects a heading link [[Title#...", () => {
    expect(contentHasBacklinkTo("See [[Daily Log#Heading]].", "Daily Log")).toBe(true);
  });

  it("returns false when no link matches", () => {
    expect(contentHasBacklinkTo("No links here.", "Daily Log")).toBe(false);
  });

  it("returns false for partial title matches", () => {
    // "Daily" is not "Daily Log"
    expect(contentHasBacklinkTo("See [[Daily]] here.", "Daily Log")).toBe(false);
  });
});

// ---------- applyWikiLinkRename ----------

describe("applyWikiLinkRename", () => {
  it("renames a basic [[OldTitle]] link", () => {
    const result = applyWikiLinkRename("See [[Old Name]] here.", "Old Name", "New Name");
    expect(result).toBe("See [[New Name]] here.");
  });

  it("renames an alias link [[OldTitle|alias]]", () => {
    const result = applyWikiLinkRename("See [[Old Name|alias]] here.", "Old Name", "New Name");
    expect(result).toBe("See [[New Name|alias]] here.");
  });

  it("renames a heading link [[OldTitle#heading]]", () => {
    const result = applyWikiLinkRename("See [[Old Name#Section]].", "Old Name", "New Name");
    expect(result).toBe("See [[New Name#Section]].");
  });

  it("renames multiple occurrences", () => {
    const content = "[[Old Name]] and [[Old Name|alias]] and [[Old Name#H1]]";
    const result = applyWikiLinkRename(content, "Old Name", "New Name");
    expect(result).toBe("[[New Name]] and [[New Name|alias]] and [[New Name#H1]]");
  });

  it("returns content unchanged when no match", () => {
    const content = "Nothing to change here.";
    expect(applyWikiLinkRename(content, "Old Name", "New Name")).toBe(content);
  });
});

// ---------- isUnlinkedMention ----------

describe("isUnlinkedMention", () => {
  it("detects a plain text mention", () => {
    expect(isUnlinkedMention("I wrote about Daily Log today.", "Daily Log")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isUnlinkedMention("I wrote about daily log today.", "Daily Log")).toBe(true);
  });

  it("excludes mentions inside [[ ]]", () => {
    expect(isUnlinkedMention("See [[Daily Log]] for details.", "Daily Log")).toBe(false);
  });

  it("returns false when the title is not present", () => {
    expect(isUnlinkedMention("Nothing relevant here.", "Daily Log")).toBe(false);
  });
});
