import { useMemo } from "react";
import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { EditBlock } from "../../lib/parseEditBlocks";
import { stripEditBlocks } from "../../lib/parseEditBlocks";
import EditBlockCard from "./EditBlockCard";
import MermaidDiagram from "../editor/MermaidDiagram";
import { preprocessContent } from "../../utils/preprocessMarkdown";
import type { Id } from "../../../convex/_generated/dataModel";

interface NoteRef {
  _id: Id<"notes">;
  title: string;
}

interface Props {
  role: "user" | "assistant";
  content: string;
  editBlocks?: EditBlock[];
  vaultId?: Id<"vaults">;
  onBlockStatusChange?: (blockIndex: number, status: "applied" | "dismissed") => void;
  allNotes?: NoteRef[] | null;
  onNavigateNote?: (noteId: Id<"notes">) => void;
}

export default function ChatMessage({
  role,
  content,
  editBlocks,
  vaultId,
  onBlockStatusChange,
  allNotes,
  onNavigateNote,
}: Props) {
  const displayContent =
    editBlocks && editBlocks.length > 0 ? stripEditBlocks(content) : content;

  const processedContent = useMemo(
    () => (role === "assistant" && displayContent ? preprocessContent(displayContent) : ""),
    [role, displayContent]
  );

  const components: Components = useMemo(
    () => ({
      code: ({ className, children }) => {
        if (className === "language-mermaid") {
          const chart = String(children).replace(/\n$/, "");
          return <MermaidDiagram chart={chart} />;
        }
        return <code className={className}>{children}</code>;
      },
      a: ({ href, children }) => {
        if (href?.startsWith("wikilink://")) {
          const title = decodeURIComponent(href.replace("wikilink://", ""));
          return (
            <a
              className="markdown-preview-wikilink"
              onClick={(e) => {
                e.preventDefault();
                if (!allNotes || !onNavigateNote) return;
                const target = allNotes.find(
                  (n) => n.title.toLowerCase() === title.toLowerCase()
                );
                if (target) onNavigateNote(target._id);
              }}
            >
              {children}
            </a>
          );
        }
        if (href?.startsWith("tag://")) {
          return <span className="markdown-preview-tag">{children}</span>;
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
    }),
    [allNotes, onNavigateNote]
  );

  return (
    <div
      className={`flex gap-2 p-3 ${
        role === "user" ? "bg-obsidian-bg" : ""
      }`}
    >
      <div className="shrink-0 mt-0.5">
        {role === "user" ? (
          <div className="w-6 h-6 rounded bg-obsidian-bg-tertiary flex items-center justify-center">
            <User size={14} className="text-obsidian-text-muted" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded bg-obsidian-accent/20 flex items-center justify-center">
            <Bot size={14} className="text-obsidian-accent" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-obsidian-text-muted mb-1">
          {role === "user" ? "You" : "Assistant"}
        </p>
        {role === "assistant" ? (
          displayContent ? (
            <div className="chat-message-markdown markdown-preview">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
                urlTransform={(url) => url}
              >
                {processedContent}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-sm text-obsidian-text">
              <span className="text-obsidian-text-muted animate-pulse">
                Thinking...
              </span>
            </div>
          )
        ) : (
          <div className="text-sm text-obsidian-text whitespace-pre-wrap break-words">
            {displayContent || (
              <span className="text-obsidian-text-muted animate-pulse">
                Thinking...
              </span>
            )}
          </div>
        )}
        {editBlocks &&
          vaultId &&
          editBlocks.map((block, i) => (
            <EditBlockCard
              key={i}
              block={block}
              vaultId={vaultId}
              onStatusChange={(status) => onBlockStatusChange?.(i, status)}
            />
          ))}
      </div>
    </div>
  );
}
