import { useState, type KeyboardEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Plus,
  FolderPlus,
  Trash2,
} from "lucide-react";
import type { Id, Doc } from "../../../convex/_generated/dataModel";

export default function FileExplorer() {
  const [state, dispatch] = useWorkspace();
  const vaultId = state.vaultId!;
  const folders = useQuery(api.folders.list, { vaultId });
  const notes = useQuery(api.notes.list, { vaultId });
  const createFolder = useMutation(api.folders.create);
  const createNote = useMutation(api.notes.create);
  const renameFolder = useMutation(api.folders.rename);
  const renameNote = useMutation(api.notes.rename);
  const removeFolder = useMutation(api.folders.remove);
  const removeNote = useMutation(api.notes.remove);
  const moveFolder = useMutation(api.folders.move);
  const moveNote = useMutation(api.notes.move);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [creatingIn, setCreatingIn] = useState<{
    parentId: Id<"folders"> | undefined;
    type: "folder" | "note";
  } | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Get active note id from active pane's active tab
  const activePane = state.panes.find((p) => p.id === state.activePaneId);
  const activeTab = activePane?.tabs.find(
    (t) => t.id === activePane.activeTabId
  );
  const activeNoteId = activeTab?.noteId;

  function toggleFolder(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateFolder(parentId: Id<"folders"> | undefined) {
    setCreatingIn({ parentId, type: "folder" });
    setNewItemName("New Folder");
    if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
  }

  async function handleCreateNote(folderId: Id<"folders"> | undefined) {
    setCreatingIn({ parentId: folderId, type: "note" });
    setNewItemName("Untitled");
    if (folderId) setExpanded((prev) => new Set(prev).add(folderId));
  }

  async function submitCreate() {
    if (!creatingIn || !newItemName.trim()) {
      setCreatingIn(null);
      return;
    }
    if (creatingIn.type === "folder") {
      await createFolder({
        name: newItemName.trim(),
        vaultId,
        parentId: creatingIn.parentId,
      });
    } else {
      const noteId = await createNote({
        title: newItemName.trim(),
        vaultId,
        folderId: creatingIn.parentId,
      });
      dispatch({ type: "OPEN_NOTE", noteId });
    }
    setCreatingIn(null);
    setNewItemName("");
  }

  function startRename(id: string, name: string) {
    setEditingId(id);
    setEditingName(name);
  }

  async function submitRename(
    id: string,
    type: "folder" | "note"
  ) {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    if (type === "folder") {
      await renameFolder({ id: id as Id<"folders">, name: editingName.trim() });
    } else {
      await renameNote({ id: id as Id<"notes">, title: editingName.trim() });
    }
    setEditingId(null);
  }

  function handleDragStart(
    e: React.DragEvent,
    id: string,
    type: "folder" | "note"
  ) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id, type }));
  }

  function handleDragOver(e: React.DragEvent, folderId: string) {
    e.preventDefault();
    setDragOverId(folderId);
  }

  function handleDragLeave() {
    setDragOverId(null);
  }

  async function handleDrop(
    e: React.DragEvent,
    targetFolderId: Id<"folders"> | undefined
  ) {
    e.preventDefault();
    setDragOverId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (data.type === "folder") {
        await moveFolder({
          id: data.id as Id<"folders">,
          parentId: targetFolderId,
        });
      } else {
        await moveNote({
          id: data.id as Id<"notes">,
          folderId: targetFolderId,
        });
      }
    } catch {
      // ignore invalid drag data
    }
  }

  function renderTree(
    parentId: Id<"folders"> | undefined,
    depth: number
  ) {
    if (!folders || !notes) return null;

    const childFolders = folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.order - b.order);
    const childNotes = notes
      .filter((n) => n.folderId === parentId)
      .sort((a, b) => a.order - b.order);

    return (
      <>
        {childFolders.map((folder) => (
          <div key={folder._id}>
            <div
              className={`flex items-center gap-1 px-2 py-1 hover:bg-obsidian-bg-tertiary cursor-pointer group text-sm ${
                dragOverId === folder._id
                  ? "bg-obsidian-bg-tertiary"
                  : ""
              }`}
              style={{ paddingLeft: `${depth * 16}px` }}
              onClick={() => toggleFolder(folder._id)}
              draggable
              onDragStart={(e) =>
                handleDragStart(e, folder._id, "folder")
              }
              onDragOver={(e) => handleDragOver(e, folder._id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder._id)}
            >
              {expanded.has(folder._id) ? (
                <ChevronDown size={14} className="text-obsidian-text-muted shrink-0" />
              ) : (
                <ChevronRight size={14} className="text-obsidian-text-muted shrink-0" />
              )}
              {expanded.has(folder._id) ? (
                <FolderOpen size={14} className="text-obsidian-text-muted shrink-0" />
              ) : (
                <Folder size={14} className="text-obsidian-text-muted shrink-0" />
              )}
              {editingId === folder._id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => submitRename(folder._id, "folder")}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === "Enter")
                      submitRename(folder._id, "folder");
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-obsidian-bg border border-obsidian-accent rounded px-1 text-sm text-obsidian-text w-full focus:outline-none"
                />
              ) : (
                <span
                  className="truncate text-obsidian-text"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(folder._id, folder.name);
                  }}
                >
                  {folder.name}
                </span>
              )}
              <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateNote(folder._id);
                  }}
                  className="p-0.5 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateFolder(folder._id);
                  }}
                  className="p-0.5 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
                >
                  <FolderPlus size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFolder({ id: folder._id });
                  }}
                  className="p-0.5 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            {expanded.has(folder._id) &&
              renderTree(folder._id, depth + 1)}
          </div>
        ))}

        {/* Inline create form */}
        {creatingIn?.parentId === parentId && (
          <div
            className="flex items-center gap-1 px-2 py-1"
            style={{ paddingLeft: `${(depth + (parentId ? 0 : 0)) * 16}px` }}
          >
            {creatingIn.type === "folder" ? (
              <Folder size={14} className="text-obsidian-text-muted shrink-0" />
            ) : (
              <FileText size={14} className="text-obsidian-text-muted shrink-0" />
            )}
            <input
              autoFocus
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onBlur={submitCreate}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter") submitCreate();
                if (e.key === "Escape") setCreatingIn(null);
              }}
              className="bg-obsidian-bg border border-obsidian-accent rounded px-1 text-sm text-obsidian-text w-full focus:outline-none"
            />
          </div>
        )}

        {childNotes.map((note) => (
          <div
            key={note._id}
            className={`flex items-center gap-1 px-2 py-1 hover:bg-obsidian-bg-tertiary cursor-pointer group text-sm ${
              activeNoteId === note._id ? "bg-obsidian-bg-tertiary" : ""
            }`}
            style={{ paddingLeft: `${depth * 16}px` }}
            onClick={() =>
              dispatch({ type: "OPEN_NOTE", noteId: note._id })
            }
            draggable
            onDragStart={(e) =>
              handleDragStart(e, note._id, "note")
            }
          >
            <FileText size={14} className="text-obsidian-text-muted shrink-0" />
            {editingId === note._id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => submitRename(note._id, "note")}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === "Enter")
                    submitRename(note._id, "note");
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-obsidian-bg border border-obsidian-accent rounded px-1 text-sm text-obsidian-text w-full focus:outline-none"
              />
            ) : (
              <span
                className="truncate text-obsidian-text"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(note._id, note.title);
                }}
              >
                {note.title}
              </span>
            )}
            <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeNote({ id: note._id });
                }}
                className="p-0.5 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-obsidian-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-obsidian-text-muted">
          Explorer
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => handleCreateNote(undefined)}
            className="p-1 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
            title="New Note"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => handleCreateFolder(undefined)}
            className="p-1 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
            title="New Folder"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>
      <div
        className="flex-1 overflow-y-auto py-1"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverId("root");
        }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(e) => handleDrop(e, undefined)}
      >
        {folders && notes && folders.length === 0 && notes.length === 0 ? (
          <p className="text-center py-8 text-obsidian-text-muted text-xs">
            No files yet
          </p>
        ) : (
          renderTree(undefined, 1)
        )}
      </div>
    </div>
  );
}
