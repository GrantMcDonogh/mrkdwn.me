import { describe, it, expect } from "vitest";
import {
  stripMarkdownFencing,
  extractClaudeText,
  parseGeneratedVault,
  buildUserMessage,
} from "./onboardingParse";

// ---------- stripMarkdownFencing ----------

describe("stripMarkdownFencing", () => {
  it("strips ```json fencing", () => {
    const input = '```json\n{"vaultName":"Test"}\n```';
    expect(stripMarkdownFencing(input)).toBe('{"vaultName":"Test"}');
  });

  it("strips ``` fencing without language tag", () => {
    const input = '```\n{"vaultName":"Test"}\n```';
    expect(stripMarkdownFencing(input)).toBe('{"vaultName":"Test"}');
  });

  it("strips ```JSON fencing (case insensitive)", () => {
    const input = '```JSON\n{"vaultName":"Test"}\n```';
    expect(stripMarkdownFencing(input)).toBe('{"vaultName":"Test"}');
  });

  it("returns text unchanged when no fencing present", () => {
    const input = '{"vaultName":"Test","folders":[],"notes":[]}';
    expect(stripMarkdownFencing(input)).toBe(input);
  });

  it("handles fencing with extra whitespace", () => {
    const input = '```json  \n{"data":true}\n```  ';
    expect(stripMarkdownFencing(input)).toBe('{"data":true}');
  });

  it("handles empty string", () => {
    expect(stripMarkdownFencing("")).toBe("");
  });

  it("only strips opening/closing fencing, not inline backticks", () => {
    const input = 'some `code` here';
    expect(stripMarkdownFencing(input)).toBe('some `code` here');
  });
});

// ---------- extractClaudeText ----------

describe("extractClaudeText", () => {
  it("extracts text from a standard Claude response", () => {
    const body = {
      content: [{ type: "text", text: "Hello world" }],
    };
    expect(extractClaudeText(body)).toBe("Hello world");
  });

  it("returns empty string for empty content array", () => {
    expect(extractClaudeText({ content: [] })).toBe("");
  });

  it("returns empty string when content is missing", () => {
    expect(extractClaudeText({})).toBe("");
  });

  it("returns empty string when content is not an array", () => {
    expect(extractClaudeText({ content: "not an array" })).toBe("");
  });

  it("returns empty string when first block is not text type", () => {
    const body = {
      content: [{ type: "tool_use", id: "123" }],
    };
    expect(extractClaudeText(body)).toBe("");
  });

  it("returns empty string when text field is missing from block", () => {
    const body = {
      content: [{ type: "text" }],
    };
    expect(extractClaudeText(body)).toBe("");
  });

  it("only reads the first content block", () => {
    const body = {
      content: [
        { type: "text", text: "first" },
        { type: "text", text: "second" },
      ],
    };
    expect(extractClaudeText(body)).toBe("first");
  });
});

// ---------- parseGeneratedVault ----------

