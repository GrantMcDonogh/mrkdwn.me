import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { X, Key, ExternalLink } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function SettingsDialog({ onClose }: Props) {
  const keyStatus = useQuery(api.userSettings.hasOpenRouterKey);
  const saveKey = useMutation(api.userSettings.saveOpenRouterKey);
  const deleteKey = useMutation(api.userSettings.deleteOpenRouterKey);

  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const hasKey = keyStatus?.hasKey ?? false;

  async function handleSave() {
    if (!keyInput.trim()) return;
    setStatus("saving");
    setErrorMsg("");
    try {
      await saveKey({ key: keyInput.trim() });
      setKeyInput("");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("error");
      setErrorMsg((err as Error).message);
    }
  }

  async function handleRemove() {
    setStatus("saving");
    setErrorMsg("");
    try {
      await deleteKey();
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-obsidian-bg-secondary border border-obsidian-border rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-border">
          <h2 className="text-sm font-semibold text-obsidian-text">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-obsidian-text mb-2">
              <Key size={12} />
              OpenRouter API Key
            </label>
            <p className="text-xs text-obsidian-text-muted mb-3">
              Add your OpenRouter API key to enable note editing via chat.
              Without a key, chat works as read-only Q&A.
            </p>

            {hasKey ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-obsidian-bg border border-obsidian-border rounded px-3 py-1.5 text-sm text-obsidian-text-muted font-mono">
                    sk-or-••••••••
                  </div>
                  <button
                    onClick={handleRemove}
                    disabled={status === "saving"}
                    className="px-3 py-1.5 text-xs rounded bg-red-900/30 hover:bg-red-900/50 text-red-400 disabled:opacity-50 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-xs text-obsidian-text-muted">
                  Enter a new key below to replace the existing one:
                </p>
              </div>
            ) : null}

            <div className="flex gap-2 mt-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="sk-or-..."
                className="flex-1 bg-obsidian-bg border border-obsidian-border rounded px-3 py-1.5 text-sm text-obsidian-text font-mono focus:outline-none focus:border-obsidian-accent"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
              <button
                onClick={handleSave}
                disabled={!keyInput.trim() || status === "saving"}
                className="px-3 py-1.5 text-xs rounded bg-obsidian-accent hover:bg-obsidian-accent-hover text-white disabled:opacity-50 transition-colors"
              >
                {status === "saving" ? "Saving..." : "Save"}
              </button>
            </div>

            {status === "saved" && (
              <p className="text-xs text-green-400 mt-1">Key saved successfully</p>
            )}
            {status === "error" && (
              <p className="text-xs text-red-400 mt-1">{errorMsg}</p>
            )}
          </div>

          <div className="border-t border-obsidian-border pt-3">
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-obsidian-accent hover:underline"
            >
              Get an API key at openrouter.ai
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
