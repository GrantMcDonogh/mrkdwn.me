import { User, Bot } from "lucide-react";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: Props) {
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
        <div className="text-sm text-obsidian-text whitespace-pre-wrap break-words">
          {content || (
            <span className="text-obsidian-text-muted animate-pulse">
              Thinking...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
