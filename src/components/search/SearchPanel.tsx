import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import { Search, FileText } from "lucide-react";

export default function SearchPanel() {
  const [state, dispatch] = useWorkspace();
  const vaultId = state.vaultId!;

  const allNotes = useQuery(api.notes.list, { vaultId });
  const searchResults = useQuery(
    api.notes.search,
    state.searchQuery.trim()
      ? { vaultId, query: state.searchQuery.trim() }
      : "skip"
  );

  // Extract tags from all notes
  const tags = useMemo(() => {
    if (!allNotes) return [];
    const tagMap = new Map<string, number>();
    const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_-]*)/g;
    for (const note of allNotes) {
      let match;
      tagRegex.lastIndex = 0;
      while ((match = tagRegex.exec(note.content)) !== null) {
        const tag = `#${match[1]}`;
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      }
    }
    return [...tagMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [allNotes]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-obsidian-border">
        <span className="text-xs font-semibold uppercase text-obsidian-text-muted">
          Search
        </span>
      </div>
      <div className="p-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-obsidian-text-muted"
          />
          <input
            value={state.searchQuery}
            onChange={(e) =>
              dispatch({ type: "SET_SEARCH_QUERY", query: e.target.value })
            }
            placeholder="Search notes..."
            className="w-full bg-obsidian-bg border border-obsidian-border rounded pl-8 pr-3 py-1.5 text-sm text-obsidian-text focus:outline-none focus:border-obsidian-accent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {/* Tags */}
        {!state.searchQuery.trim() && tags.length > 0 && (
          <div className="mb-3">
            <h3 className="text-xs font-semibold text-obsidian-text-muted mb-2">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1">
              {tags.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() =>
                    dispatch({ type: "SET_SEARCH_QUERY", query: tag })
                  }
                  className="px-2 py-0.5 text-xs rounded bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text transition-colors"
                >
                  {tag} ({count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {state.searchQuery.trim() && (
          <div className="space-y-1">
            {searchResults === undefined && (
              <p className="text-xs text-obsidian-text-muted text-center py-4">
                Searching...
              </p>
            )}
            {searchResults?.length === 0 && (
              <p className="text-xs text-obsidian-text-muted text-center py-4">
                No results found
              </p>
            )}
            {searchResults?.map((note) => (
              <button
                key={note._id}
                onClick={() =>
                  dispatch({ type: "OPEN_NOTE", noteId: note._id })
                }
                className="w-full text-left p-2 rounded bg-obsidian-bg hover:bg-obsidian-bg-tertiary transition-colors"
              >
                <div className="flex items-center gap-1.5 text-sm text-obsidian-text">
                  <FileText size={12} />
                  {note.title}
                </div>
                <p className="text-xs text-obsidian-text-muted line-clamp-2 mt-1">
                  {note.content.slice(0, 150)}
                </p>
              </button>
            ))}
          </div>
        )}

        {!state.searchQuery.trim() && tags.length === 0 && (
          <p className="text-center py-8 text-obsidian-text-muted text-xs">
            Type to search
          </p>
        )}
      </div>
    </div>
  );
}
