import { describe, it, expect } from "vitest";
import {
  parseVaultFiles,
  batchNotes,
  type ImportedNote,
} from "./importVault";
import type { Id } from "../../convex/_generated/dataModel";

// --- Helpers to build a mock FileList from path→content entries ---

function makeFile(path: string, content: string): File {
  const file = new File([content], path.split("/").pop()!);
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

function makeFileList(entries: [path: string, content: string][]): FileList {
  const files = entries.map(([p, c]) => makeFile(p, c));
  const list = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: () => files[Symbol.iterator](),
  } as unknown as FileList;
  // index access
  for (let i = 0; i < files.length; i++) {
    (list as any)[i] = files[i];
  }
  return list;
}

const FAKE_VAULT_ID = "vaults:abc123" as Id<"vaults">;

// ---------- parseVaultFiles — vault name ----------

describe("parseVaultFiles — vault name", () => {
  it("extracts vault name from the first path segment", async () => {
    const fl = makeFileList([["My Vault/note.md", "hi"]]);
    const result = await parseVaultFiles(fl);
    expect(result.name).toBe("My Vault");
  });
});

// ---------- parseVaultFiles — file categorization ----------

describe("parseVaultFiles — file categorization", () => {
  it("counts .md files, skipped files, and .obsidian files correctly", async () => {
    const fl = makeFileList([
      ["V/note.md", "a"],
      ["V/image.png", ""],
      ["V/.obsidian/app.json", "{}"],
      ["V/sub/deep.md", "b"],
      ["V/data.csv", ""],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.stats.mdFiles).toBe(2);
    expect(result.stats.skippedFiles).toBe(2); // png + csv
    expect(result.stats.totalFiles).toBe(5);
  });

  it("ignores .obsidian files in note and skip counts", async () => {
    const fl = makeFileList([
      ["V/.obsidian/app.json", "{}"],
      ["V/.obsidian/appearance.json", '{"cssTheme":"Nord"}'],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.stats.mdFiles).toBe(0);
    expect(result.stats.skippedFiles).toBe(0);
  });
});

// ---------- parseVaultFiles — folder tree ----------

describe("parseVaultFiles — folder tree", () => {
  it("builds no folders for root-level notes", async () => {
    const fl = makeFileList([
      ["V/note1.md", "a"],
      ["V/note2.md", "b"],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.folders).toHaveLength(0);
    expect(result.stats.folders).toBe(0);
  });

  it("builds a single folder for notes in one directory", async () => {
    const fl = makeFileList([
      ["V/Books/readme.md", "a"],
      ["V/Books/chapter1.md", "b"],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0]!.name).toBe("Books");
    expect(result.folders[0]!.parentTempId).toBeUndefined();
  });

  it("builds nested folders with correct parent references", async () => {
    const fl = makeFileList([
      ["V/Books/Sci-Fi/Dune.md", "spice"],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.folders).toHaveLength(2);

    const [books, scifi] = result.folders;
    expect(books!.name).toBe("Books");
    expect(books!.parentTempId).toBeUndefined();
    expect(scifi!.name).toBe("Sci-Fi");
    expect(scifi!.parentTempId).toBe(books!.tempId);
  });

  it("deduplicates folder paths from multiple notes", async () => {
    const fl = makeFileList([
      ["V/A/file1.md", "x"],
      ["V/A/file2.md", "y"],
      ["V/A/B/file3.md", "z"],
    ]);
    const result = await parseVaultFiles(fl);
    // "A" and "A/B" — not duplicated
    expect(result.folders).toHaveLength(2);
    const names = result.folders.map((f) => f.name);
    expect(names).toContain("A");
    expect(names).toContain("B");
  });

  it("topologically sorts parents before children", async () => {
    const fl = makeFileList([
      ["V/A/B/C/deep.md", "content"],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.folders.map((f) => f.name)).toEqual(["A", "B", "C"]);
    // Each child references the previous as parent
    expect(result.folders[0]!.parentTempId).toBeUndefined();
    expect(result.folders[1]!.parentTempId).toBe(result.folders[0]!.tempId);
    expect(result.folders[2]!.parentTempId).toBe(result.folders[1]!.tempId);
  });
});

// ---------- parseVaultFiles — notes ----------

describe("parseVaultFiles — notes", () => {
  it("strips .md extension for note title", async () => {
    const fl = makeFileList([["V/My Note.md", "body"]]);
    const result = await parseVaultFiles(fl);
    expect(result.notes[0]!.title).toBe("My Note");
  });

  it("reads file content correctly", async () => {
    const fl = makeFileList([["V/test.md", "# Hello\nWorld"]]);
    const result = await parseVaultFiles(fl);
    expect(result.notes[0]!.content).toBe("# Hello\nWorld");
  });

  it("sets folderTempId for nested notes", async () => {
    const fl = makeFileList([
      ["V/Books/readme.md", "a"],
      ["V/root.md", "b"],
    ]);
    const result = await parseVaultFiles(fl);
    const bookNote = result.notes.find((n) => n.title === "readme");
    const rootNote = result.notes.find((n) => n.title === "root");
    expect(bookNote!.folderTempId).toBeDefined();
    expect(rootNote!.folderTempId).toBeUndefined();
  });

  it("assigns incremental order within each folder", async () => {
    const fl = makeFileList([
      ["V/A/first.md", "1"],
      ["V/A/second.md", "2"],
      ["V/A/third.md", "3"],
    ]);
    const result = await parseVaultFiles(fl);
    const orders = result.notes.map((n) => n.order);
    expect(orders).toEqual([0, 1, 2]);
  });

  it("orders root and folder notes independently", async () => {
    const fl = makeFileList([
      ["V/root1.md", "a"],
      ["V/root2.md", "b"],
      ["V/Sub/note1.md", "c"],
      ["V/Sub/note2.md", "d"],
    ]);
    const result = await parseVaultFiles(fl);
    const rootNotes = result.notes.filter((n) => !n.folderTempId);
    const subNotes = result.notes.filter((n) => n.folderTempId);
    expect(rootNotes.map((n) => n.order)).toEqual([0, 1]);
    expect(subNotes.map((n) => n.order)).toEqual([0, 1]);
  });
});

// ---------- parseVaultFiles — .obsidian settings ----------

describe("parseVaultFiles — settings", () => {
  it("parses appearance.json cssTheme", async () => {
    const fl = makeFileList([
      ["V/.obsidian/appearance.json", '{"cssTheme":"AnuPpuccin"}'],
      ["V/note.md", "x"],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.settings?.appearance?.cssTheme).toBe("AnuPpuccin");
  });

  it("parses graph.json numeric fields", async () => {
    const fl = makeFileList([
      [
        "V/.obsidian/graph.json",
        JSON.stringify({
          centerStrength: 0.5,
          repelStrength: 10,
          linkStrength: 1,
          linkDistance: 250,
          showTags: false, // non-numeric, should be ignored
        }),
      ],
      ["V/note.md", "x"],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.settings?.graph).toEqual({
      centerStrength: 0.5,
      repelStrength: 10,
      linkStrength: 1,
      linkDistance: 250,
    });
  });

  it("parses app.json editor fields", async () => {
    const fl = makeFileList([
      ["V/.obsidian/app.json", '{"readableLineLength":true,"spellcheck":false}'],
      ["V/note.md", "x"],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.settings?.editor).toEqual({
      readableLineLength: true,
      spellcheck: false,
    });
  });

  it("returns undefined settings when no .obsidian files", async () => {
    const fl = makeFileList([["V/note.md", "x"]]);
    const result = await parseVaultFiles(fl);
    expect(result.settings).toBeUndefined();
  });

  it("skips malformed JSON gracefully", async () => {
    const fl = makeFileList([
      ["V/.obsidian/app.json", "NOT VALID JSON"],
      ["V/.obsidian/appearance.json", "{bad"],
      ["V/.obsidian/graph.json", ""],
      ["V/note.md", "x"],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.settings).toBeUndefined();
  });

  it("ignores non-boolean app.json fields", async () => {
    const fl = makeFileList([
      ["V/.obsidian/app.json", '{"readableLineLength":"yes","spellcheck":42}'],
      ["V/note.md", "x"],
    ]);
    const result = await parseVaultFiles(fl);
    // No valid editor fields → no editor key → no settings
    expect(result.settings?.editor).toBeUndefined();
  });

  it("ignores non-string cssTheme", async () => {
    const fl = makeFileList([
      ["V/.obsidian/appearance.json", '{"cssTheme":123}'],
      ["V/note.md", "x"],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.settings?.appearance).toBeUndefined();
  });
});

// ---------- parseVaultFiles — AI Brain integration test ----------

describe("parseVaultFiles — AI Brain vault structure", () => {
  it("correctly parses a realistic vault structure", async () => {
    const fl = makeFileList([
      ["AI Brain/.obsidian/app.json", '{"alwaysUpdateLinks":true}'],
      ["AI Brain/.obsidian/appearance.json", '{"cssTheme":"AnuPpuccin"}'],
      [
        "AI Brain/.obsidian/graph.json",
        JSON.stringify({
          centerStrength: 0.518713248970312,
          repelStrength: 10,
          linkStrength: 1,
          linkDistance: 250,
        }),
      ],
      ["AI Brain/.obsidian/core-plugins.json", "[]"],
      ["AI Brain/.obsidian/workspace.json", "{}"],
      ["AI Brain/Atomic Habits.md", "# Atomic Habits\nGreat book."],
      ["AI Brain/Books/Index of Books.md", "# Books Index"],
      ["AI Brain/Books/12 Rules for life/README.md", "# 12 Rules"],
      ["AI Brain/Books/12 Rules for life/Rule 1.md", "Rule 1 content"],
      ["AI Brain/Books/12 Rules for life/Rule 2.md", "Rule 2 content"],
      ["AI Brain/Books/Atomic Habits/README.md", "# AH Book Notes"],
      ["AI Brain/Interests/Index of Interests.md", "# Interests"],
      ["AI Brain/Personal Projects/Index of Personal Projects.md", "# PP"],
      ["AI Brain/Work Projects/Index of Work Projects.md", "# WP"],
    ]);

    const result = await parseVaultFiles(fl);

    // Vault name
    expect(result.name).toBe("AI Brain");

    // Stats
    expect(result.stats.mdFiles).toBe(9);
    expect(result.stats.folders).toBe(6); // Books, 12 Rules for life, Atomic Habits, Interests, Personal Projects, Work Projects
    expect(result.stats.skippedFiles).toBe(0);

    // Folder structure
    const folderNames = result.folders.map((f) => f.name);
    expect(folderNames).toContain("Books");
    expect(folderNames).toContain("12 Rules for life");
    expect(folderNames).toContain("Atomic Habits");
    expect(folderNames).toContain("Interests");
    expect(folderNames).toContain("Personal Projects");
    expect(folderNames).toContain("Work Projects");

    // Nested folders have parent references
    const booksFolder = result.folders.find((f) => f.name === "Books");
    const rulesFolder = result.folders.find((f) => f.name === "12 Rules for life");
    const ahFolder = result.folders.find((f) => f.name === "Atomic Habits");
    expect(rulesFolder!.parentTempId).toBe(booksFolder!.tempId);
    expect(ahFolder!.parentTempId).toBe(booksFolder!.tempId);

    // Top-level folders have no parent
    expect(booksFolder!.parentTempId).toBeUndefined();
    const interests = result.folders.find((f) => f.name === "Interests");
    expect(interests!.parentTempId).toBeUndefined();

    // Root note has no folder
    const atomicNote = result.notes.find((n) => n.title === "Atomic Habits");
    expect(atomicNote!.folderTempId).toBeUndefined();
    expect(atomicNote!.content).toBe("# Atomic Habits\nGreat book.");

    // Nested note has correct folder ref
    const rule2 = result.notes.find((n) => n.title === "Rule 2");
    expect(rule2!.folderTempId).toBe(rulesFolder!.tempId);
    expect(rule2!.content).toBe("Rule 2 content");

    // Settings
    expect(result.settings?.appearance?.cssTheme).toBe("AnuPpuccin");
    expect(result.settings?.graph?.centerStrength).toBeCloseTo(0.5187, 3);
    expect(result.settings?.graph?.repelStrength).toBe(10);
    expect(result.settings?.graph?.linkDistance).toBe(250);
    // app.json had no readableLineLength/spellcheck booleans
    expect(result.settings?.editor).toBeUndefined();
  });
});

// ---------- batchNotes ----------

describe("batchNotes", () => {
  it("puts all notes in a single batch when small", () => {
    const notes: ImportedNote[] = [
      { title: "A", content: "small", order: 0 },
      { title: "B", content: "small", order: 1 },
    ];
    const batches = batchNotes(notes, {}, FAKE_VAULT_ID);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

  it("maps folderTempId to real folderId", () => {
    const notes: ImportedNote[] = [
      { title: "A", content: "x", folderTempId: "folder-0", order: 0 },
      { title: "B", content: "y", order: 1 },
    ];
    const folderIdMap = { "folder-0": "folders:real123" };
    const batches = batchNotes(notes, folderIdMap, FAKE_VAULT_ID);
    expect(batches[0]![0]!.folderId).toBe("folders:real123");
    expect(batches[0]![1]!.folderId).toBeUndefined();
  });

  it("splits into multiple batches when content exceeds size limit", () => {
    // Each note is ~100KB of content
    const bigContent = "x".repeat(100_000);
    const notes: ImportedNote[] = Array.from({ length: 20 }, (_, i) => ({
      title: `Note ${i}`,
      content: bigContent,
      order: i,
    }));
    const batches = batchNotes(notes, {}, FAKE_VAULT_ID);
    // 20 notes * ~100KB each = ~2MB total, should need at least 3 batches at 800KB limit
    expect(batches.length).toBeGreaterThanOrEqual(3);
    // All notes should be present across batches
    const totalNotes = batches.reduce((sum, b) => sum + b.length, 0);
    expect(totalNotes).toBe(20);
  });

  it("returns empty array for empty input", () => {
    const batches = batchNotes([], {}, FAKE_VAULT_ID);
    expect(batches).toHaveLength(0);
  });

  it("handles a single very large note in its own batch", () => {
    const hugeContent = "x".repeat(900_000);
    const notes: ImportedNote[] = [
      { title: "Huge", content: hugeContent, order: 0 },
      { title: "Small", content: "tiny", order: 1 },
    ];
    const batches = batchNotes(notes, {}, FAKE_VAULT_ID);
    // The huge note should be in its own batch, the small one separate
    expect(batches).toHaveLength(2);
    expect(batches[0]![0]!.title).toBe("Huge");
    expect(batches[1]![0]!.title).toBe("Small");
  });

  it("sets vaultId on all mapped notes", () => {
    const notes: ImportedNote[] = [
      { title: "A", content: "a", order: 0 },
      { title: "B", content: "b", order: 1 },
    ];
    const batches = batchNotes(notes, {}, FAKE_VAULT_ID);
    for (const batch of batches) {
      for (const note of batch) {
        expect(note.vaultId).toBe(FAKE_VAULT_ID);
      }
    }
  });
});

// ---------- parseVaultFiles — edge cases ----------

describe("parseVaultFiles — edge cases", () => {
  it("handles a vault with only folders and no .md files", async () => {
    // Folders only appear when .md files reference them, so an empty vault = no folders
    const fl = makeFileList([
      ["V/images/photo.png", ""],
      ["V/data.csv", ""],
    ]);
    const result = await parseVaultFiles(fl);
    expect(result.notes).toHaveLength(0);
    expect(result.folders).toHaveLength(0);
    expect(result.stats.skippedFiles).toBe(2);
  });

  it("handles an empty .md file", async () => {
    const fl = makeFileList([["V/empty.md", ""]]);
    const result = await parseVaultFiles(fl);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]!.title).toBe("empty");
    expect(result.notes[0]!.content).toBe("");
  });

  it("handles deeply nested paths", async () => {
    const fl = makeFileList([["V/a/b/c/d/e/note.md", "deep"]]);
    const result = await parseVaultFiles(fl);
    expect(result.folders).toHaveLength(5); // a, b, c, d, e
    expect(result.folders.map((f) => f.name)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
