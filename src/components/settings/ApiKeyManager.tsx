import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Key, Trash2, Copy, Check, Plus } from "lucide-react";

interface Props {
  vaultId: Id<"vaults">;
}

export default function ApiKeyManager({ vaultId }: Props) {
  const keys = useQuery(api.apiKeys.list, { vaultId });
  const createKey = useAction(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);

  const [nameInput, setNameInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!nameInput.trim()) return;
    setCreating(true);
    setError("");
    try {
      const result = await createKey({ vaultId, name: nameInput.trim() });
      setNewKey(result.key);
      setNameInput("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke(id: Id<"apiKeys">) {
    try {
      await revokeKey({ id });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString();
  }

  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-medium text-obsidian-text mb-2">
        <Key size={12} />
        Vault API Keys
      </label>
      <p className="text-xs text-obsidian-text-muted mb-3">
        API keys grant access to this vault via the REST API and MCP server.
        Each key is scoped to this vault only.
      </p>

      {/* New key reveal banner */}
      {newKey && (
        <div className="mb-3 p-3 bg-obsidian-accent/10 border border-obsidian-accent/30 rounded">
          <p className="text-xs text-obsidian-accent font-medium mb-2">
            Copy your API key now — it won't be shown again.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 bg-obsidian-bg border border-obsidian-border rounded px-2 py-1 text-xs text-obsidian-text font-mono break-all select-all">
              {newKey}
            </code>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded border border-obsidian-border hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text shrink-0"
              title="Copy to clipboard"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-xs text-obsidian-text-muted hover:text-obsidian-text mt-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Existing keys */}
      {keys && keys.length > 0 && (
        <div className="mb-3 space-y-1">
          {keys.map((k) => (
            <div
              key={k._id}
              className="flex items-center gap-2 px-2 py-1.5 bg-obsidian-bg border border-obsidian-border rounded text-xs"
            >
              <code className="text-obsidian-text-muted font-mono">{k.keyPrefix}...</code>
              <span className="text-obsidian-text truncate flex-1">{k.name}</span>
              <span className="text-obsidian-text-muted shrink-0">
                {k.lastUsedAt ? `Used ${formatDate(k.lastUsedAt)}` : "Never used"}
              </span>
              <button
                onClick={() => handleRevoke(k._id)}
                className="p-1 rounded hover:bg-red-900/30 text-obsidian-text-muted hover:text-red-400 shrink-0"
                title="Revoke key"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Key name (e.g. Claude Code)"
          className="flex-1 bg-obsidian-bg border border-obsidian-border rounded px-3 py-1.5 text-sm text-obsidian-text focus:outline-none focus:border-obsidian-accent"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
        />
        <button
          onClick={handleCreate}
          disabled={!nameInput.trim() || creating}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-obsidian-accent hover:bg-obsidian-accent-hover text-white disabled:opacity-50 transition-colors"
        >
          <Plus size={12} />
          {creating ? "Creating..." : "Create"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
