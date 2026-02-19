import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const chatEdit = httpAction(async (ctx, request) => {
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

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const { vaultId, message, activeNoteId } = await request.json();
  if (!vaultId || !message) {
    return new Response("Missing vaultId or message", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Get the user's OpenRouter key
  const openRouterKey = await ctx.runQuery(
    internal.userSettings.getOpenRouterKey,
    { userId: identity.tokenIdentifier }
  );
  if (!openRouterKey) {
    return new Response("OpenRouter API key not configured", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Build context with active note
  const contextData = await ctx.runQuery(
    internal.chatEditHelpers.buildEditContext,
    { vaultId, query: message, activeNoteId }
  );

  if (!contextData) {
    return new Response("Vault not found or not authorized", {
      status: 403,
      headers: corsHeaders,
    });
  }

  const systemPrompt = `You are a helpful assistant that answers questions and can edit or create notes in the user's vault.

You can do two things:
1. **Answer questions** about the user's notes — cite note titles when referencing content. Use markdown formatting.
2. **Edit or create notes** when the user asks you to modify content.

## Editing notes
When the user asks you to edit an existing note, output the COMPLETE new content of the note inside a fenced block like this:

\`\`\`\`edit:Note Title
...full new content of the note...
\`\`\`\`

Important: The content inside the block must be the COMPLETE replacement content for the note, not a partial diff.

## Creating notes
When the user asks you to create a new note, output:

\`\`\`\`create:New Note Title
...content of the new note...
\`\`\`\`

## Rules
- Always explain what you're doing in natural language BEFORE the edit/create block
- You can include multiple edit/create blocks in a single response
- Only edit notes that exist in the vault context provided
- When editing, preserve parts of the note the user didn't ask to change
- Use markdown formatting in note content
- Use [[Wiki Link]] syntax to link between notes
- If the notes don't contain relevant information, say so
- Be concise and factual`;

  // Call OpenRouter API (OpenAI-compatible format) with streaming
  const openRouterResponse = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-20250514",
        max_tokens: 4096,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Question: ${message}\n\nVault notes:\n${contextData.context}`,
          },
        ],
      }),
    }
  );

  if (!openRouterResponse.ok) {
    const errorText = await openRouterResponse.text();
    return new Response(`OpenRouter API error: ${errorText}`, {
      status: 502,
      headers: corsHeaders,
    });
  }

  // Stream the response back (OpenAI SSE format)
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      const reader = openRouterResponse.body!.getReader();
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
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                await writer.write(encoder.encode(delta));
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      await writer.write(encoder.encode(`\n\n[Error: ${err}]`));
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
