import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import { useDownloadVault } from "../../hooks/useDownloadVault";

interface Command {
  name: string;
  action: () => void;
}

interface Props {
  onClose: () => void;
}

export default function CommandPalette({ onClose }: Props) {
  const [state, dispatch] = useWorkspace();
  const currentVault = useQuery(
    api.vaults.get,
    state.vaultId ? { id: state.vaultId } : "skip"
  );
  const downloadVault = useDownloadVault();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    {
      name: "Toggle Sidebar",
      action: () => dispatch({ type: "TOGGLE_SIDEBAR" }),
    },
    {
      name: "Split Editor Vertically",
      action: () => dispatch({ type: "SPLIT_PANE", direction: "vertical" }),
    },
    {
      name: "Split Editor Horizontally",
      action: () => dispatch({ type: "SPLIT_PANE", direction: "horizontal" }),
    },
    {
      name: "Toggle Backlinks Panel",
      action: () => dispatch({ type: "SET_RIGHT_PANEL", panel: "backlinks" }),
    },
    {
      name: "Open Graph View",
      action: () => dispatch({ type: "OPEN_GRAPH" }),
    },
    {
      name: "Toggle Search",
      action: () => dispatch({ type: "SET_RIGHT_PANEL", panel: "search" }),
    },
    {
      name: "Toggle Chat",
      action: () => dispatch({ type: "SET_RIGHT_PANEL", panel: "chat" }),
    },
    {
      name: "Manage Vaults",
      action: () => dispatch({ type: "LEAVE_VAULT" }),
    },
    ...(state.vaultId && currentVault
      ? [
          {
            name: "Download Vault",
            action: () => downloadVault(state.vaultId!, currentVault.name),
          },
        ]
      : []),
    {
      name: "Toggle Preview/Edit Mode",
      action: () => {
        const activePane = state.panes.find(
          (p) => p.id === state.activePaneId
        );
        const activeTab = activePane?.tabs.find(
          (t) => t.id === activePane.activeTabId
        );
        if (activeTab?.type === "note") {
          dispatch({
            type: "TOGGLE_TAB_MODE",
            paneId: activePane!.id,
            tabId: activeTab.id,
          });
        }
      },
    },
  ];

  const filtered = commands.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function execute(cmd: Command) {
    cmd.action();
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[selectedIndex];
      if (cmd) execute(cmd);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-obsidian-bg-secondary border border-obsidian-border rounded-lg shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-obsidian-border">
          <span className="text-obsidian-text-muted text-sm">&gt;</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-obsidian-text focus:outline-none"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.name}
              onClick={() => execute(cmd)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                i === selectedIndex
                  ? "bg-obsidian-bg-tertiary text-obsidian-text"
                  : "text-obsidian-text-muted hover:bg-obsidian-bg-tertiary"
              }`}
            >
              {cmd.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-sm text-obsidian-text-muted text-center">
              No matching commands
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
