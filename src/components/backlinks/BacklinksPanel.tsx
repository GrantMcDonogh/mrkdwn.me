import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import { FileText, Link2 } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

export default function BacklinksPanel() {
  const [state, dispatch] = useWorkspace();

  // Get active note
  const activePane = state.panes.find((p) => p.id === state.activePaneId);
  const activeTab = activePane?.tabs.find(
    (t) => t.id === activePane.activeTabId
  );
  const noteId = activeTab?.noteId;

  const backlinks = useQuery(
    api.notes.getBacklinks,
    noteId ? { noteId } : "skip"
  );
  const unlinked = useQuery(
    api.notes.getUnlinkedMentions,
    noteId ? { noteId } : "skip"
  );

  function openNote(id: Id<"notes">) {
    dispatch({ type: "OPEN_NOTE", noteId: id });
  }

  if (!noteId) {
    return (
      <div className="p-3">
        <p className="text-center py-8 text-obsidian-text-muted text-xs">
          Open a note to see backlinks
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-obsidian-border">
        <span className="text-xs font-semibold uppercase text-obsidian-text-muted">
          Backlinks
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Backlinks section */}
        <div>
          <h3 className="text-xs font-semibold text-obsidian-text-muted mb-2 flex items-center gap-1">
            <Link2 size={12} />
            Backlinks ({backlinks?.length ?? 0})
          </h3>
          {backlinks?.length === 0 && (
            <p className="text-xs text-obsidian-text-muted">No backlinks</p>
          )}
          {backlinks?.map((bl) => (
            <button
              key={bl.noteId}
              onClick={() => openNote(bl.noteId)}
              className="w-full text-left p-2 rounded bg-obsidian-bg hover:bg-obsidian-bg-tertiary transition-colors mb-1"
            >
              <div className="flex items-center gap-1.5 text-sm text-obsidian-text">
                <FileText size={12} />
                {bl.noteTitle}
              </div>
              {bl.context && (
                <p className="text-xs text-obsidian-text-muted line-clamp-2 mt-1 italic">
                  {bl.context}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Unlinked mentions section */}
        <div>
          <h3 className="text-xs font-semibold text-obsidian-text-muted mb-2">
            Unlinked Mentions ({unlinked?.length ?? 0})
          </h3>
          {unlinked?.length === 0 && (
            <p className="text-xs text-obsidian-text-muted">
              No unlinked mentions
            </p>
          )}
          {unlinked?.map((m) => (
            <button
              key={m.noteId}
              onClick={() => openNote(m.noteId)}
              className="w-full text-left p-2 rounded bg-obsidian-bg hover:bg-obsidian-bg-tertiary transition-colors mb-1"
            >
              <div className="flex items-center gap-1.5 text-sm text-obsidian-text">
                <FileText size={12} />
                {m.noteTitle}
              </div>
              {m.context && (
                <p className="text-xs text-obsidian-text-muted line-clamp-2 mt-1">
                  {m.context}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
