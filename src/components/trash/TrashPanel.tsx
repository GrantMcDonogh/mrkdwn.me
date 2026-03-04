import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import { useVaultRole } from "../../hooks/useVaultRole";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Trash2,
  FileText,
  Folder,
  RotateCcw,
  XCircle,
} from "lucide-react";

function formatRelativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function TrashPanel() {
  const [state] = useWorkspace();
  const { canEdit, canPermanentDelete } = useVaultRole();
  const vaultId = state.vaultId!;

  const deleted = useQuery(api.trash.listDeleted, { vaultId });
  const restoreNote = useMutation(api.trash.restoreNote);
  const restoreFolder = useMutation(api.trash.restoreFolder);
  const permanentDeleteNote = useMutation(api.trash.permanentDeleteNote);
  const permanentDeleteFolder = useMutation(api.trash.permanentDeleteFolder);
  const emptyTrash = useMutation(api.trash.emptyTrash);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 py-2 border-b border-obsidian-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-obsidian-text-muted">
          Trash
        </span>
        {canPermanentDelete && deleted && deleted.length > 0 && (
          <button
            onClick={() => {
              if (!confirm("Permanently delete all items in trash? This cannot be undone.")) return;
              emptyTrash({ vaultId });
            }}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Empty Trash
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {!deleted || deleted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-obsidian-text-muted">
            <Trash2 size={24} className="opacity-30 mb-2" />
            <p className="text-xs">Trash is empty</p>
          </div>
        ) : (
          deleted.map((item) => (
            <div
              key={item._id}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-obsidian-bg-tertiary group text-sm"
            >
              {item.type === "note" ? (
                <FileText size={14} className="text-obsidian-text-muted shrink-0" />
              ) : (
                <Folder size={14} className="text-obsidian-text-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="truncate block text-obsidian-text">
                  {item.name}
                </span>
                <span className="text-xs text-obsidian-text-muted">
                  {formatRelativeDate(item.deletedAt)}
                </span>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                {canEdit && (
                  <button
                    onClick={() => {
                      if (item.type === "note") {
                        restoreNote({ id: item._id as Id<"notes"> });
                      } else {
                        restoreFolder({ id: item._id as Id<"folders"> });
                      }
                    }}
                    className="p-0.5 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-green-400"
                    title="Restore"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
                {canPermanentDelete && (
                  <button
                    onClick={() => {
                      if (!confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) return;
                      if (item.type === "note") {
                        permanentDeleteNote({ id: item._id as Id<"notes"> });
                      } else {
                        permanentDeleteFolder({ id: item._id as Id<"folders"> });
                      }
                    }}
                    className="p-0.5 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-red-400"
                    title="Delete Forever"
                  >
                    <XCircle size={12} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
