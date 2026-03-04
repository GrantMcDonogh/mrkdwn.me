import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  FileText,
  Folder,
  Plus,
  Pencil,
  ArrowRight,
  Trash2,
  RotateCcw,
  XCircle,
  X,
  Filter,
} from "lucide-react";

const ACTION_CONFIG: Record<string, { icon: typeof Plus; label: string; color: string }> = {
  create: { icon: Plus, label: "Created", color: "text-green-400" },
  update: { icon: Pencil, label: "Updated", color: "text-blue-400" },
  rename: { icon: Pencil, label: "Renamed", color: "text-yellow-400" },
  move: { icon: ArrowRight, label: "Moved", color: "text-purple-400" },
  delete: { icon: Trash2, label: "Deleted", color: "text-red-400" },
  restore: { icon: RotateCcw, label: "Restored", color: "text-green-400" },
  permanent_delete: { icon: XCircle, label: "Permanently deleted", color: "text-red-500" },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDescription(entry: {
  action: string;
  targetType: string;
  targetName: string;
  metadata?: Record<string, unknown>;
}): string {
  const config = ACTION_CONFIG[entry.action];
  const typeLabel = entry.targetType;
  const label = config?.label ?? entry.action;

  if (entry.action === "rename" && entry.metadata) {
    const oldName = entry.metadata.oldTitle ?? entry.metadata.oldName ?? "?";
    const newName = entry.metadata.newTitle ?? entry.metadata.newName ?? "?";
    return `${label} ${typeLabel} "${oldName}" to "${newName}"`;
  }

  return `${label} ${typeLabel} "${entry.targetName}"`;
}

interface AuditLogProps {
  vaultId: Id<"vaults">;
  onClose: () => void;
}

export default function AuditLog({ vaultId, onClose }: AuditLogProps) {
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const entries = useQuery(api.auditLog.listByVault, {
    vaultId,
    limit: 200,
  });

  const filtered = entries?.filter((e) => {
    if (actionFilter && e.action !== actionFilter) return false;
    if (typeFilter && e.targetType !== typeFilter) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-obsidian-bg border border-obsidian-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-border">
          <h2 className="text-sm font-semibold text-obsidian-text">
            Audit Log
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-4 py-2 border-b border-obsidian-border">
          <Filter size={14} className="text-obsidian-text-muted mt-1" />
          <select
            value={actionFilter ?? ""}
            onChange={(e) => setActionFilter(e.target.value || null)}
            className="bg-obsidian-bg-tertiary text-obsidian-text text-xs rounded px-2 py-1 border border-obsidian-border"
          >
            <option value="">All actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="rename">Rename</option>
            <option value="move">Move</option>
            <option value="delete">Delete</option>
            <option value="restore">Restore</option>
            <option value="permanent_delete">Permanent delete</option>
          </select>
          <select
            value={typeFilter ?? ""}
            onChange={(e) => setTypeFilter(e.target.value || null)}
            className="bg-obsidian-bg-tertiary text-obsidian-text text-xs rounded px-2 py-1 border border-obsidian-border"
          >
            <option value="">All types</option>
            <option value="note">Notes</option>
            <option value="folder">Folders</option>
          </select>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto">
          {!filtered ? (
            <p className="text-center py-8 text-obsidian-text-muted text-xs">
              Loading...
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-obsidian-text-muted text-xs">
              No entries found
            </p>
          ) : (
            filtered.map((entry) => {
              const config = ACTION_CONFIG[entry.action] ?? {
                icon: FileText,
                label: entry.action,
                color: "text-obsidian-text-muted",
              };
              const Icon = config.icon;
              return (
                <div
                  key={entry._id}
                  className="flex items-start gap-2 px-4 py-2 border-b border-obsidian-border/50 hover:bg-obsidian-bg-secondary"
                >
                  <div className={`mt-0.5 ${config.color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-obsidian-text">
                      {getDescription(entry)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {entry.targetType === "note" ? (
                        <FileText size={10} className="text-obsidian-text-muted" />
                      ) : (
                        <Folder size={10} className="text-obsidian-text-muted" />
                      )}
                      <span className="text-xs text-obsidian-text-muted">
                        {formatDate(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
