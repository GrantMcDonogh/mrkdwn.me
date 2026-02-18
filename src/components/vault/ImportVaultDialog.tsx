import { useState, useRef, useCallback } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import {
  parseVaultFiles,
  batchNotes,
  type ParsedVault,
} from "../../lib/importVault";
import {
  FolderOpen,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

type State =
  | { step: "idle" }
  | { step: "parsing" }
  | { step: "preview"; parsed: ParsedVault; name: string }
  | { step: "uploading"; message: string }
  | { step: "done"; vaultId: Id<"vaults"> }
  | { step: "error"; message: string };

interface Props {
  onClose: () => void;
}

export default function ImportVaultDialog({ onClose }: Props) {
  const [state, setState] = useState<State>({ step: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const [, dispatch] = useWorkspace();
  const createVaultWithFolders = useAction(api.importVault.createVaultWithFolders);
  const importNotesBatch = useMutation(api.notes.importBatch);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setState({ step: "parsing" });
    try {
      const parsed = await parseVaultFiles(files);
      setState({ step: "preview", parsed, name: parsed.name });
    } catch (err) {
      setState({
        step: "error",
        message: err instanceof Error ? err.message : "Failed to read files",
      });
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (state.step !== "preview") return;
    const { parsed, name } = state;

    try {
      setState({ step: "uploading", message: "Creating vault and folders..." });

      const { vaultId, folderIdMap } = await createVaultWithFolders({
        name,
        settings: parsed.settings,
        folders: parsed.folders,
      });

      const batches = batchNotes(
        parsed.notes,
        folderIdMap as Record<string, string>,
        vaultId as Id<"vaults">
      );

      for (let i = 0; i < batches.length; i++) {
        setState({
          step: "uploading",
          message: `Uploading notes (batch ${i + 1} of ${batches.length})...`,
        });
        await importNotesBatch({ notes: batches[i]! });
      }

      setState({ step: "done", vaultId: vaultId as Id<"vaults"> });
      setTimeout(() => {
        dispatch({ type: "SET_VAULT", vaultId: vaultId as Id<"vaults"> });
        onClose();
      }, 1000);
    } catch (err) {
      setState({
        step: "error",
        message: err instanceof Error ? err.message : "Import failed",
      });
    }
  }, [state, createVaultWithFolders, importNotesBatch, dispatch, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-obsidian-bg-secondary border border-obsidian-border rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-border">
          <h2 className="text-sm font-medium text-obsidian-text">
            Import Vault
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-obsidian-text-muted hover:text-obsidian-text rounded hover:bg-obsidian-bg-tertiary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {state.step === "idle" && (
            <div className="text-center">
              <p className="text-sm text-obsidian-text-muted mb-4">
                Select an Obsidian vault folder to import all markdown files and
                folder structure.
              </p>
              <input
                ref={inputRef}
                type="file"
                webkitdirectory=""
                directory=""
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                onClick={() => inputRef.current?.click()}
                className="flex items-center justify-center gap-2 mx-auto px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded font-medium transition-colors text-sm"
              >
                <FolderOpen size={16} />
                Select Folder
              </button>
            </div>
          )}

          {state.step === "parsing" && (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 size={18} className="animate-spin text-obsidian-accent" />
              <span className="text-sm text-obsidian-text-muted">
                Reading files...
              </span>
            </div>
          )}

          {state.step === "preview" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-obsidian-text-muted mb-1">
                  Vault Name
                </label>
                <input
                  value={state.name}
                  onChange={(e) =>
                    setState({ ...state, name: e.target.value })
                  }
                  className="w-full bg-obsidian-bg border border-obsidian-border rounded px-3 py-1.5 text-sm text-obsidian-text focus:outline-none focus:border-obsidian-accent"
                />
              </div>
              <div className="text-sm text-obsidian-text-muted space-y-1">
                <p>{state.parsed.stats.mdFiles} notes</p>
                <p>{state.parsed.stats.folders} folders</p>
                {state.parsed.stats.skippedFiles > 0 && (
                  <p>{state.parsed.stats.skippedFiles} files skipped (non-markdown)</p>
                )}
                {state.parsed.settings && (
                  <p>Vault settings detected</p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm text-obsidian-text-muted hover:text-obsidian-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!state.name.trim()}
                  className="px-4 py-1.5 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded font-medium transition-colors text-sm disabled:opacity-50"
                >
                  Import
                </button>
              </div>
            </div>
          )}

          {state.step === "uploading" && (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 size={18} className="animate-spin text-obsidian-accent" />
              <span className="text-sm text-obsidian-text-muted">
                {state.message}
              </span>
            </div>
          )}

          {state.step === "done" && (
            <div className="flex items-center justify-center gap-2 py-6">
              <CheckCircle size={18} className="text-green-500" />
              <span className="text-sm text-obsidian-text">
                Import complete!
              </span>
            </div>
          )}

          {state.step === "error" && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{state.message}</span>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setState({ step: "idle" })}
                  className="px-4 py-1.5 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded font-medium transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
