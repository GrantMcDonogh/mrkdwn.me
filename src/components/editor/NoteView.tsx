import { useCallback } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useWorkspace } from "../../store/workspace";
import { useVaultRole } from "../../hooks/useVaultRole";
import MarkdownEditor from "./MarkdownEditor";
import MarkdownPreview from "./MarkdownPreview";

interface Props {
  noteId: Id<"notes">;
  paneId: string;
  tabId: string;
  mode: "preview" | "edit";
}

export default function NoteView({ noteId, paneId, tabId, mode }: Props) {
  const [, dispatch] = useWorkspace();
  const { canEditNotes } = useVaultRole();

  // Force preview mode for viewers
  const effectiveMode = canEditNotes ? mode : "preview";

  const switchToEdit = useCallback(() => {
    if (!canEditNotes) return;
    if (mode !== "edit") {
      dispatch({ type: "TOGGLE_TAB_MODE", paneId, tabId });
    }
  }, [mode, dispatch, paneId, tabId, canEditNotes]);

  if (effectiveMode === "edit") {
    return <MarkdownEditor noteId={noteId} />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {!canEditNotes && (
        <div className="px-3 py-1 bg-obsidian-bg-tertiary border-b border-obsidian-border">
          <span className="text-xs text-obsidian-text-muted">Read-only</span>
        </div>
      )}
      <MarkdownPreview noteId={noteId} onSwitchToEdit={switchToEdit} />
    </div>
  );
}
