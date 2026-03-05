import { describe, it, expect } from "vitest";
import { preprocessContent } from "./preprocessMarkdown";

// ---------- wiki links ----------

describe("preprocessContent — wiki links", () => {
  it("converts a basic [[Title]] to a markdown link", () => {
    expect(preprocessContent("See [[My Note]] here.")).toBe(
      "See [My Note](wikilink://My%20Note) here."
    );
  });

  it("converts an aliased [[Title|Alias]] link", () => {
    expect(preprocessContent("See [[My Note|display text]] here.")).toBe(
      "See [display text](wikilink://My%20Note) here."
    );
  });

  it("converts multiple wiki links in one line", () => {
    const input = "Link [[A]] and [[B|beta]].";
    expect(preprocessContent(input)).toBe(
      "Link [A](wikilink://A) and [beta](wikilink://B)."
    );
  });

  it("encodes special characters in the title", () => {
    expect(preprocessContent("[[Notes & Ideas]]")).toBe(
      "[Notes & Ideas](wikilink://Notes%20%26%20Ideas)"
    );
  });

  it("does not convert wiki links inside inline code", () => {
    expect(preprocessContent("Use `[[Not A Link]]` syntax.")).toBe(
      "Use `[[Not A Link]]` syntax."
    );
  });

  it("does not convert wiki links inside fenced code blocks", () => {
    const input = "Before\n```\n[[Not A Link]]\n```\nAfter [[Real Link]]";
    const result = preprocessContent(input);
    expect(result).toContain("[[Not A Link]]");
    expect(result).toContain("[Real Link](wikilink://Real%20Link)");
  });
});

// ---------- tags ----------

describe("preprocessContent — tags", () => {
  it("converts a tag preceded by whitespace", () => {
    expect(preprocessContent("Hello #project")).toBe(
      "Hello [#project](tag://project)"
    );
  });

  it("converts a tag at the start of a line", () => {
    expect(preprocessContent("#status")).toBe("[#status](tag://status)");
  });

  it("converts tags with slashes and hyphens", () => {
    expect(preprocessContent("#work/in-progress")).toBe(
      "[#work/in-progress](tag://work/in-progress)"
    );
  });

  it("does not convert markdown headings as tags", () => {
    // Markdown headings like "# Heading" start with `# ` — the regex
    // requires the character after # to be a letter, so "# " won't match.
    const input = "# Heading";
    expect(preprocessContent(input)).toBe("# Heading");
  });

  it("does not convert tags inside inline code", () => {
    expect(preprocessContent("Use `#tag` in code.")).toBe(
      "Use `#tag` in code."
    );
  });

  it("does not convert tags inside fenced code blocks", () => {
    const input = "```\n#notag\n```\nText #real";
    const result = preprocessContent(input);
    expect(result).toContain("#notag");
    expect(result).toContain("[#real](tag://real)");
  });
});

// ---------- raw JSON blocks ----------

describe("preprocessContent — raw JSON blocks", () => {
  it("wraps a multi-line JSON object in a code fence", () => {
    const input = '{\n  "key": "value"\n}';
    const result = preprocessContent(input);
    expect(result).toContain("```json");
    expect(result).toContain('"key": "value"');
  });

  it("wraps a multi-line JSON array in a code fence", () => {
    const input = '[\n  1,\n  2,\n  3\n]';
    const result = preprocessContent(input);
    expect(result).toContain("```json");
    expect(result).toContain("1,");
  });

  it("does not wrap single-line JSON-like text", () => {
    const input = '{"key": "value"}';
    const result = preprocessContent(input);
    expect(result).not.toContain("```json");
  });

  it("does not double-wrap JSON already in a code fence", () => {
    const input = '```json\n{\n  "key": "value"\n}\n```';
    const result = preprocessContent(input);
    // Should only have one pair of fences
    const fenceCount = (result.match(/```/g) || []).length;
    expect(fenceCount).toBe(2);
  });

  it("wraps JSON that follows markdown text", () => {
    const input = 'Here is some config:\n{\n  "name": "test"\n}\nEnd.';
    const result = preprocessContent(input);
    expect(result).toContain("```json");
    expect(result).toContain('"name": "test"');
    expect(result).toContain("End.");
  });
});

// ---------- mixed content ----------

describe("preprocessContent — mixed", () => {
  it("converts both wiki links and tags in the same content", () => {
    const input = "See [[Note]] about #topic";
    const result = preprocessContent(input);
    expect(result).toContain("[Note](wikilink://Note)");
    expect(result).toContain("[#topic](tag://topic)");
  });

  it("returns empty string for empty input", () => {
    expect(preprocessContent("")).toBe("");
  });

  it("returns plain text unchanged when no wiki links or tags", () => {
    const input = "Just some plain text with **bold** and [link](https://example.com).";
    expect(preprocessContent(input)).toBe(input);
  });

  it("handles content with multiple code blocks interleaved", () => {
    const input =
      "[[A]] then `code [[B]]` then [[C]] then ```\n[[D]]\n``` then [[E]]";
    const result = preprocessContent(input);
    // A, C, E should be converted; B and D should not
    expect(result).toContain("[A](wikilink://A)");
    expect(result).toContain("[[B]]");
    expect(result).toContain("[C](wikilink://C)");
    expect(result).toContain("[[D]]");
    expect(result).toContain("[E](wikilink://E)");
  });
});
