import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const chat = httpAction(async (ctx, request) => {
  // CORS headers — echo the request origin
  const origin = request.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "origin",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Auth: verify identity from Authorization header
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const { vaultId, message } = await request.json();
  if (!vaultId || !message) {
    return new Response("Missing vaultId or message", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Build context by fetching vault notes
  const contextData = await ctx.runQuery(
    internal.chatHelpers.buildContext,
    { vaultId, query: message }
  );

  if (!contextData) {
    return new Response("Vault not found or not authorized", {
      status: 403,
      headers: corsHeaders,
    });
  }

  // Get Anthropic API key from env
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY not configured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  // Call Claude API with streaming
  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      stream: true,
      system:
        "You are a helpful assistant that answers questions based on the user's vault notes. " +
        "Answer ONLY from the provided notes. Cite note titles when referencing content. " +
        'If the notes don\'t contain relevant information, say "I don\'t have enough information in your notes to answer that." ' +
        "Use markdown formatting. Be concise and factual. Note any discrepancies between notes.",
      messages: [
        {
          role: "user",
          content: `Question: ${message}\n\nVault notes:\n${contextData.context}`,
        },
      ],
    }),
  });

  if (!claudeResponse.ok) {
    const errorText = await claudeResponse.text();
    return new Response(`Claude API error: ${errorText}`, {
      status: 502,
      headers: corsHeaders,
    });
  }

  // Stream the response back using TransformStream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Process the SSE stream from Claude in the background
  (async () => {
    try {
      const reader = claudeResponse.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.type === "text_delta"
              ) {
                await writer.write(encoder.encode(parsed.delta.text));
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      await writer.write(
        encoder.encode(`\n\n[Error: ${err}]`)
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
});
