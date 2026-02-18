import { useState, FormEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { useClerk } from "@clerk/clerk-react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import { Pencil, Trash2, Plus, LogOut, Upload } from "lucide-react";
import ImportVaultDialog from "./ImportVaultDialog";
import type { Id } from "../../../convex/_generated/dataModel";

export default function VaultSelector() {
  const vaults = useQuery(api.vaults.list);
  const createVault = useMutation(api.vaults.create);
  const renameVault = useMutation(api.vaults.rename);
  const removeVault = useMutation(api.vaults.remove);
  const { signOut } = useClerk();
  const [, dispatch] = useWorkspace();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<Id<"vaults"> | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showImport, setShowImport] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await createVault({ name: newName.trim() });
    setNewName("");
    setCreating(false);
  }

  async function handleRename(id: Id<"vaults">) {
    if (!editingName.trim()) return;
    await renameVault({ id, name: editingName.trim() });
    setEditingId(null);
  }

  async function handleDelete(id: Id<"vaults">) {
    if (!confirm("Delete this vault and all its contents?")) return;
    await removeVault({ id });
  }

  return (
    <div className="min-h-screen bg-obsidian-bg flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-obsidian-text">Your Vaults</h1>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-sm text-obsidian-text-muted hover:text-obsidian-text transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>

        <div className="grid gap-3">
          {vaults?.map((vault) => (
            <div
              key={vault._id}
              className="bg-obsidian-bg-secondary border border-obsidian-border rounded-lg p-4 flex items-center justify-between hover:border-obsidian-accent/50 transition-colors group cursor-pointer"
              onClick={() => {
                if (editingId !== vault._id) {
                  dispatch({ type: "SET_VAULT", vaultId: vault._id });
                }
              }}
            >
              {editingId === vault._id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRename(vault._id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(vault._id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-obsidian-bg border border-obsidian-accent rounded px-2 py-1 text-sm text-obsidian-text focus:outline-none"
                />
              ) : (
                <span className="text-obsidian-text font-medium truncate">
                  {vault.name}
                </span>
              )}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(vault._id);
                    setEditingName(vault.name);
                  }}
                  className="p-1 text-obsidian-text-muted hover:text-obsidian-text rounded hover:bg-obsidian-bg-tertiary"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(vault._id);
                  }}
                  className="p-1 text-obsidian-text-muted hover:text-red-400 rounded hover:bg-obsidian-bg-tertiary"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {creating ? (
          <form onSubmit={handleCreate} className="mt-4 flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Vault name"
              className="flex-1 bg-obsidian-bg border border-obsidian-border rounded px-3 py-2 text-obsidian-text focus:outline-none focus:border-obsidian-accent"
            />
            <button
              type="submit"
              className="bg-obsidian-accent hover:bg-obsidian-accent-hover text-white px-4 py-2 rounded font-medium transition-colors"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-obsidian-text-muted hover:text-obsidian-text px-3 py-2 transition-colors"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="mt-4 grid gap-3">
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-2 bg-obsidian-bg-secondary border border-dashed border-obsidian-border rounded-lg p-4 text-obsidian-text-muted hover:text-obsidian-text hover:border-obsidian-accent/50 transition-colors"
            >
              <Plus size={18} />
              Create New Vault
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="w-full flex items-center justify-center gap-2 bg-obsidian-bg-secondary border border-dashed border-obsidian-border rounded-lg p-4 text-obsidian-text-muted hover:text-obsidian-text hover:border-obsidian-accent/50 transition-colors"
            >
              <Upload size={18} />
              Import Vault
            </button>
          </div>
        )}

        {vaults?.length === 0 && !creating && (
          <p className="text-center text-obsidian-text-muted mt-8 text-sm">
            No vaults yet. Create one to get started.
          </p>
        )}
      </div>
      {showImport && (
        <ImportVaultDialog onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
