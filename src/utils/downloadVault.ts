import JSZip from "jszip";

interface Folder {
  _id: string;
  name: string;
  parentId?: string;
}

interface Note {
  title: string;
  content: string;
  folderId?: string;
}

function sanitizeName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "Untitled";
}

function buildFolderPaths(folders: Folder[]): Map<string, string> {
  const map = new Map<string, Folder>();
  for (const f of folders) map.set(f._id, f);

  const pathCache = new Map<string, string>();

  function resolve(id: string): string {
    if (pathCache.has(id)) return pathCache.get(id)!;
    const folder = map.get(id);
    if (!folder) return "";
    const parentPath = folder.parentId ? resolve(folder.parentId) : "";
    const path = parentPath
      ? `${parentPath}/${sanitizeName(folder.name)}`
      : sanitizeName(folder.name);
    pathCache.set(id, path);
    return path;
  }

  for (const f of folders) resolve(f._id);
  return pathCache;
}

export async function downloadVaultAsZip(
  folders: Folder[],
  notes: Note[],
  vaultName: string,
) {
  const zip = new JSZip();
  const folderPaths = buildFolderPaths(folders);

  // Create empty folders so structure is preserved
  for (const path of folderPaths.values()) {
    zip.folder(path);
  }

  // Track used filenames per directory to handle duplicates
  const usedNames = new Map<string, Set<string>>();

  for (const note of notes) {
    const dir = note.folderId ? (folderPaths.get(note.folderId) ?? "") : "";
    if (!usedNames.has(dir)) usedNames.set(dir, new Set());
    const dirNames = usedNames.get(dir)!;

    let baseName = sanitizeName(note.title || "Untitled");
    let fileName = `${baseName}.md`;
    let counter = 2;
    while (dirNames.has(fileName.toLowerCase())) {
      fileName = `${baseName} (${counter}).md`;
      counter++;
    }
    dirNames.add(fileName.toLowerCase());

    const filePath = dir ? `${dir}/${fileName}` : fileName;
    zip.file(filePath, note.content ?? "");
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeName(vaultName)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
