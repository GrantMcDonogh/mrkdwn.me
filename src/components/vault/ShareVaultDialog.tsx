import { useState, type FormEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { X, UserPlus, Crown, Trash2 } from "lucide-react";

interface Props {
  vaultId: Id<"vaults">;
  onClose: () => void;
}

export default function ShareVaultDialog({ vaultId, onClose }: Props) {
  const collaborators = useQuery(api.sharing.listCollaborators, { vaultId });
  const inviteCollaborator = useMutation(api.sharing.inviteCollaborator);
  const updateRole = useMutation(api.sharing.updateCollaboratorRole);
  const removeCollaborator = useMutation(api.sharing.removeCollaborator);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError("");
    try {
      await inviteCollaborator({ vaultId, email: email.trim(), role });
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleRoleChange(
    membershipId: Id<"vaultMembers">,
    newRole: "editor" | "viewer"
  ) {
    try {
      await updateRole({ membershipId, role: newRole });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRemove(membershipId: Id<"vaultMembers">) {
    if (!confirm("Remove this collaborator?")) return;
    try {
      await removeCollaborator({ membershipId });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-obsidian-bg-secondary border border-obsidian-border rounded-lg shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-border">
          <h2 className="text-sm font-semibold text-obsidian-text">
            Share Vault
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Invite form */}
          <form onSubmit={handleInvite} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 bg-obsidian-bg border border-obsidian-border rounded px-3 py-1.5 text-sm text-obsidian-text focus:outline-none focus:border-obsidian-accent"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
                className="bg-obsidian-bg border border-obsidian-border rounded px-2 py-1.5 text-sm text-obsidian-text focus:outline-none focus:border-obsidian-accent"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={!email.trim() || sending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-obsidian-accent hover:bg-obsidian-accent-hover text-white disabled:opacity-50 transition-colors"
              >
                <UserPlus size={14} />
                Invite
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </form>

          {/* Collaborator list */}
          <div className="border-t border-obsidian-border pt-3 space-y-1">
            <p className="text-xs font-medium text-obsidian-text-muted mb-2">
              People with access
            </p>

            {/* Owner row */}
            {collaborators && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm">
                <Crown size={14} className="text-amber-400 shrink-0" />
                <span className="text-obsidian-text flex-1 truncate">
                  Owner
                </span>
                <span className="text-xs text-obsidian-text-muted">owner</span>
              </div>
            )}

            {collaborators?.members.map((member) => (
              <div
                key={member._id}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-obsidian-bg-tertiary group"
              >
                <span className="text-obsidian-text flex-1 truncate">
                  {member.email}
                  {member.status === "pending" && (
                    <span className="ml-1.5 text-[10px] text-obsidian-text-muted">
                      (pending)
                    </span>
                  )}
                </span>
                <select
                  value={member.role}
                  onChange={(e) =>
                    handleRoleChange(
                      member._id,
                      e.target.value as "editor" | "viewer"
                    )
                  }
                  className="bg-obsidian-bg border border-obsidian-border rounded px-1.5 py-0.5 text-xs text-obsidian-text focus:outline-none"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={() => handleRemove(member._id)}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-obsidian-text-muted hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
