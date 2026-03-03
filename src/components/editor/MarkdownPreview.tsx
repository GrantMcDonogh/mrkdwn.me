import { useMemo, useCallback, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import type { Id } from "../../../convex/_generated/dataModel";
import LinkPreviewPopup from "./LinkPreviewPopup";

interface Props {
  noteId: Id<"notes">;
  onSwitchToEdit: () => void;
}

/**
 * Pre-process markdown content to convert wiki links and tags
 * into standard markdown links, while preserving code blocks.
 */
function preprocessContent(content: string): string {
  // Split on fenced code blocks and inline code to avoid transforming them
  const parts = content.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  return parts
    .map((part, i) => {
      // Odd indices are code blocks/inline code — leave them alone
      if (i % 2 === 1) return part;

      // Convert wiki links: [[Title|Alias]] or [[Title]]
      let processed = part.replace(
        /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
        (_match, title: string, alias?: string) => {
          const display = alias ?? title;
          return `[${display}](wikilink://${encodeURIComponent(title)})`;
        }
      );

      // Convert tags: #tag (not inside headings at line start)
      processed = processed.replace(
        /(?<=\s|^)#([a-zA-Z][\w-/]*)/gm,
        (_match, tag: string) => `[#${tag}](tag://${tag})`
      );

      return processed;
    })
    .join("");
}

export default function MarkdownPreview({ noteId, onSwitchToEdit }: Props) {
  const [state, dispatch] = useWorkspace();
  const vaultId = state.vaultId!;
  const note = useQuery(api.notes.get, { id: noteId });
  const allNotes = useQuery(api.notes.list, { vaultId });

  const navigateToNote = useCallback(
    (title: string) => {
      if (!allNotes) return;
      const target = allNotes.find(
        (n) => n.title.toLowerCase() === title.toLowerCase()
      );
      if (target) {
        dispatch({ type: "OPEN_NOTE", noteId: target._id });
      }
    },
    [allNotes, dispatch]
  );

  const [hoverState, setHoverState] = useState<{
    title: string;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const clearDismissTimeout = useCallback(() => {
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
  }, []);

  const processedContent = useMemo(
    () => (note?.content ? preprocessContent(note.content) : ""),
    [note?.content]
  );

  const components: Components = useMemo(
    () => ({
      a: ({ href, children }) => {
        if (href?.startsWith("wikilink://")) {
          const title = decodeURIComponent(href.replace("wikilink://", ""));
          return (
            <a
              className="markdown-preview-wikilink"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearHoverTimeout();
                clearDismissTimeout();
                setHoverState(null);
                navigateToNote(title);
              }}
              onMouseEnter={(e) => {
                clearDismissTimeout();
                clearHoverTimeout();
                const mx = e.clientX, my = e.clientY;
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoverState({ title, mouseX: mx, mouseY: my });
                }, 300);
              }}
              onMouseLeave={() => {
                clearHoverTimeout();
                dismissTimeoutRef.current = setTimeout(() => {
                  setHoverState(null);
                }, 200);
              }}
            >
              {children}
            </a>
          );
        }
        if (href?.startsWith("tag://")) {
          return (
            <span className="markdown-preview-tag">{children}</span>
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
      input: ({ checked, ...props }) => (
        <input {...props} checked={checked} disabled type="checkbox" />
      ),
    }),
    [navigateToNote, clearHoverTimeout, clearDismissTimeout]
  );

  const hoveredNoteContent = useMemo(() => {
    if (!hoverState || !allNotes) return null;
    const target = allNotes.find(
      (n) => n.title.toLowerCase() === hoverState.title.toLowerCase()
    );
    return target ? target.content : null;
  }, [hoverState, allNotes]);

  if (note === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-obsidian-text-muted">Loading...</p>
      </div>
    );
  }

  if (note === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-obsidian-text-muted">Note not found</p>
      </div>
    );
  }

  return (
    <div
      className="markdown-preview flex-1 overflow-auto"
      onDoubleClick={onSwitchToEdit}
    >
      <div className="px-6 py-4 max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={components}
          urlTransform={(url) => url}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
      {hoverState && (
        <LinkPreviewPopup
          content={hoveredNoteContent ?? null}
          mouseX={hoverState.mouseX}
          mouseY={hoverState.mouseY}
          onMouseEnter={clearDismissTimeout}
          onMouseLeave={() => {
            setHoverState(null);
          }}
        />
      )}
    </div>
  );
}
