import { describe, it, expect } from "vitest";
import {
  sanitizeName,
  buildFolderPaths,
  buildVaultZip,
  type Folder,
  type Note,
} from "./downloadVault";

// ─── sanitizeName ───────────────────────────────────────────────

describe("sanitizeName", () => {
  it("returns the name unchanged when it has no invalid characters", () => {
    expect(sanitizeName("My Notes")).toBe("My Notes");
  });

  it("replaces forward slash with underscore", () => {
    expect(sanitizeName("A/B")).toBe("A_B");
  });

  it("replaces backslash with underscore", () => {
    expect(sanitizeName("A\\B")).toBe("A_B");
  });

  it("replaces colon with underscore", () => {
    expect(sanitizeName("Time: 3pm")).toBe("Time_ 3pm");
  });

  it("replaces asterisk with underscore", () => {
    expect(sanitizeName("star*file")).toBe("star_file");
  });

  it("replaces question mark with underscore", () => {
    expect(sanitizeName("what?")).toBe("what_");
  });

  it("replaces double quotes with underscore", () => {
    expect(sanitizeName('"quoted"')).toBe("_quoted_");
  });

  it("replaces angle brackets with underscore", () => {
    expect(sanitizeName("<tag>")).toBe("_tag_");
  });

  it("replaces pipe with underscore", () => {
    expect(sanitizeName("a|b")).toBe("a_b");
  });

  it("replaces multiple invalid characters at once", () => {
    expect(sanitizeName('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j");
  });

  it("returns 'Untitled' for empty string", () => {
    expect(sanitizeName("")).toBe("Untitled");
  });

  it("returns 'Untitled' for whitespace-only string", () => {
    expect(sanitizeName("   ")).toBe("Untitled");
  });

  it("replaces all invalid characters, leaving underscores", () => {
    expect(sanitizeName("/:*?")).toBe("____");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeName("  hello  ")).toBe("hello");
  });
});

// ─── buildFolderPaths ───────────────────────────────────────────

describe("buildFolderPaths", () => {
  it("returns empty map for no folders", () => {
    const result = buildFolderPaths([]);
    expect(result.size).toBe(0);
  });

  it("builds a single root folder path", () => {
    const folders: Folder[] = [{ _id: "f1", name: "Projects" }];
    const result = buildFolderPaths(folders);
    expect(result.get("f1")).toBe("Projects");
  });

  it("builds nested folder paths", () => {
    const folders: Folder[] = [
      { _id: "f1", name: "Projects" },
      { _id: "f2", name: "Web", parentId: "f1" },
      { _id: "f3", name: "Frontend", parentId: "f2" },
    ];
    const result = buildFolderPaths(folders);
    expect(result.get("f1")).toBe("Projects");
    expect(result.get("f2")).toBe("Projects/Web");
    expect(result.get("f3")).toBe("Projects/Web/Frontend");
  });

  it("handles folders provided in non-topological order", () => {
    const folders: Folder[] = [
      { _id: "f3", name: "Deep", parentId: "f2" },
      { _id: "f1", name: "Root" },
      { _id: "f2", name: "Mid", parentId: "f1" },
    ];
    const result = buildFolderPaths(folders);
    expect(result.get("f3")).toBe("Root/Mid/Deep");
  });

  it("handles multiple root folders", () => {
    const folders: Folder[] = [
      { _id: "f1", name: "Alpha" },
      { _id: "f2", name: "Beta" },
    ];
    const result = buildFolderPaths(folders);
    expect(result.get("f1")).toBe("Alpha");
    expect(result.get("f2")).toBe("Beta");
  });

  it("sanitizes folder names with invalid characters", () => {
    const folders: Folder[] = [
      { _id: "f1", name: "Project: Main" },
      { _id: "f2", name: "Sub/Folder", parentId: "f1" },
    ];
    const result = buildFolderPaths(folders);
    expect(result.get("f1")).toBe("Project_ Main");
    expect(result.get("f2")).toBe("Project_ Main/Sub_Folder");
  });

  it("returns empty string for orphaned parentId", () => {
    const folders: Folder[] = [
      { _id: "f1", name: "Child", parentId: "missing" },
    ];
    const result = buildFolderPaths(folders);
    // The parent lookup returns "" since "missing" isn't in the map,
    // so the child resolves to just its own name
    expect(result.get("f1")).toBe("Child");
  });

  it("handles circular parent references without stack overflow", () => {
    const folders: Folder[] = [
      { _id: "f1", name: "A", parentId: "f2" },
      { _id: "f2", name: "B", parentId: "f1" },
    ];
    const result = buildFolderPaths(folders);
    // Should not throw — cycle is broken gracefully
    expect(result.has("f1")).toBe(true);
    expect(result.has("f2")).toBe(true);
  });

  it("handles self-referencing folder without stack overflow", () => {
    const folders: Folder[] = [
      { _id: "f1", name: "Self", parentId: "f1" },
    ];
    const result = buildFolderPaths(folders);
    expect(result.get("f1")).toBe("Self");
  });
});

// ─── buildVaultZip — file structure ─────────────────────────────

async function getZipEntries(folders: Folder[], notes: Note[]) {
  const zip = await buildVaultZip(folders, notes);
  const entries: Record<string, string> = {};
  for (const [path, file] of Object.entries(zip.files)) {
    if (!file.dir) {
      entries[path] = await file.async("string");
    }
  }
  return { zip, entries };
}

async function getZipDirs(folders: Folder[], notes: Note[]) {
  const zip = await buildVaultZip(folders, notes);
  return Object.entries(zip.files)
    .filter(([, f]) => f.dir)
    .map(([p]) => p);
}

describe("buildVaultZip — root notes", () => {
  it("places notes without folderId at the zip root", async () => {
    const notes: Note[] = [
      { title: "Hello", content: "world", folderId: undefined },
    ];
    const { entries } = await getZipEntries([], notes);
    expect(entries["Hello.md"]).toBe("world");
  });

  it("handles multiple root notes", async () => {
    const notes: Note[] = [
      { title: "A", content: "a content" },
      { title: "B", content: "b content" },
    ];
    const { entries } = await getZipEntries([], notes);
    expect(entries["A.md"]).toBe("a content");
    expect(entries["B.md"]).toBe("b content");
  });
});

describe("buildVaultZip — notes in folders", () => {
  it("nests note inside its folder path", async () => {
    const folders: Folder[] = [{ _id: "f1", name: "Projects" }];
    const notes: Note[] = [
      { title: "TODO", content: "stuff", folderId: "f1" },
    ];
    const { entries } = await getZipEntries(folders, notes);
    expect(entries["Projects/TODO.md"]).toBe("stuff");
  });

  it("nests note inside deeply nested folder", async () => {
    const folders: Folder[] = [
      { _id: "f1", name: "A" },
      { _id: "f2", name: "B", parentId: "f1" },
      { _id: "f3", name: "C", parentId: "f2" },
    ];
    const notes: Note[] = [
      { title: "Deep Note", content: "deep", folderId: "f3" },
    ];
    const { entries } = await getZipEntries(folders, notes);
    expect(entries["A/B/C/Deep Note.md"]).toBe("deep");
  });

  it("places note at root when folderId is not found", async () => {
    const notes: Note[] = [
      { title: "Orphan", content: "lost", folderId: "nonexistent" },
    ];
    const { entries } = await getZipEntries([], notes);
    expect(entries["Orphan.md"]).toBe("lost");
  });
});

describe("buildVaultZip — empty folders", () => {
  it("creates directory entries for folders with no notes", async () => {
    const folders: Folder[] = [
      { _id: "f1", name: "EmptyDir" },
      { _id: "f2", name: "SubEmpty", parentId: "f1" },
    ];
    const dirs = await getZipDirs(folders, []);
    expect(dirs).toContain("EmptyDir/");
    expect(dirs).toContain("EmptyDir/SubEmpty/");
  });
});

describe("buildVaultZip — duplicate titles", () => {
  it("appends (2) to duplicate note title in same folder", async () => {
    const notes: Note[] = [
      { title: "Note", content: "first" },
      { title: "Note", content: "second" },
    ];
    const { entries } = await getZipEntries([], notes);
    expect(entries["Note.md"]).toBe("first");
    expect(entries["Note (2).md"]).toBe("second");
  });

  it("appends (3) for a third duplicate", async () => {
    const notes: Note[] = [
      { title: "X", content: "1" },
      { title: "X", content: "2" },
      { title: "X", content: "3" },
    ];
    const { entries } = await getZipEntries([], notes);
    expect(entries["X.md"]).toBe("1");
    expect(entries["X (2).md"]).toBe("2");
    expect(entries["X (3).md"]).toBe("3");
  });

  it("handles case-insensitive duplicate detection", async () => {
    const notes: Note[] = [
      { title: "readme", content: "lower" },
      { title: "README", content: "upper" },
    ];
    const { entries } = await getZipEntries([], notes);
    expect(entries["readme.md"]).toBe("lower");
    expect(entries["README (2).md"]).toBe("upper");
  });

  it("allows same title in different folders", async () => {
    const folders: Folder[] = [
      { _id: "f1", name: "A" },
      { _id: "f2", name: "B" },
    ];
    const notes: Note[] = [
      { title: "Note", content: "in A", folderId: "f1" },
      { title: "Note", content: "in B", folderId: "f2" },
    ];
    const { entries } = await getZipEntries(folders, notes);
    expect(entries["A/Note.md"]).toBe("in A");
    expect(entries["B/Note.md"]).toBe("in B");
  });
});

describe("buildVaultZip — sanitization", () => {
  it("sanitizes note titles with invalid characters", async () => {
    const notes: Note[] = [
      { title: "What?", content: "q" },
    ];
    const { entries } = await getZipEntries([], notes);
    expect(entries["What_.md"]).toBe("q");
  });

  it("uses 'Untitled' for empty note title", async () => {
    const notes: Note[] = [{ title: "", content: "empty title" }];
    const { entries } = await getZipEntries([], notes);
    expect(entries["Untitled.md"]).toBe("empty title");
  });

  it("handles note with null-ish content gracefully", async () => {
    const notes: Note[] = [
      { title: "Empty", content: undefined as unknown as string },
    ];
    const { entries } = await getZipEntries([], notes);
    expect(entries["Empty.md"]).toBe("");
  });
});

describe("buildVaultZip — empty inputs", () => {
  it("returns a valid zip with no folders and no notes", async () => {
    const zip = await buildVaultZip([], []);
    const blob = await zip.generateAsync({ type: "blob" });
    expect(blob.size).toBeGreaterThan(0);
    expect(Object.keys(zip.files).length).toBe(0);
  });
});

describe("buildVaultZip — mixed realistic vault", () => {
  it("correctly structures a vault with root notes, nested folders, and empty folders", async () => {
    const folders: Folder[] = [
      { _id: "f1", name: "Projects" },
      { _id: "f2", name: "Web", parentId: "f1" },
      { _id: "f3", name: "Archive" },
      { _id: "f4", name: "Empty Folder" },
    ];
    const notes: Note[] = [
      { title: "README", content: "# Welcome" },
      { title: "TODO", content: "- item 1", folderId: "f1" },
      { title: "Frontend", content: "React stuff", folderId: "f2" },
      { title: "Backend", content: "API stuff", folderId: "f2" },
      { title: "Old Notes", content: "archived", folderId: "f3" },
    ];

    const { zip, entries } = await getZipEntries(folders, notes);
    const dirs = Object.entries(zip.files)
      .filter(([, f]) => f.dir)
      .map(([p]) => p);

    // Root note
    expect(entries["README.md"]).toBe("# Welcome");

    // Nested notes
    expect(entries["Projects/TODO.md"]).toBe("- item 1");
    expect(entries["Projects/Web/Frontend.md"]).toBe("React stuff");
    expect(entries["Projects/Web/Backend.md"]).toBe("API stuff");
    expect(entries["Archive/Old Notes.md"]).toBe("archived");

    // Empty folder preserved
    expect(dirs).toContain("Empty Folder/");

    // Total: 5 files, 4 folders
    const fileCount = Object.values(zip.files).filter((f) => !f.dir).length;
    expect(fileCount).toBe(5);
  });
});
