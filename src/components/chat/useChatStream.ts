import { useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useChatStream() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (vaultId: string, message: string) => {
      if (isStreaming) return;

      // Add user message
      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setIsStreaming(true);

      // Add empty assistant message for streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        // Get the Convex site URL from the deployment URL
        const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
        const siteUrl = convexUrl.replace(".cloud", ".site");

        const token = await getToken({ template: "convex" });

        abortRef.current = new AbortController();

        const response = await fetch(`${siteUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ vaultId, message }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: `Error: ${errorText}`,
            };
            return updated;
          });
          return;
        }

        // Read the stream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
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
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: `Error: ${(err as Error).message}`,
            };
            return updated;
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [getToken, isStreaming]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isStreaming, sendMessage, clearMessages };
}
