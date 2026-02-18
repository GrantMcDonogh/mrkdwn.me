import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import { FileText } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function fuzzyScore(query: string, title: string): number {
  const q = query.toLowerCase();
  const t = title.toLowerCase();

  // Exact substring bonus
  if (t.includes(q)) return 1000 - t.indexOf(q);

  // Fuzzy matching
  let qi = 0;
  let score = 0;
  let consecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10 + consecutive * 5;
      consecutive++;
      qi++;
    } else {
      consecutive = 0;
    }
  }

  // All chars must match
  if (qi < q.length) return -1;

  return score;
}

export default function QuickSwitcher({ onClose }: Props) {
  const [state, dispatch] = useWorkspace();
  const vaultId = state.vaultId!;
  const notes = useQuery(api.notes.list, { vaultId });
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!notes) return [];
    if (!query.trim()) return notes.slice(0, 20);
    return notes
      .map((n) => ({ note: n, score: fuzzyScore(query, n.title) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => r.note);
  }, [notes, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function select(noteId: typeof results[number]["_id"]) {
    dispatch({ type: "OPEN_NOTE", noteId });
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const note = results[selectedIndex];
      if (note) select(note._id);
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
          <FileText size={14} className="text-obsidian-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a note..."
            className="flex-1 bg-transparent text-sm text-obsidian-text focus:outline-none"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {results.map((note, i) => (
            <button
              key={note._id}
              onClick={() => select(note._id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                i === selectedIndex
                  ? "bg-obsidian-bg-tertiary text-obsidian-text"
                  : "text-obsidian-text-muted hover:bg-obsidian-bg-tertiary"
              }`}
            >
              <FileText size={14} />
              {note.title}
            </button>
          ))}
          {results.length === 0 && (
            <p className="px-3 py-4 text-sm text-obsidian-text-muted text-center">
              No notes found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
