import { describe, it, expect } from "vitest";
import { parseEditBlocks, stripEditBlocks } from "./parseEditBlocks";

// ---------- parseEditBlocks ----------

describe("parseEditBlocks", () => {
  it("returns empty array when no blocks present", () => {
    expect(parseEditBlocks("Just a normal response.")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseEditBlocks("")).toEqual([]);
  });

  it("parses a single edit block", () => {
    const text = [
      "Here is the edit:",
      "````edit:My Note",
      "# Updated content",
      "Some new text here.",
      "````",
    ].join("\n");

    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe("edit");
    expect(blocks[0]!.noteTitle).toBe("My Note");
    expect(blocks[0]!.content).toBe("# Updated content\nSome new text here.\n");
    expect(blocks[0]!.status).toBe("pending");
  });

  it("parses a single create block", () => {
    const text = [
      "I'll create that for you:",
      "````create:New Note Title",
      "# New Note",
      "Content goes here.",
      "````",
    ].join("\n");

    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe("create");
    expect(blocks[0]!.noteTitle).toBe("New Note Title");
    expect(blocks[0]!.content).toContain("# New Note");
  });

  it("parses multiple blocks in one response", () => {
    const text = [
      "I'll edit both notes:",
      "````edit:Note A",
      "Updated A content",
      "````",
      "And also:",
      "````create:Note B",
      "New B content",
      "````",
    ].join("\n");

    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.type).toBe("edit");
    expect(blocks[0]!.noteTitle).toBe("Note A");
    expect(blocks[1]!.type).toBe("create");
    expect(blocks[1]!.noteTitle).toBe("Note B");
  });

  it("trims whitespace from note title", () => {
    const text = "````edit:  Spaced Title  \ncontent\n````";
    const blocks = parseEditBlocks(text);
    expect(blocks[0]!.noteTitle).toBe("Spaced Title");
  });

  it("preserves multiline content including blank lines", () => {
    const text = [
      "````edit:My Note",
      "Line 1",
      "",
      "Line 3",
      "",
      "Line 5",
      "````",
    ].join("\n");

    const blocks = parseEditBlocks(text);
    expect(blocks[0]!.content).toBe("Line 1\n\nLine 3\n\nLine 5\n");
  });

  it("preserves markdown formatting in content", () => {
    const text = [
      "````edit:My Note",
      "# Heading",
      "- bullet 1",
      "- bullet 2",
      "",
      "```js",
      "const x = 1;",
      "```",
      "````",
    ].join("\n");

    const blocks = parseEditBlocks(text);
    expect(blocks[0]!.content).toContain("# Heading");
    expect(blocks[0]!.content).toContain("```js");
    expect(blocks[0]!.content).toContain("const x = 1;");
  });

  it("ignores regular triple-backtick code blocks", () => {
    const text = [
      "Here is some code:",
      "```js",
      "const x = 1;",
      "```",
      "That's it.",
    ].join("\n");

    expect(parseEditBlocks(text)).toEqual([]);
  });

  it("handles content with wiki links", () => {
    const text = [
      "````edit:Daily Log",
      "# Daily Log",
      "See [[Projects]] and [[Ideas]].",
      "````",
    ].join("\n");

    const blocks = parseEditBlocks(text);
    expect(blocks[0]!.content).toContain("[[Projects]]");
    expect(blocks[0]!.content).toContain("[[Ideas]]");
  });

  it("all blocks default to pending status", () => {
    const text = [
      "````edit:A",
      "content a",
      "````",
      "````create:B",
      "content b",
      "````",
    ].join("\n");

    const blocks = parseEditBlocks(text);
    expect(blocks.every((b) => b.status === "pending")).toBe(true);
  });

  it("handles note title with special characters", () => {
    const text = "````edit:My Note (2024) - Draft #1\ncontent\n````";
    const blocks = parseEditBlocks(text);
    expect(blocks[0]!.noteTitle).toBe("My Note (2024) - Draft #1");
  });

  it("handles empty content block", () => {
    const text = "````edit:Empty Note\n````";
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.content).toBe("");
  });
});

// ---------- stripEditBlocks ----------

describe("stripEditBlocks", () => {
  it("returns text unchanged when no blocks present", () => {
    expect(stripEditBlocks("Just normal text.")).toBe("Just normal text.");
  });

  it("returns empty string for empty input", () => {
    expect(stripEditBlocks("")).toBe("");
  });

  it("strips a single edit block and keeps surrounding text", () => {
    const text = [
      "Here is the edit:",
      "````edit:My Note",
      "new content",
      "````",
      "Done!",
    ].join("\n");

    const result = stripEditBlocks(text);
    expect(result).toBe("Here is the edit:\n\nDone!");
    expect(result).not.toContain("````");
    expect(result).not.toContain("new content");
  });

  it("strips a create block", () => {
    const text = [
      "Creating note:",
      "````create:New Note",
      "content",
      "````",
    ].join("\n");

    const result = stripEditBlocks(text);
    expect(result).toBe("Creating note:");
  });

  it("strips multiple blocks", () => {
    const text = [
      "I'll update both:",
      "````edit:Note A",
      "content a",
      "````",
      "And create:",
      "````create:Note B",
      "content b",
      "````",
      "All done.",
    ].join("\n");

    const result = stripEditBlocks(text);
    expect(result).toContain("I'll update both:");
    expect(result).toContain("And create:");
    expect(result).toContain("All done.");
    expect(result).not.toContain("content a");
    expect(result).not.toContain("content b");
  });

  it("does not strip regular triple-backtick code blocks", () => {
    const text = [
      "Here is code:",
      "```js",
      "const x = 1;",
      "```",
    ].join("\n");

    expect(stripEditBlocks(text)).toBe(text);
  });

  it("trims whitespace from result", () => {
    const text = "   ````edit:Note\ncontent\n````   ";
    expect(stripEditBlocks(text)).toBe("");
  });
});
