# RAG Chat

## Overview

The RAG (Retrieval-Augmented Generation) chat panel allows users to ask questions about their vault content and receive AI-generated answers grounded in their notes. It appears as a right panel in the app layout, streaming responses from Claude via a Convex httpAction.

## Architecture

```
Client (ChatPanel)
  |
  | POST /api/chat
  | Authorization: Bearer <convex-token>
  | Body: { vaultId, message }
  |
  v
Convex httpAction (convex/chat.ts)
  |
  | 1. Validate auth token
  | 2. Verify vault ownership
  | 3. Fetch vault notes for context
  | 4. Build context (two-tier approach)
  | 5. Call Anthropic API with stream: true
  |
  v
TransformStream → streamed response back to client
```

### Why httpAction?

Convex queries and mutations don't support streaming responses. The chat endpoint uses an `httpAction` which can return arbitrary HTTP responses, including streaming via `TransformStream`. Authentication is handled manually via the `Authorization` header since httpActions don't have built-in `auth.getUserId()`.

## Context Building

The context builder uses a two-tier approach to maximize relevance within the token budget:

### Tier 1: Full Content (Top 5 Notes)

- Notes are selected by searching the vault using the user's question as a query.
- The top 5 results include their full markdown content.
- These provide Claude with detailed information to answer from.

### Tier 2: Title Only (Next 10 Notes)

- The next 10 search results include only their title.
- These give Claude awareness of related notes without consuming the context budget.

### Budget

- Total context is capped at **80,000 characters**.
- Notes are added in relevance order until the cap is reached.
- Blocks are separated by `---` markers.

## API Endpoint

### `POST /api/chat`

**Headers:**
- `Authorization: Bearer <convex-auth-token>` — Required

**Request Body:**
```json
{
  "vaultId": "<vault-id>",
  "message": "What are the key points from my project notes?"
}
```

**Response:** Streamed plain text (content-type: `text/plain`). Tokens arrive as they are generated.

### Authentication

1. Extract the bearer token from the `Authorization` header.
2. Use Convex's internal auth verification to resolve the user ID.
3. Verify the user owns the requested vault.
4. If any step fails, return 401.

## System Prompt

The system prompt instructs Claude to:

- Answer **only** from the provided vault notes
- Cite note titles when referencing content
- Say "I don't have enough information in your notes to answer that" when context is insufficient
- Note discrepancies between notes
- Use markdown formatting in responses
- Be concise and factual

## Frontend

### ChatPanel

**File:** `src/components/chat/ChatPanel.tsx`

Displayed in the right panel when `rightPanel === "chat"`.

#### UI Structure

```
Chat Panel
+-- Header: "Chat" label
+-- Message List (scrollable)
|   +-- User Message
|   +-- Assistant Message (streaming)
|   +-- User Message
|   +-- Assistant Message
|   +-- ...
+-- Input Area
    +-- Text input + Send button
```

#### Features

| Feature | Description |
|---------|-------------|
| Message history | Displays conversation in the current session |
| Streaming display | Assistant responses appear token-by-token |
| Auto-scroll | Scrolls to bottom as new tokens arrive |
| Send on Enter | Enter key sends the message |
| Loading state | Disabled input while waiting for response |

### ChatMessage

**File:** `src/components/chat/ChatMessage.tsx`

Renders individual user or assistant messages with appropriate styling.

### useChatStream

**File:** `src/components/chat/useChatStream.ts`

Custom hook that manages the streaming fetch lifecycle:

1. Sends POST request to `/api/chat` with the auth token.
2. Reads the response body as a stream via `ReadableStream`.
3. Decodes chunks and appends to the current assistant message.
4. Signals completion when the stream ends.

## Workspace Integration

The workspace state's `rightPanel` union type includes `"chat"`:

```typescript
rightPanel: "backlinks" | "graph" | "search" | "chat" | null;
```

The chat panel is toggled via a toolbar button (MessageSquare icon) or the command palette.

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `ANTHROPIC_API_KEY` | Convex env vars | API key for Claude API calls |
