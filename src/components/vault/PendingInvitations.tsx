import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "../../../convex/_generated/api";
import { Check, X } from "lucide-react";

export default function PendingInvitations() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const pending = useQuery(
    api.sharing.getPendingInvitations,
    email ? { email } : "skip"
  );
  const acceptInvitation = useMutation(api.sharing.acceptInvitation);
  const removeCollaborator = useMutation(api.sharing.removeCollaborator);

  if (!pending || pending.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      <p className="text-xs font-semibold uppercase text-obsidian-text-muted">
        Pending Invitations
      </p>
      {pending.map((inv) => (
        <div
          key={inv._id}
          className="bg-obsidian-bg-secondary border border-obsidian-accent/30 rounded-lg p-3 flex items-center justify-between"
        >
          <div className="min-w-0">
            <span className="text-sm text-obsidian-text font-medium truncate block">
              {inv.vaultName}
            </span>
            <span className="text-xs text-obsidian-text-muted">
              as {inv.role}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() =>
                acceptInvitation({ membershipId: inv._id, email })
              }
              className="p-1.5 rounded bg-obsidian-accent/20 hover:bg-obsidian-accent/30 text-obsidian-accent"
              title="Accept"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => removeCollaborator({ membershipId: inv._id })}
              className="p-1.5 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-red-400"
              title="Decline"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
