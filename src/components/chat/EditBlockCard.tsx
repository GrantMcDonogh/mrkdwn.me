import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import type { EditBlock } from "../../lib/parseEditBlocks";
import type { Id } from "../../../convex/_generated/dataModel";
import DiffView from "./DiffView";
import { Pencil, FilePlus, Check, X, AlertTriangle } from "lucide-react";

interface Props {
  block: EditBlock;
  vaultId: Id<"vaults">;
  onStatusChange: (status: "applied" | "dismissed") => void;
}

export default function EditBlockCard({ block, vaultId, onStatusChange }: Props) {
  const [, dispatch] = useWorkspace();
  const notes = useQuery(api.notes.list, { vaultId });
  const updateNote = useMutation(api.notes.update);
  const createNote = useMutation(api.notes.create);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const matchedNote = notes?.find(
    (n) => n.title.toLowerCase() === block.noteTitle.toLowerCase()
  );
  const noteNotFound = block.type === "edit" && notes && !matchedNote;

  async function handleApply() {
    setApplying(true);
    setError(null);
    try {
      if (block.type === "edit") {
        if (!matchedNote) {
          setError("Note not found in vault");
          setApplying(false);
          return;
        }
        await updateNote({ id: matchedNote._id, content: block.content });
      } else {
        const newId = await createNote({ title: block.noteTitle, vaultId });
        await updateNote({ id: newId, content: block.content });
        dispatch({ type: "OPEN_NOTE", noteId: newId });
      }
      onStatusChange("applied");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplying(false);
    }
  }

  function handleDismiss() {
    onStatusChange("dismissed");
  }

  const isResolved = block.status === "applied" || block.status === "dismissed";

  return (
    <div className="mt-2 rounded border border-obsidian-border bg-obsidian-bg-secondary overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-obsidian-bg-tertiary border-b border-obsidian-border">
        {block.type === "edit" ? (
          <Pencil size={12} className="text-obsidian-accent" />
        ) : (
          <FilePlus size={12} className="text-green-400" />
        )}
        <span className="text-xs font-medium text-obsidian-text truncate">
          {block.type === "edit" ? "Edit" : "Create"}: {block.noteTitle}
        </span>
        {block.status === "applied" && (
          <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
            <Check size={10} /> Applied
          </span>
        )}
        {block.status === "dismissed" && (
          <span className="ml-auto text-xs text-obsidian-text-muted flex items-center gap-1">
            <X size={10} /> Dismissed
          </span>
        )}
      </div>

      {/* Diff */}
      <div className="p-2">
        <DiffView
          original={block.type === "edit" ? (matchedNote?.content ?? "") : ""}
          proposed={block.content}
        />
      </div>

      {/* Error */}
      {(error || noteNotFound) && (
        <div className="px-3 py-1.5 flex items-center gap-1 text-xs text-red-400">
          <AlertTriangle size={10} />
          {error || "Note not found in vault"}
        </div>
      )}

      {/* Actions */}
      {!isResolved && (
        <div className="flex gap-2 px-3 py-2 border-t border-obsidian-border">
          <button
            onClick={handleApply}
            disabled={applying || !!noteNotFound}
            className="px-3 py-1 text-xs rounded bg-obsidian-accent hover:bg-obsidian-accent-hover text-white disabled:opacity-50 transition-colors"
          >
            {applying ? "Applying..." : "Apply Changes"}
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1 text-xs rounded bg-obsidian-bg-tertiary hover:bg-obsidian-border text-obsidian-text-muted hover:text-obsidian-text transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
