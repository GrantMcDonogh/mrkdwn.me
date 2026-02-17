import { useWorkspace } from "../../store/workspace";
import FileExplorer from "../explorer/FileExplorer";

export default function Sidebar() {
  const [state] = useWorkspace();

  if (!state.sidebarOpen) return null;

  return (
    <div className="w-60 border-r border-obsidian-border bg-obsidian-bg-secondary flex flex-col overflow-hidden shrink-0">
      <FileExplorer />
    </div>
  );
}
