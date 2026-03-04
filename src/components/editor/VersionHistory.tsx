import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getActiveNoteId, useWorkspace } from "../../store/workspace";
import { useVaultRole } from "../../hooks/useVaultRole";
import { History, RotateCcw, Eye, Clock } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TRIGGER_LABELS: Record<string, string> = {
  auto: "Auto-save",
  rename: "Before rename",
  move: "Before move",
  delete: "Before delete",
};

export default function VersionHistory() {
  const [state] = useWorkspace();
  const { canEdit } = useVaultRole();
  const noteId = getActiveNoteId(state);
  const [previewId, setPreviewId] = useState<Id<"noteVersions"> | null>(null);

  const versions = useQuery(
    api.noteVersions.listByNote,
    noteId ? { noteId } : "skip"
  );
  const previewVersion = useQuery(
    api.noteVersions.get,
    previewId ? { id: previewId } : "skip"
  );
  const restoreVersion = useMutation(api.noteVersions.restoreVersion);

  if (!noteId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-obsidian-text-muted">
        <History size={24} className="opacity-30 mb-2" />
        <p className="text-xs">No note selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-obsidian-border">
        <h3 className="text-xs font-semibold uppercase text-obsidian-text-muted">
          Version History
        </h3>
      </div>

      {previewId && previewVersion ? (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-3 py-2 border-b border-obsidian-border flex items-center justify-between">
            <span className="text-xs text-obsidian-text-muted">
              {formatDate(previewVersion.savedAt)} — {TRIGGER_LABELS[previewVersion.trigger] ?? previewVersion.trigger}
            </span>
            <button
              onClick={() => setPreviewId(null)}
              className="text-xs text-obsidian-accent hover:underline"
            >
              Back
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <h4 className="text-sm font-medium text-obsidian-text mb-2">
              {previewVersion.title}
            </h4>
            <pre className="text-xs text-obsidian-text-muted whitespace-pre-wrap font-mono">
              {previewVersion.content}
            </pre>
          </div>
          {canEdit && (
            <div className="px-3 py-2 border-t border-obsidian-border">
              <button
                onClick={async () => {
                  await restoreVersion({
                    noteId,
                    versionId: previewId,
                  });
                  setPreviewId(null);
                }}
                className="flex items-center gap-1.5 text-xs text-obsidian-accent hover:underline"
              >
                <RotateCcw size={12} />
                Restore this version
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          {!versions || versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-obsidian-text-muted">
              <Clock size={24} className="opacity-30 mb-2" />
              <p className="text-xs">No versions yet</p>
              <p className="text-xs mt-1 opacity-60">
                Versions are created automatically as you edit
              </p>
            </div>
          ) : (
            versions.map((version) => (
              <button
                key={version._id}
                onClick={() => setPreviewId(version._id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-obsidian-bg-tertiary text-left group"
              >
                <Eye
                  size={14}
                  className="text-obsidian-text-muted shrink-0 opacity-0 group-hover:opacity-100"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-obsidian-text truncate">
                    {version.title}
                  </div>
                  <div className="text-xs text-obsidian-text-muted">
                    {formatDate(version.savedAt)} · {TRIGGER_LABELS[version.trigger] ?? version.trigger}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
