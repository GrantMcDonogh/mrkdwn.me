import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace, type VaultRole } from "../../store/workspace";
import { useVaultRole } from "../../hooks/useVaultRole";
import FileExplorer from "../explorer/FileExplorer";
import TrashPanel from "../trash/TrashPanel";
import RoleBadge from "../vault/RoleBadge";
import ShareVaultDialog from "../vault/ShareVaultDialog";
import { Vault, ChevronDown, Check, Download, Users, LogOut, Trash2 } from "lucide-react";
import { useDownloadVault } from "../../hooks/useDownloadVault";

function VaultSwitcher() {
  const [state, dispatch] = useWorkspace();
  const { canShareVault } = useVaultRole();
  const [open, setOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const vaults = useQuery(api.vaults.list);
  const currentVault = useQuery(
    api.vaults.get,
    state.vaultId ? { id: state.vaultId } : "skip"
  );
  const downloadVault = useDownloadVault();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      <div ref={ref} className="relative border-b border-obsidian-border">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-obsidian-text hover:bg-obsidian-bg-tertiary"
        >
          <Vault size={14} className="shrink-0 text-obsidian-text-muted" />
          <span className="truncate flex-1 text-left">
            {currentVault?.name ?? "Loading..."}
          </span>
          {currentVault?.role && currentVault.role !== "owner" && (
            <RoleBadge role={currentVault.role as VaultRole} />
          )}
          <ChevronDown size={14} className="shrink-0 text-obsidian-text-muted" />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 bg-obsidian-bg border border-obsidian-border rounded-b-md shadow-lg overflow-hidden">
            {vaults?.map((v) => (
              <button
                key={v._id}
                onClick={() => {
                  if (v._id !== state.vaultId) {
                    dispatch({
                      type: "SET_VAULT",
                      vaultId: v._id,
                      role: v.role as VaultRole,
                    });
                  }
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-obsidian-text hover:bg-obsidian-bg-tertiary"
              >
                {v._id === state.vaultId ? (
                  <Check size={14} className="shrink-0 text-obsidian-accent" />
                ) : (
                  <span className="w-[14px] shrink-0" />
                )}
                <span className="truncate">{v.name}</span>
                {v.role !== "owner" && (
                  <RoleBadge role={v.role as VaultRole} />
                )}
              </button>
            ))}
            <div className="border-t border-obsidian-border">
              {state.vaultId && currentVault && (
                <button
                  onClick={() => {
                    downloadVault(state.vaultId!, currentVault.name);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-obsidian-text-muted hover:bg-obsidian-bg-tertiary"
                >
                  <Download size={14} className="shrink-0" />
                  Download Vault
                </button>
              )}
              {canShareVault && state.vaultId && (
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowShare(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-obsidian-text-muted hover:bg-obsidian-bg-tertiary"
                >
                  <Users size={14} className="shrink-0" />
                  Share Vault...
                </button>
              )}
              {!canShareVault && state.vaultId && (
                <button
                  onClick={() => {
                    dispatch({ type: "LEAVE_VAULT" });
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-obsidian-text-muted hover:bg-obsidian-bg-tertiary"
                >
                  <LogOut size={14} className="shrink-0" />
                  Leave Vault
                </button>
              )}
              <button
                onClick={() => {
                  dispatch({ type: "LEAVE_VAULT" });
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-obsidian-text-muted hover:bg-obsidian-bg-tertiary"
              >
                Manage Vaults...
              </button>
            </div>
          </div>
        )}
      </div>
      {showShare && state.vaultId && (
        <ShareVaultDialog
          vaultId={state.vaultId}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}

export default function Sidebar() {
  const [state] = useWorkspace();
  const [showTrash, setShowTrash] = useState(false);
  const trashCount = useQuery(
    api.trash.getDeletedCount,
    state.vaultId ? { vaultId: state.vaultId } : "skip"
  );

  if (!state.sidebarOpen) return null;

  return (
    <div className="w-60 border-r border-obsidian-border bg-obsidian-bg-secondary flex flex-col overflow-hidden shrink-0">
      <VaultSwitcher />
      {showTrash ? <TrashPanel /> : <FileExplorer />}
      <div className="border-t border-obsidian-border">
        <button
          onClick={() => setShowTrash(!showTrash)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-obsidian-bg-tertiary ${
            showTrash ? "text-obsidian-accent" : "text-obsidian-text-muted hover:text-obsidian-text"
          }`}
        >
          <Trash2 size={14} className="shrink-0" />
          <span>Trash</span>
          {trashCount != null && trashCount > 0 && (
            <span className="ml-auto text-xs bg-obsidian-bg-tertiary rounded-full px-1.5 py-0.5 text-obsidian-text-muted">
              {trashCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
