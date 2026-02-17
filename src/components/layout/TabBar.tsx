import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import { X } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

interface Props {
  paneId: string;
  tabs: { id: string; noteId: Id<"notes"> }[];
  activeTabId: string | null;
}

function TabItem({
  tabId,
  noteId,
  paneId,
  isActive,
}: {
  tabId: string;
  noteId: Id<"notes">;
  paneId: string;
  isActive: boolean;
}) {
  const [, dispatch] = useWorkspace();
  const note = useQuery(api.notes.get, { id: noteId });

  return (
    <div
      className={`flex items-center gap-1 px-3 py-1.5 text-sm cursor-pointer border-r border-obsidian-border select-none max-w-48 group ${
        isActive
          ? "bg-obsidian-bg text-obsidian-text"
          : "bg-obsidian-bg-secondary text-obsidian-text-muted hover:text-obsidian-text"
      }`}
      onClick={() => dispatch({ type: "SET_ACTIVE_TAB", paneId, tabId })}
    >
      <span className="truncate">{note?.title ?? "..."}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          dispatch({ type: "CLOSE_TAB", paneId, tabId });
        }}
        className="opacity-0 group-hover:opacity-100 hover:bg-obsidian-bg-tertiary rounded p-0.5 shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function TabBar({ paneId, tabs, activeTabId }: Props) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex bg-obsidian-bg-secondary border-b border-obsidian-border overflow-x-auto shrink-0">
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tabId={tab.id}
          noteId={tab.noteId}
          paneId={paneId}
          isActive={tab.id === activeTabId}
        />
      ))}
    </div>
  );
}
