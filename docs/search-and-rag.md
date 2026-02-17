# Search and RAG Chat

Search and Retrieval-Augmented Generation (RAG) are the primary ways users access knowledge stored in memory files. Search finds relevant files by keyword; RAG uses search results as context for Claude to answer questions.

**Source:** `src/memory/searcher.py` (search), `src/ai/context_builder.py` (RAG context), `src/bot/handlers.py` (Telegram RAG), `src/web/routers/chat.py` (web RAG)

## Keyword Search

### Algorithm

The search system uses weighted keyword scoring with no embeddings or vector storage.

1. **Tokenise** the query into lowercase alphanumeric tokens (regex: `[a-zA-Z0-9]+`)
2. **Score** each index entry by checking how many query tokens appear in each field:
   - `score += weight * (matched_tokens / total_tokens)` for each field
3. **Recency bonus**: if score > 0, add a linear bonus (0.0 to 1.0) based on how recently the file was updated (decays to zero over `recency_days`, default 30)
4. **Archived penalty**: entries with `status: archived` get a -100.0 penalty, effectively excluding them
5. **Filter** to entries with score > 0, **sort** descending, **return** top N (default 15)

### Field Weights

| Field | Weight | Why |
|-------|--------|-----|
| Company | 4.0 | Company-specific queries should strongly match |
| Tags | 3.0 | Curated relevance signals |
| Title | 2.5 | Descriptive of content |
| Category | 2.0 | Topic grouping |
| Summary | 1.5 | Content description |
| Filename | 1.0 | Sometimes matches queries |

### Usage Across Interfaces

| Interface | Trigger | Response Format |
|-----------|---------|----------------|
| Telegram `/search` | `/search <query>` | Numbered list with scores |
| Web API | `POST /api/search` | JSON array of `SearchResultItem` |
| Web frontend | Search bar on BrowserPage | Memory cards with scores |

## RAG Chat

RAG combines search results with Claude to answer questions grounded in organisational knowledge.

### Flow

```
Question
  |
  v
1. SEARCH -- query the index (top 15 results)
  |
  v
2. BUILD CONTEXT -- assemble search results into a text block
  |  - Top 5 results: full metadata + body content
  |  - Next 10 results: metadata only (title, summary, etc.)
  |  - Character budget: 80,000 max
  |
  v
3. CONSTRUCT PROMPT
  |  System: SYSTEM_PROMPT (Telegram) or WEB_SYSTEM_PROMPT (web)
  |  User: "Question: {question}\n\nMemory files:\n{context}"
  |
  v
4. CALL CLAUDE
  |  Telegram: single-turn ask() -> complete text
  |  Web: single-turn ask_stream() -> SSE stream
  |
  v
5. DELIVER RESPONSE
     Telegram: formatted message with source citations
     Web: streaming tokens + sources at completion
```

### Context Building Strategy

The context builder (`src/ai/context_builder.py`) uses a two-tier approach:

- **Full content** (top 5 by default): re-reads the `.md` file from disk and includes the complete body. These are the most relevant results and give Claude detailed information.
- **Summary only** (next 10 by default): includes only frontmatter metadata. These give Claude awareness of related files without consuming the context budget.

Blocks are separated by `---` and capped at 80,000 characters total.

### System Prompt Constraints

Both the Telegram and web system prompts instruct Claude to:

- Answer **only** from the provided memory files
- Cite sources by file path
- Say "I don't have information about that" when context is insufficient
- Note discrepancies between files
- Be concise and factual

The Telegram prompt limits output to ~4000 characters (Telegram's message limit). The web prompt allows rich markdown formatting.

### Telegram-Specific Behaviour

- Sends a "Thinking..." placeholder while processing
- Appends up to 5 source file paths to the response
- Logs every exchange to a JSON file in `logs/` for auditing

### Web-Specific Behaviour

- Streams the response as Server-Sent Events (SSE)
- Events: `{"type": "token", "content": "..."}` during generation, `{"type": "done", "sources": [...]}` at completion
- The frontend progressively renders the response as tokens arrive
- Sources are displayed below the assistant's message
