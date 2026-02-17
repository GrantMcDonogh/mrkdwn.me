# Wiki Links & Backlinks

## Overview

Wiki links are the primary mechanism for connecting notes in mrkdwn.me. They use the `[[Note Title]]` syntax to create navigable links between notes. The backlinks feature surfaces all notes that link to a given note, enabling bidirectional knowledge navigation.

## Wiki Link Syntax

| Syntax | Description | Example |
|--------|-------------|---------|
| `[[Title]]` | Basic link to a note | `[[Meeting Notes]]` |
| `[[Title\|Alias]]` | Link with display alias | `[[Meeting Notes\|notes]]` |
| `[[Title#Heading]]` | Link to a specific heading | `[[Meeting Notes#Action Items]]` |

## Wiki Link Plugin

**File:** `src/components/editor/wikiLinks.ts`

### Detection & Parsing

The wiki link plugin uses CodeMirror's `ViewPlugin` to detect `[[...]]` patterns in the editor content:

1. A regex scans the visible content for `[[...]]` patterns.
2. Each match is parsed to extract:
   - **Title**: The target note name (before `|` or `#`).
   - **Alias**: Optional display text (after `|`).
   - **Heading**: Optional section reference (after `#`).
3. Decorations are created for each detected wiki link.

### Rendering

Wiki links are rendered as styled inline elements:

- **Color**: Accent purple (`#7f6df2`)
- **Style**: Underlined text indicating a clickable link
- **Cursor**: Pointer cursor on hover
- **Content**: Shows the alias if present, otherwise the title

### Navigation

When a user clicks a wiki link:

1. The click handler extracts the target title from the link.
2. It searches the current vault's notes for a matching title.
3. If found, it dispatches `OPEN_NOTE` to the workspace context, opening the linked note in the current pane.
4. The navigation callback is injected via `setWikiLinkNavigator()` — a function set by the `MarkdownEditor` component at mount time.

### Autocomplete

**Trigger**: Typing `[[` in the editor activates the wiki link autocomplete.

**Behavior**:

1. The autocomplete extension monitors for the `[[` trigger pattern.
2. On trigger, it fetches the list of all notes in the current vault.
3. Notes are filtered by the text typed after `[[`.
4. Results are displayed in a dropdown list.
5. Selecting a result inserts `[[Note Title]]` and closes the autocomplete.

**Implementation**: Uses `@codemirror/autocomplete` with a custom completion source registered for the `[[` context.

## Backlinks

### Concept

Backlinks are the inverse of wiki links. If Note A contains `[[Note B]]`, then Note B's backlinks panel shows Note A as a backlink. This creates a bidirectional relationship graph.

### Backend API

**File:** `convex/notes.ts`

#### `notes.getBacklinks(noteId)`

Finds all notes that link to the specified note.

- **Parameters**: `{ noteId: Id<"notes"> }`
- **Algorithm**:
  1. Fetch the target note to get its title.
  2. Fetch all notes in the same vault.
  3. For each note, check if its content contains `[[Target Title]]`, `[[Target Title|`, or `[[Target Title#`.
  4. For matching notes, extract a context snippet (the line containing the link).
  5. Return an array of `{ noteId, noteTitle, context }` objects.
- **Returns**: Array of backlink objects with note ID, title, and surrounding context.

#### `notes.getUnlinkedMentions(noteId)`

Finds notes that mention the target note's title in plain text (not inside `[[...]]` brackets).

- **Parameters**: `{ noteId: Id<"notes"> }`
- **Algorithm**:
  1. Fetch the target note to get its title.
  2. Fetch all notes in the same vault.
  3. For each note, check if its content contains the title as plain text.
  4. Exclude cases where the mention is inside `[[...]]` brackets (those are backlinks, not unlinked mentions).
  5. Extract a context snippet around the mention.
- **Returns**: Array of unlinked mention objects.

### Backlinks Panel

**File:** `src/components/backlinks/BacklinksPanel.tsx`

#### UI Structure

```
Backlinks Panel
├── Section: "Backlinks (N)"
│   ├── Backlink Item 1
│   │   ├── Note Title (clickable)
│   │   └── Context snippet (italic, muted)
│   ├── Backlink Item 2
│   └── ...
├── Section: "Unlinked Mentions (N)"
│   ├── Mention Item 1
│   │   ├── Note Title (clickable)
│   │   └── Context snippet
│   └── ...
└── (Empty state if no backlinks/mentions)
```

#### Features

| Feature | Description |
|---------|-------------|
| Backlink count | Displayed in section header |
| Context preview | Shows the line of text containing the link/mention |
| Click to navigate | Clicking a backlink opens that note in the editor |
| Unlinked mentions | Separate section for plain-text title matches |
| Real-time updates | Panel refreshes automatically via Convex subscriptions |

## Wiki Link Rename Propagation

**File:** `convex/notes.ts` — `notes.rename` mutation

When a note is renamed, all wiki link references to it must be updated across the vault:

### Algorithm

1. Store the old title and set the new title on the note.
2. Query all notes in the same vault.
3. For each note, search for patterns:
   - `[[Old Title]]` → replace with `[[New Title]]`
   - `[[Old Title|` → replace with `[[New Title|`
   - `[[Old Title#` → replace with `[[New Title#`
4. If any replacements were made, patch the note's content.
5. Update the renamed note's `updatedAt` timestamp.

### Example

Before rename ("Daily Log" → "Journal"):

```markdown
See my [[Daily Log]] for details.
Check [[Daily Log#Morning]] section.
Referenced in [[Daily Log|today's log]].
```

After rename:

```markdown
See my [[Journal]] for details.
Check [[Journal#Morning]] section.
Referenced in [[Journal|today's log]].
```

Note that aliases are preserved — only the title portion is updated.

## Performance Considerations

- **Backlink queries** scan all notes in the vault. This is acceptable for typical vault sizes (hundreds of notes) but may need indexing for very large vaults (thousands+).
- **Rename propagation** also scans all vault notes and performs string replacements. This is done server-side in a single mutation for consistency.
- **Autocomplete** fetches the full note list for the vault. The list is filtered client-side for responsiveness.