describe("parseGeneratedVault", () => {
  const validVault = JSON.stringify({
    vaultName: "My Brain",
    folders: [
      { tempId: "folder-0", name: "Projects", order: 0 },
      { tempId: "folder-1", name: "Notes", order: 1 },
    ],
    notes: [
      {
        title: "Welcome",
        content: "# Welcome\nSee [[Projects]] and [[Notes]]",
        order: 0,
      },
      {
        title: "Project A",
        content: "# Project A\nDetails here.",
        folderTempId: "folder-0",
        order: 0,
      },
    ],
  });

  it("parses a valid vault JSON string", () => {
    const result = parseGeneratedVault(validVault);
    expect(result.vaultName).toBe("My Brain");
    expect(result.folders).toHaveLength(2);
    expect(result.notes).toHaveLength(2);
  });

  it("strips markdown fencing before parsing", () => {
    const fenced = "```json\n" + validVault + "\n```";
    const result = parseGeneratedVault(fenced);
    expect(result.vaultName).toBe("My Brain");
  });

  it("preserves folder structure", () => {
    const result = parseGeneratedVault(validVault);
    expect(result.folders[0]!.tempId).toBe("folder-0");
    expect(result.folders[0]!.name).toBe("Projects");
    expect(result.folders[1]!.tempId).toBe("folder-1");
  });

  it("preserves note content with wiki links", () => {
    const result = parseGeneratedVault(validVault);
    const welcome = result.notes.find((n) => n.title === "Welcome")!;
    expect(welcome.content).toContain("[[Projects]]");
    expect(welcome.content).toContain("[[Notes]]");
  });

  it("preserves folderTempId on notes", () => {
    const result = parseGeneratedVault(validVault);
    const projectNote = result.notes.find((n) => n.title === "Project A")!;
    expect(projectNote.folderTempId).toBe("folder-0");
  });

  it("root-level notes have no folderTempId", () => {
    const result = parseGeneratedVault(validVault);
    const welcome = result.notes.find((n) => n.title === "Welcome")!;
    expect(welcome.folderTempId).toBeUndefined();
  });

  it("throws on invalid JSON", () => {
    expect(() => parseGeneratedVault("not json")).toThrow();
  });

  it("throws when vaultName is missing", () => {
    const noName = JSON.stringify({ folders: [], notes: [] });
    expect(() => parseGeneratedVault(noName)).toThrow("Missing or invalid vaultName");
  });

  it("throws when vaultName is empty string", () => {
    const emptyName = JSON.stringify({
      vaultName: "",
      folders: [],
      notes: [],
    });
    expect(() => parseGeneratedVault(emptyName)).toThrow("Missing or invalid vaultName");
  });

  it("throws when vaultName is not a string", () => {
    const numName = JSON.stringify({
      vaultName: 42,
      folders: [],
      notes: [],
    });
    expect(() => parseGeneratedVault(numName)).toThrow("Missing or invalid vaultName");
  });

  it("throws when folders is missing", () => {
    const noFolders = JSON.stringify({ vaultName: "Test", notes: [] });
    expect(() => parseGeneratedVault(noFolders)).toThrow(
      "Missing or invalid folders"
    );
  });

  it("throws when folders is not an array", () => {
    const badFolders = JSON.stringify({
      vaultName: "Test",
      folders: "nope",
      notes: [],
    });
    expect(() => parseGeneratedVault(badFolders)).toThrow(
      "Missing or invalid folders"
    );
  });

  it("throws when notes is missing", () => {
    const noNotes = JSON.stringify({ vaultName: "Test", folders: [] });
    expect(() => parseGeneratedVault(noNotes)).toThrow(
      "Missing or invalid notes"
    );
  });

  it("throws when notes is not an array", () => {
    const badNotes = JSON.stringify({
      vaultName: "Test",
      folders: [],
      notes: {},
    });
    expect(() => parseGeneratedVault(badNotes)).toThrow(
      "Missing or invalid notes"
    );
  });

  it("allows empty folders and notes arrays", () => {
    const minimal = JSON.stringify({
      vaultName: "Empty Vault",
      folders: [],
      notes: [],
    });
    const result = parseGeneratedVault(minimal);
    expect(result.vaultName).toBe("Empty Vault");
    expect(result.folders).toHaveLength(0);
    expect(result.notes).toHaveLength(0);
  });
});

// ---------- parseGeneratedVault — realistic Claude output ----------

