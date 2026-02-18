import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import Sidebar from "./Sidebar";
import TabBar from "./TabBar";
import MarkdownEditor from "../editor/MarkdownEditor";
import BacklinksPanel from "../backlinks/BacklinksPanel";
import SearchPanel from "../search/SearchPanel";
import GraphView from "../graph/GraphView";
import ChatPanel from "../chat/ChatPanel";
import SplitPane from "./SplitPane";
import CommandPalette from "../command-palette/CommandPalette";
import QuickSwitcher from "../command-palette/QuickSwitcher";
import {
  PanelLeft,
  Link2,
  GitFork,
  Search,
  FileText,
  MessageSquare,
} from "lucide-react";

export default function AppLayout() {
  const [state, dispatch] = useWorkspace();
  const vault = useQuery(
    api.vaults.get,
    state.vaultId ? { id: state.vaultId } : "skip"
  );
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "p") {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        setShowQuickSwitcher(false);
      }
      if (mod && e.key === "o") {
        e.preventDefault();
        setShowQuickSwitcher((v) => !v);
        setShowCommandPalette(false);
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function renderRightPanel() {
    switch (state.rightPanel) {
      case "backlinks":
        return <BacklinksPanel />;
      case "search":
        return <SearchPanel />;
      case "chat":
        return <ChatPanel />;
      default:
        return null;
    }
  }

  function renderPane(pane: (typeof state.panes)[number]) {
    const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId);

    return (
      <div
        key={pane.id}
        className={`flex-1 min-w-0 flex flex-col ${
          state.panes.length > 1 && pane.id === state.activePaneId
            ? "border border-obsidian-accent/20"
            : ""
        }`}
        onClick={() => dispatch({ type: "SET_ACTIVE_PANE", paneId: pane.id })}
      >
        <TabBar
          paneId={pane.id}
          tabs={pane.tabs}
          activeTabId={pane.activeTabId}
        />
        {activeTab?.type === "graph" ? (
          <GraphView />
        ) : activeTab?.type === "note" ? (
          <MarkdownEditor noteId={activeTab.noteId!} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <FileText
              size={48}
              className="text-obsidian-text-muted opacity-30"
            />
            <p className="text-lg text-obsidian-text-muted">No note open</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-obsidian-bg">
      {/* Toolbar */}
      <div className="h-10 bg-obsidian-bg-secondary border-b border-obsidian-border flex items-center px-2 gap-1 shrink-0">
        <button
          onClick={() => dispatch({ type: "TOGGLE_SIDEBAR" })}
          className="p-1.5 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
        >
          <PanelLeft size={18} />
        </button>
        <span className="text-sm text-obsidian-text ml-2 truncate">
          {vault?.name ?? ""}
        </span>
        <div className="flex-1" />
        <button
          onClick={() =>
            dispatch({ type: "SET_RIGHT_PANEL", panel: "backlinks" })
          }
          className={`p-1.5 rounded hover:bg-obsidian-bg-tertiary ${
            state.rightPanel === "backlinks"
              ? "text-obsidian-accent"
              : "text-obsidian-text-muted hover:text-obsidian-text"
          }`}
        >
          <Link2 size={18} />
        </button>
        <button
          onClick={() => dispatch({ type: "OPEN_GRAPH" })}
          className={`p-1.5 rounded hover:bg-obsidian-bg-tertiary ${
            (() => {
              const ap = state.panes.find((p) => p.id === state.activePaneId);
              const at = ap?.tabs.find((t) => t.id === ap.activeTabId);
              return at?.type === "graph";
            })()
              ? "text-obsidian-accent"
              : "text-obsidian-text-muted hover:text-obsidian-text"
          }`}
        >
          <GitFork size={18} />
        </button>
        <button
          onClick={() =>
            dispatch({ type: "SET_RIGHT_PANEL", panel: "search" })
          }
          className={`p-1.5 rounded hover:bg-obsidian-bg-tertiary ${
            state.rightPanel === "search"
              ? "text-obsidian-accent"
              : "text-obsidian-text-muted hover:text-obsidian-text"
          }`}
        >
          <Search size={18} />
        </button>
        <button
          onClick={() =>
            dispatch({ type: "SET_RIGHT_PANEL", panel: "chat" })
          }
          className={`p-1.5 rounded hover:bg-obsidian-bg-tertiary ${
            state.rightPanel === "chat"
              ? "text-obsidian-accent"
              : "text-obsidian-text-muted hover:text-obsidian-text"
          }`}
        >
          <MessageSquare size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        <Sidebar />

        {/* Editor area */}
        <div className="flex-1 min-w-0 flex">
          {state.splitDirection && state.panes.length === 2 ? (
            <SplitPane direction={state.splitDirection}>
              {[renderPane(state.panes[0]!), renderPane(state.panes[1]!)]}
            </SplitPane>
          ) : (
            state.panes.map((pane) => renderPane(pane))
          )}
        </div>

        {/* Right panel */}
        {state.rightPanel && (
          <div className="w-72 border-l border-obsidian-border bg-obsidian-bg-secondary overflow-y-auto">
            {renderRightPanel()}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCommandPalette && (
        <CommandPalette onClose={() => setShowCommandPalette(false)} />
      )}
      {showQuickSwitcher && (
        <QuickSwitcher onClose={() => setShowQuickSwitcher(false)} />
      )}
    </div>
  );
}
