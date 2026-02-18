import type { Id } from "../../convex/_generated/dataModel";

export interface VaultSettings {
  editor?: { readableLineLength?: boolean; spellcheck?: boolean };
  appearance?: { cssTheme?: string };
  graph?: {
    centerStrength?: number;
    repelStrength?: number;
    linkStrength?: number;
    linkDistance?: number;
  };
}

export interface ImportedFolder {
  tempId: string;
  name: string;
  parentTempId?: string;
  order: number;
}

export interface ImportedNote {
  title: string;
  content: string;
  folderTempId?: string;
  order: number;
}

export interface ParsedVault {
  name: string;
  folders: ImportedFolder[];
  notes: ImportedNote[];
  settings?: VaultSettings;
  stats: {
    totalFiles: number;
    mdFiles: number;
    skippedFiles: number;
    folders: number;
  };
}

export async function parseVaultFiles(files: FileList): Promise<ParsedVault> {
  const fileArray = Array.from(files);

  // Extract vault name from first path segment
  const firstPath = fileArray[0]?.webkitRelativePath ?? "";
  const vaultName = firstPath.split("/")[0] ?? "Imported Vault";

  const mdFiles: File[] = [];
  const obsidianFiles: Map<string, File> = new Map();
  let skippedFiles = 0;

  for (const file of fileArray) {
    const relPath = file.webkitRelativePath;
    const pathAfterRoot = relPath.substring(vaultName.length + 1);

    if (pathAfterRoot.startsWith(".obsidian/")) {
      const obsidianKey = pathAfterRoot.substring(".obsidian/".length);
      obsidianFiles.set(obsidianKey, file);
    } else if (relPath.endsWith(".md")) {
      mdFiles.push(file);
    } else {
      skippedFiles++;
    }
  }

  // Build folder tree from md file paths
  const folderPaths = new Set<string>();
  for (const file of mdFiles) {
    const relPath = file.webkitRelativePath;
    const pathAfterRoot = relPath.substring(vaultName.length + 1);
    const parts = pathAfterRoot.split("/");
    // Collect all directory segments (exclude filename)
    for (let i = 1; i < parts.length; i++) {
      folderPaths.add(parts.slice(0, i).join("/"));
    }
  }

  // Topologically sort folders (parents before children) and assign tempIds
  const sortedPaths = Array.from(folderPaths).sort(
    (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)
  );

  const pathToTempId = new Map<string, string>();
  const folders: ImportedFolder[] = [];

  for (let i = 0; i < sortedPaths.length; i++) {
    const folderPath = sortedPaths[i]!;
    const parts = folderPath.split("/");
    const name = parts[parts.length - 1]!;
    const parentPath = parts.slice(0, -1).join("/");
    const tempId = `folder-${i}`;
    pathToTempId.set(folderPath, tempId);

    folders.push({
      tempId,
      name,
      parentTempId: parentPath ? pathToTempId.get(parentPath) : undefined,
      order: i,
    });
  }

  // Read note contents
  const notes: ImportedNote[] = [];
  const folderNoteCount = new Map<string, number>();

  for (const file of mdFiles) {
    const relPath = file.webkitRelativePath;
    const pathAfterRoot = relPath.substring(vaultName.length + 1);
    const parts = pathAfterRoot.split("/");
    const filename = parts[parts.length - 1]!;
    const title = filename.replace(/\.md$/, "");
    const folderPath = parts.slice(0, -1).join("/");
    const folderTempId = folderPath ? pathToTempId.get(folderPath) : undefined;

    const orderKey = folderTempId ?? "__root__";
    const order = folderNoteCount.get(orderKey) ?? 0;
    folderNoteCount.set(orderKey, order + 1);

    const content = await file.text();
    notes.push({ title, content, folderTempId, order });
  }

  // Parse .obsidian settings
  const settings = await parseObsidianSettings(obsidianFiles);

  return {
    name: vaultName,
    folders,
    notes,
    settings: Object.keys(settings).length > 0 ? settings : undefined,
    stats: {
      totalFiles: fileArray.length,
      mdFiles: mdFiles.length,
      skippedFiles,
      folders: folders.length,
    },
  };
}

async function parseObsidianSettings(
  files: Map<string, File>
): Promise<VaultSettings> {
  const settings: VaultSettings = {};

  const appFile = files.get("app.json");
  if (appFile) {
    try {
      const data = JSON.parse(await appFile.text());
      const editor: VaultSettings["editor"] = {};
      if (typeof data.readableLineLength === "boolean")
        editor.readableLineLength = data.readableLineLength;
      if (typeof data.spellcheck === "boolean")
        editor.spellcheck = data.spellcheck;
      if (Object.keys(editor).length > 0) settings.editor = editor;
    } catch {
      // skip malformed app.json
    }
  }

  const appearanceFile = files.get("appearance.json");
  if (appearanceFile) {
    try {
      const data = JSON.parse(await appearanceFile.text());
      if (typeof data.cssTheme === "string") {
        settings.appearance = { cssTheme: data.cssTheme };
      }
    } catch {
      // skip malformed appearance.json
    }
  }

  const graphFile = files.get("graph.json");
  if (graphFile) {
    try {
      const data = JSON.parse(await graphFile.text());
      const graph: VaultSettings["graph"] = {};
      for (const key of [
        "centerStrength",
        "repelStrength",
        "linkStrength",
        "linkDistance",
      ] as const) {
        if (typeof data[key] === "number") graph[key] = data[key];
      }
      if (Object.keys(graph).length > 0) settings.graph = graph;
    } catch {
      // skip malformed graph.json
    }
  }

  return settings;
}

const MAX_BATCH_BYTES = 800_000;

export function batchNotes(
  notes: ImportedNote[],
  folderIdMap: Record<string, string>,
  vaultId: Id<"vaults">
) {
  const batches: Array<
    Array<{
      title: string;
      content: string;
      vaultId: Id<"vaults">;
      folderId?: Id<"folders">;
      order: number;
    }>
  > = [];

  let currentBatch: typeof batches[number] = [];
  let currentSize = 0;

  for (const note of notes) {
    const mapped = {
      title: note.title,
      content: note.content,
      vaultId,
      folderId: note.folderTempId
        ? (folderIdMap[note.folderTempId] as Id<"folders"> | undefined)
        : undefined,
      order: note.order,
    };

    const noteSize = JSON.stringify(mapped).length;

    if (currentBatch.length > 0 && currentSize + noteSize > MAX_BATCH_BYTES) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push(mapped);
    currentSize += noteSize;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}
