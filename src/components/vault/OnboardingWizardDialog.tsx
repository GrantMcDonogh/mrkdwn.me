import { useState, useCallback, useRef, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "../../store/workspace";
import { batchNotes } from "../../lib/importVault";
import {
  useOnboardingGenerate,
  type GeneratedVault,
} from "../../hooks/useOnboardingGenerate";
import { WIZARD_QUESTIONS } from "../../lib/onboardingQuestions";
import {
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Bot,
  User,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

type State =
  | { step: "questions" }
  | { step: "generating" }
  | { step: "preview"; vault: GeneratedVault; name: string }
  | { step: "creating"; message: string }
  | { step: "done"; vaultId: Id<"vaults"> }
  | { step: "error"; message: string };

interface ChatEntry {
  role: "assistant" | "user";
  content: string;
}

interface Props {
  onClose: () => void;
}

export default function OnboardingWizardDialog({ onClose }: Props) {
  const [state, setState] = useState<State>({ step: "questions" });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [, dispatch] = useWorkspace();
  const createVaultWithFolders = useAction(
    api.importVault.createVaultWithFolders
  );
  const importNotesBatch = useMutation(api.notes.importBatch);
  const { generate, isGenerating } = useOnboardingGenerate();

  const currentQuestion =
    questionIndex < WIZARD_QUESTIONS.length
      ? WIZARD_QUESTIONS[questionIndex]
      : null;

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, questionIndex]);

  // Add the first question to chat on mount
  useEffect(() => {
    if (WIZARD_QUESTIONS.length > 0) {
      setChatHistory([
        {
          role: "assistant",
          content: WIZARD_QUESTIONS[0]!.question,
        },
      ]);
    }
  }, []);

  const advanceQuestion = useCallback(
    async (answer: string | string[]) => {
      if (!currentQuestion) return;

      const displayAnswer = Array.isArray(answer)
        ? answer.join(", ")
        : answer;

      const newAnswers = { ...answers, [currentQuestion.id]: answer };
      setAnswers(newAnswers);

      const newHistory: ChatEntry[] = [
        ...chatHistory,
        { role: "user", content: displayAnswer },
      ];

      const nextIndex = questionIndex + 1;

      if (nextIndex < WIZARD_QUESTIONS.length) {
        newHistory.push({
          role: "assistant",
          content: WIZARD_QUESTIONS[nextIndex]!.question,
        });
        setChatHistory(newHistory);
        setQuestionIndex(nextIndex);
        setMultiSelected([]);
      } else {
        setChatHistory(newHistory);
        setState({ step: "generating" });

        const result = await generate(newAnswers);
        if (result) {
          setState({ step: "preview", vault: result, name: result.vaultName });
        } else {
          setState({
            step: "error",
            message: "Failed to generate vault structure. Please try again.",
          });
        }
      }
    },
    [currentQuestion, answers, chatHistory, questionIndex, generate]
  );

  const handleSingleSelect = useCallback(
    (option: string) => {
      advanceQuestion(option);
    },
    [advanceQuestion]
  );

  const handleMultiToggle = useCallback(
    (option: string) => {
      const max = currentQuestion?.maxSelect ?? Infinity;
      setMultiSelected((prev) => {
        if (prev.includes(option)) {
          return prev.filter((o) => o !== option);
        }
        if (prev.length >= max) return prev;
        return [...prev, option];
      });
    },
    [currentQuestion]
  );

  const handleMultiContinue = useCallback(() => {
    if (multiSelected.length > 0) {
      advanceQuestion(multiSelected);
    }
  }, [multiSelected, advanceQuestion]);

  const handleCreateVault = useCallback(async () => {
    if (state.step !== "preview") return;
    const { vault, name } = state;

    try {
      setState({ step: "creating", message: "Creating vault and folders..." });

      const { vaultId, folderIdMap } = await createVaultWithFolders({
        name,
        folders: vault.folders,
      });

      const batches = batchNotes(
        vault.notes,
        folderIdMap as Record<string, string>,
        vaultId as Id<"vaults">
      );

      for (let i = 0; i < batches.length; i++) {
        setState({
          step: "creating",
          message: `Creating notes (batch ${i + 1} of ${batches.length})...`,
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
        message: err instanceof Error ? err.message : "Failed to create vault",
      });
    }
  }, [state, createVaultWithFolders, importNotesBatch, dispatch, onClose]);

  const handleRetry = useCallback(() => {
    setState({ step: "questions" });
    setQuestionIndex(0);
    setAnswers({});
    setMultiSelected([]);
    setChatHistory(
      WIZARD_QUESTIONS.length > 0
        ? [{ role: "assistant", content: WIZARD_QUESTIONS[0]!.question }]
        : []
    );
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-obsidian-bg-secondary border border-obsidian-border rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-obsidian-accent" />
            <h2 className="text-sm font-medium text-obsidian-text">
              Set Up with AI
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-obsidian-text-muted hover:text-obsidian-text rounded hover:bg-obsidian-bg-tertiary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {(state.step === "questions" || state.step === "generating") && (
            <div className="space-y-3">
              {/* Chat history */}
              {chatHistory.map((entry, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${entry.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {entry.role === "assistant" && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-obsidian-accent/20 flex items-center justify-center mt-0.5">
                      <Bot size={14} className="text-obsidian-accent" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${
                      entry.role === "user"
                        ? "bg-obsidian-accent text-white"
                        : "bg-obsidian-bg text-obsidian-text"
                    }`}
                  >
                    {entry.content}
                  </div>
                  {entry.role === "user" && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-obsidian-bg-tertiary flex items-center justify-center mt-0.5">
                      <User size={14} className="text-obsidian-text-muted" />
                    </div>
                  )}
                </div>
              ))}

              {/* Option buttons for current question */}
              {state.step === "questions" && currentQuestion && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {currentQuestion.options.map((option) => {
                    const isMulti = !!currentQuestion.multiSelect;
                    const isSelected = isMulti && multiSelected.includes(option);
                    return (
                      <button
                        key={option}
                        onClick={() =>
                          isMulti
                            ? handleMultiToggle(option)
                            : handleSingleSelect(option)
                        }
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          isSelected
                            ? "bg-obsidian-accent border-obsidian-accent text-white"
                            : "border-obsidian-border text-obsidian-text hover:border-obsidian-accent/50 hover:text-obsidian-text"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                  {currentQuestion.multiSelect && (
                    <button
                      onClick={handleMultiContinue}
                      disabled={multiSelected.length === 0}
                      className="px-4 py-1.5 rounded-full text-sm bg-obsidian-accent hover:bg-obsidian-accent-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Continue
                    </button>
                  )}
                </div>
              )}

              {/* Generating indicator */}
              {(state.step === "generating" || isGenerating) && (
                <div className="flex items-center gap-2 pt-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-obsidian-accent/20 flex items-center justify-center">
                    <Loader2
                      size={14}
                      className="animate-spin text-obsidian-accent"
                    />
                  </div>
                  <span className="text-sm text-obsidian-text-muted">
                    Generating your personalized vault...
                  </span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}

          {state.step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-obsidian-accent" />
                <span className="text-sm text-obsidian-text">
                  Your vault is ready!
                </span>
              </div>
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
                <p>{state.vault.folders.length} folders</p>
                <p>{state.vault.notes.length} notes</p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm text-obsidian-text-muted hover:text-obsidian-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateVault}
                  disabled={!state.name.trim()}
                  className="px-4 py-1.5 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded font-medium transition-colors text-sm disabled:opacity-50"
                >
                  Create Vault
                </button>
              </div>
            </div>
          )}

          {state.step === "creating" && (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2
                size={18}
                className="animate-spin text-obsidian-accent"
              />
              <span className="text-sm text-obsidian-text-muted">
                {state.message}
              </span>
            </div>
          )}

          {state.step === "done" && (
            <div className="flex items-center justify-center gap-2 py-6">
              <CheckCircle size={18} className="text-green-500" />
              <span className="text-sm text-obsidian-text">
                Vault created!
              </span>
            </div>
          )}

          {state.step === "error" && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  size={18}
                  className="text-red-400 flex-shrink-0"
                />
                <span className="text-sm text-red-400">{state.message}</span>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleRetry}
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