describe("parseGeneratedVault — realistic Claude output", () => {
  it("parses a full realistic vault structure", () => {
    const realistic = JSON.stringify({
      vaultName: "Tech Second Brain",
      folders: [
        { tempId: "folder-0", name: "Inbox", order: 0 },
        { tempId: "folder-1", name: "Projects", order: 1 },
        { tempId: "folder-2", name: "Areas", order: 2 },
        { tempId: "folder-3", name: "Resources", order: 3 },
        {
          tempId: "folder-4",
          name: "Web Dev",
          parentTempId: "folder-3",
          order: 0,
        },
        { tempId: "folder-5", name: "Archive", order: 4 },
      ],
      notes: [
        {
          title: "Home",
          content:
            "# Home\nWelcome! Start with [[Inbox]] or browse [[Projects]].\n\n## Quick Links\n- [[Daily Template]]\n- [[Web Dev]]",
          order: 0,
        },
        {
          title: "Daily Template",
          content: "# {{date}}\n## Tasks\n- [ ] \n\n## Notes\n",
          folderTempId: "folder-0",
          order: 0,
        },
        {
          title: "Project Template",
          content:
            "# Project Name\n## Goals\n-\n## Resources\n- [[Resources]]\n## Log\n",
          folderTempId: "folder-1",
          order: 0,
        },
        {
          title: "React Notes",
          content:
            "# React\n## Hooks\n- useState\n- useEffect\n\nSee also [[TypeScript Notes]].",
          folderTempId: "folder-4",
          order: 0,
        },
        {
          title: "TypeScript Notes",
          content:
            "# TypeScript\n## Key Concepts\n- Generics\n- Utility types\n\nUsed in [[React Notes]].",
          folderTempId: "folder-4",
          order: 1,
        },
      ],
    });

    const result = parseGeneratedVault(realistic);

    expect(result.vaultName).toBe("Tech Second Brain");
    expect(result.folders).toHaveLength(6);
    expect(result.notes).toHaveLength(5);

    // Check nested folder
    const webDev = result.folders.find((f) => f.name === "Web Dev")!;
    expect(webDev.parentTempId).toBe("folder-3");

    // Check root folder
    const inbox = result.folders.find((f) => f.name === "Inbox")!;
    expect(inbox.parentTempId).toBeUndefined();

    // Check note with wiki links
    const home = result.notes.find((n) => n.title === "Home")!;
    expect(home.content).toContain("[[Inbox]]");
    expect(home.content).toContain("[[Projects]]");
    expect(home.folderTempId).toBeUndefined();

    // Check nested note
    const reactNotes = result.notes.find((n) => n.title === "React Notes")!;
    expect(reactNotes.folderTempId).toBe("folder-4");
  });
});

// ---------- buildUserMessage ----------

describe("buildUserMessage", () => {
  it("builds message from full answers", () => {
    const msg = buildUserMessage({
      purpose: "Work",
      topics: ["Technology", "Business"],
      organization: "By project",
      starter: "Full starter kit",
    });
    expect(msg).toContain("Primary use: Work");
    expect(msg).toContain("Topics of interest: Technology, Business");
    expect(msg).toContain("Organization style: By project");
    expect(msg).toContain("Starter content: Full starter kit");
  });

  it("uses defaults for missing answers", () => {
    const msg = buildUserMessage({});
    expect(msg).toContain("Primary use: General second brain");
    expect(msg).toContain("Topics of interest: Mixed");
    expect(msg).toContain("Organization style: By topic");
    expect(msg).toContain("Starter content: Templates & examples");
  });

  it("handles topics as a single string", () => {
    const msg = buildUserMessage({ topics: "Science" });
    expect(msg).toContain("Topics of interest: Science");
  });

  it("handles topics as an array with one item", () => {
    const msg = buildUserMessage({ topics: ["Arts"] });
    expect(msg).toContain("Topics of interest: Arts");
  });

  it("handles topics as an array with multiple items", () => {
    const msg = buildUserMessage({
      topics: ["Technology", "Science", "Self-improvement"],
    });
    expect(msg).toContain(
      "Topics of interest: Technology, Science, Self-improvement"
    );
  });

  it("handles undefined topics explicitly", () => {
    const msg = buildUserMessage({ topics: undefined });
    expect(msg).toContain("Topics of interest: Mixed");
  });
});
