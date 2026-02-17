# Markdown Editor

## Overview

The Markdown editor is the core content creation and editing component of mrkdwn.me. It is built on [CodeMirror 6](https://codemirror.net/), configured with a rich set of extensions for Markdown editing, syntax highlighting, live preview, wiki link support, and auto-save functionality.

## Architecture

**Primary File:** `src/components/editor/MarkdownEditor.tsx`

The editor is implemented as a React component that manages a CodeMirror `EditorView` instance. Key related modules:

| File | Purpose |
|------|---------|
| `MarkdownEditor.tsx` | Main editor component, CodeMirror setup, auto-save |
| `wikiLinks.ts` | Wiki link detection, rendering, autocomplete |
| `livePreview.ts` | Live preview decorations for Markdown syntax |

## CodeMirror Extensions

The editor is configured with the following CodeMirror extensions:

| Extension | Package | Purpose |
|-----------|---------|---------|
| Markdown language | `@codemirror/lang-markdown` | Markdown syntax support and parsing |
| One Dark theme | `@codemirror/theme-one-dark` | Dark color scheme |
| Line numbers | `@codemirror/view` | Line number gutter |
| Active line highlight | `@codemirror/view` | Highlights the current line |
| Bracket matching | `@codemirror/language` | Matches brackets/parens |
| History | `@codemirror/commands` | Undo/redo support |
| Default keymap | `@codemirror/commands` | Standard editor keybindings |
| Search keymap | `@codemirror/search` | Find/replace functionality |
| Autocomplete | `@codemirror/autocomplete` | Wiki link completion |
| Wiki link plugin | `wikiLinks.ts` | Renders and navigates wiki links |
| Live preview plugin | `livePreview.ts` | Inline Markdown formatting preview |
| Update listener | `@codemirror/view` | Triggers auto-save on changes |

## Component Lifecycle

### Initialization

1. The component receives a `noteId` prop.
2. Note data is fetched via `useQuery(api.notes.get, { id: noteId })`.
3. On mount (or when `noteId` changes), a new `EditorView` is created.
4. The editor state is initialized with the note's `content`.
5. All extensions are applied.
6. The view is attached to the component's container `div`.

### Content Synchronization

When the note's content changes externally (e.g., from a wiki link rename):

1. The `useQuery` hook returns updated note data.
2. The component checks if the editor's current content differs from the server content.
3. If different and the editor is not currently focused (user not actively typing), the editor state is replaced with the server content.
4. This prevents overwriting the user's in-progress edits while keeping the editor in sync.

### Cleanup

On unmount:

1. Any pending save timeout is cleared and the save is flushed immediately.
2. The `EditorView` is destroyed.
3. Event listeners are removed.

## Auto-Save

### Mechanism

- **Trigger**: The `EditorView.updateListener` fires on every document change.
- **Debounce**: A `setTimeout` with a 500ms delay prevents excessive writes.
- **Save**: Calls `notes.update` mutation with the current editor content.
- **Flush on unmount**: If a save is pending when the component unmounts, it fires immediately.

### Flow

```
User types → EditorView.updateListener fires
  → clearTimeout(existing timer)
  → setTimeout(500ms) → notes.update(noteId, content)
```

## Live Preview Mode

**File:** `src/components/editor/livePreview.ts`

The live preview plugin provides inline visual formatting of Markdown syntax without switching to a separate preview pane.

### Supported Markdown Elements

| Element | Syntax | Rendering |
|---------|--------|-----------|
| Heading 1 | `# text` | Large bold text (1.8em) |
| Heading 2 | `## text` | Medium-large bold text (1.5em) |
| Heading 3 | `### text` | Medium bold text (1.3em) |
| Heading 4 | `#### text` | Slightly larger bold text (1.1em) |
| Heading 5-6 | `##### text` | Bold text (1em) |
| Bold | `**text**` | Bold weight |
| Italic | `*text*` | Italic style |
| Inline code | `` `text` `` | Monospace with background |
| Blockquote | `> text` | Left border + italic + muted color |
| Task (unchecked) | `- [ ] text` | Checkbox indicator (unchecked) |
| Task (checked) | `- [x] text` | Checkbox indicator (checked, strikethrough) |
| Horizontal rule | `---` / `***` | Styled divider line |
| Tags | `#tag-name` | Purple background pill styling |

### Implementation

The live preview uses CodeMirror's `ViewPlugin` and `DecorationSet`:

1. A `ViewPlugin` iterates over the visible document range.
2. For each line, it checks for Markdown patterns using the syntax tree.
3. Matching patterns receive `Decoration.mark()` or `Decoration.line()` decorations.
4. Decorations apply CSS classes that provide the visual styling.
5. The plugin efficiently updates only when the viewport or document changes.

## Editor Theming

### Custom CSS

The editor applies the One Dark theme as a base, with custom overrides in `src/index.css`:

```css
.cm-editor {
  height: 100%;
  background: var(--color-obsidian-bg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...;
}

.cm-editor .cm-content {
  padding: 16px 24px;
}

.cm-editor .cm-activeLine {
  background-color: rgba(255, 255, 255, 0.03);
}

.cm-editor .cm-gutters {
  background: var(--color-obsidian-bg);
  border-right: 1px solid var(--color-obsidian-border);
}
```

### Color Scheme

The editor follows the Obsidian dark theme:

- Background: `#1e1e1e`
- Text: `#dcddde`
- Line numbers / gutters: Subtle muted color
- Active line: Very slight white overlay
- Selection: Accent color with transparency

## Props

| Prop | Type | Description |
|------|------|-------------|
| `noteId` | `Id<"notes">` | The ID of the note to edit |

## Key Behaviors

1. **Single Source of Truth**: The Convex database is the source of truth. The editor reads from it on mount and writes back on save.
2. **Optimistic Updates**: Users see their changes immediately in the editor. Saves happen asynchronously in the background.
3. **No Explicit Save Button**: All saves are automatic via debounced auto-save.
4. **External Update Handling**: If a note is updated externally (e.g., wiki link rename), the editor reflects the change without disrupting the user's cursor position (when not actively editing).
