import { useState, useRef, useEffect, type FormEvent } from "react";
import { useWorkspace } from "../../store/workspace";
import { useChatStream } from "./useChatStream";
import ChatMessage from "./ChatMessage";
import { Send, Trash2 } from "lucide-react";

export default function ChatPanel() {
  const [state] = useWorkspace();
  const vaultId = state.vaultId!;
  const { messages, isStreaming, sendMessage, clearMessages } =
    useChatStream();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const msg = input.trim();
    setInput("");
    await sendMessage(vaultId, msg);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-obsidian-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-obsidian-text-muted">
          Chat
        </span>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="p-1 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
            title="Clear chat"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
            <p className="text-sm text-obsidian-text-muted text-center">
              Ask questions about your vault notes
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-2 border-t border-obsidian-border"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your notes..."
            disabled={isStreaming}
            className="flex-1 bg-obsidian-bg border border-obsidian-border rounded px-3 py-1.5 text-sm text-obsidian-text focus:outline-none focus:border-obsidian-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="p-1.5 rounded bg-obsidian-accent hover:bg-obsidian-accent-hover text-white disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
