import { useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { parseEditBlocks, type EditBlock } from "../../lib/parseEditBlocks";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  editBlocks?: EditBlock[];
}

interface SendOptions {
  activeNoteId?: string;
  useEditEndpoint?: boolean;
}

export function useChatStream(vaultId: Id<"vaults">) {
  const { getToken } = useAuth();
  const convex = useConvex();
  const [sessionId, setSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sessions = useQuery(api.chatSessions.list, { vaultId });
  const createSession = useMutation(api.chatSessions.create);
  const removeSession = useMutation(api.chatSessions.remove);
  const saveMessageMut = useMutation(api.chatSessions.saveMessage);

  // Imperatively load messages for a session (no reactive useEffect)
  const loadSessionMessages = useCallback(
    async (sid: Id<"chatSessions">) => {
      const stored = await convex.query(api.chatSessions.getMessages, { sessionId: sid });
      setMessages(
        stored.map((m) => {
          const msg: ChatMessage = { role: m.role, content: m.content };
          if (m.role === "assistant") {
            const blocks = parseEditBlocks(m.content);
            if (blocks.length > 0) msg.editBlocks = blocks;
          }
          return msg;
        })
      );
    },
    [convex]
  );

  const selectSession = useCallback(
    async (id: Id<"chatSessions">) => {
      setSessionId(id);
      setMessages([]);
      await loadSessionMessages(id);
    },
    [loadSessionMessages]
  );

  const startNewSession = useCallback(async () => {
    const id = await createSession({ vaultId });
    setSessionId(id);
    setMessages([]);
    return id;
  }, [createSession, vaultId]);

  const deleteSession = useCallback(
    async (id: Id<"chatSessions">) => {
      await removeSession({ sessionId: id });
      if (id === sessionId) {
        setSessionId(null);
        setMessages([]);
      }
    },
    [removeSession, sessionId]
  );

  const sendMessage = useCallback(
    async (message: string, options?: SendOptions) => {
      if (isStreaming) return;

      // Auto-create session if none active
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        activeSessionId = await createSession({ vaultId });
        setSessionId(activeSessionId);
      }

      // Add user message to local state
      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setIsStreaming(true);

      // Save user message to DB
      await saveMessageMut({
        sessionId: activeSessionId,
        role: "user",
        content: message,
      });

      // Build history from current messages (before this new one)
      // Limit to last 20 messages to avoid huge payloads
      const history = messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Add empty assistant message for streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let fullResponse = "";

      try {
        const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
        const siteUrl = convexUrl.replace(".cloud", ".site");

        const token = await getToken({ template: "convex" });

        abortRef.current = new AbortController();

        const endpoint = options?.useEditEndpoint
          ? `${siteUrl}/api/chat-edit`
          : `${siteUrl}/api/chat`;

        const body: Record<string, unknown> = { vaultId, message, history };
        if (options?.useEditEndpoint && options.activeNoteId) {
          body.activeNoteId = options.activeNoteId;
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          let errorText: string;
          try {
            const data = await response.json();
            errorText = data.error ?? JSON.stringify(data);
          } catch {
            errorText = await response.text();
          }
          const errorContent = `Error: ${errorText}`;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: errorContent,
            };
            return updated;
          });
          fullResponse = errorContent;
          return;
        }

        // Read the stream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1]!;
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
            return updated;
          });
        }

        // After streaming completes, parse edit blocks if using edit endpoint
        if (options?.useEditEndpoint) {
          const blocks = parseEditBlocks(fullResponse);
          if (blocks.length > 0) {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1]!;
              updated[updated.length - 1] = { ...last, editBlocks: blocks };
              return updated;
            });
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const errorContent = `Error: ${(err as Error).message}`;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: errorContent,
            };
            return updated;
          });
          fullResponse = errorContent;
        }
      } finally {
        // Save the assistant response to DB
        if (fullResponse && activeSessionId) {
          await saveMessageMut({
            sessionId: activeSessionId,
            role: "assistant",
            content: fullResponse,
          });
        }
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [getToken, isStreaming, vaultId, sessionId, messages, createSession, saveMessageMut]
  );

  const updateBlockStatus = useCallback(
    (messageIndex: number, blockIndex: number, status: "applied" | "dismissed") => {
      setMessages((prev) => {
        const updated = [...prev];
        const msg = updated[messageIndex];
        if (!msg?.editBlocks) return prev;
        const newBlocks = [...msg.editBlocks];
        newBlocks[blockIndex] = { ...newBlocks[blockIndex]!, status };
        updated[messageIndex] = { ...msg, editBlocks: newBlocks };
        return updated;
      });
    },
    []
  );

  const clearMessages = useCallback(() => {
    setSessionId(null);
    setMessages([]);
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    clearMessages,
    updateBlockStatus,
    // Session management
    sessions: sessions ?? [],
    sessionId,
    selectSession,
    startNewSession,
    deleteSession,
  };
}
