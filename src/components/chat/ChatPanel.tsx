import { useState, useRef, useEffect, type FormEvent } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace, getActiveNoteId } from "../../store/workspace";
import { useChatStream } from "./useChatStream";
import ChatMessage from "./ChatMessage";
import SettingsDialog from "../settings/SettingsDialog";
import { Send, Trash2, Settings, Sparkles } from "lucide-react";

export default function ChatPanel() {
  const [state] = useWorkspace();
  const vaultId = state.vaultId!;
  const activeNoteId = getActiveNoteId(state);
  const { messages, isStreaming, sendMessage, clearMessages, updateBlockStatus } =
    useChatStream();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editModeOn, setEditModeOn] = useState(false);

  const keyStatus = useQuery(api.userSettings.hasOpenRouterKey);
  const hasKey = keyStatus?.hasKey ?? false;

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
    await sendMessage(vaultId, msg, {
      activeNoteId: editModeOn && activeNoteId ? activeNoteId : undefined,
      useEditEndpoint: editModeOn,
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-obsidian-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-obsidian-text-muted">
            Chat
          </span>
          {hasKey && (
            <button
              onClick={() => setEditModeOn((v) => !v)}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                editModeOn
                  ? "bg-obsidian-accent/20 text-obsidian-accent"
                  : "bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
              }`}
              title={editModeOn ? "Disable edit mode" : "Enable edit mode"}
            >
              <Sparkles size={10} />
              Edit mode
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="p-1 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
              title="Clear chat"
            >
              <Trash2 size={12} />
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
            title="Chat settings"
          >
            <Settings size={12} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
            <p className="text-sm text-obsidian-text-muted text-center">
              {editModeOn
                ? "Ask about or edit your notes..."
                : "Ask questions about your vault notes"}
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage
              key={i}
              role={msg.role}
              content={msg.content}
              editBlocks={msg.editBlocks}
              vaultId={vaultId}
              onBlockStatusChange={(blockIndex, status) =>
                updateBlockStatus(i, blockIndex, status)
              }
            />
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
            placeholder={
              editModeOn
                ? "Ask about or edit your notes..."
                : "Ask about your notes..."
            }
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

      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} vaultId={vaultId} />
      )}
    </div>
  );
}
