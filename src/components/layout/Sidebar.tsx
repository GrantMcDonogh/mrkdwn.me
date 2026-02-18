import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import FileExplorer from "../explorer/FileExplorer";
import { Vault, ChevronDown, Check } from "lucide-react";

function VaultSwitcher() {
  const [state, dispatch] = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const vaults = useQuery(api.vaults.list);
  const currentVault = useQuery(
    api.vaults.get,
    state.vaultId ? { id: state.vaultId } : "skip"
  );

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
    <div ref={ref} className="relative border-b border-obsidian-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-obsidian-text hover:bg-obsidian-bg-tertiary"
      >
        <Vault size={14} className="shrink-0 text-obsidian-text-muted" />
        <span className="truncate flex-1 text-left">
          {currentVault?.name ?? "Loading..."}
        </span>
        <ChevronDown size={14} className="shrink-0 text-obsidian-text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 bg-obsidian-bg border border-obsidian-border rounded-b-md shadow-lg overflow-hidden">
          {vaults?.map((v) => (
            <button
              key={v._id}
              onClick={() => {
                if (v._id !== state.vaultId) {
                  dispatch({ type: "SET_VAULT", vaultId: v._id });
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
            </button>
          ))}
          <div className="border-t border-obsidian-border">
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
  );
}

export default function Sidebar() {
  const [state] = useWorkspace();

  if (!state.sidebarOpen) return null;

  return (
    <div className="w-60 border-r border-obsidian-border bg-obsidian-bg-secondary flex flex-col overflow-hidden shrink-0">
      <VaultSwitcher />
      <FileExplorer />
    </div>
  );
}
