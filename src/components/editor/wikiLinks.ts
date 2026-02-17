import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { Id } from "../../../convex/_generated/dataModel";

// Navigation callback — set externally by MarkdownEditor
let navigateToNote: ((title: string) => void) | null = null;
let getNoteList: (() => { _id: Id<"notes">; title: string }[]) | null = null;

export function setWikiLinkNavigator(fn: (title: string) => void) {
  navigateToNote = fn;
}

export function setNoteListProvider(fn: () => { _id: Id<"notes">; title: string }[]) {
  getNoteList = fn;
}

// Wiki link widget
class WikiLinkWidget extends WidgetType {
  constructor(
    private display: string,
    private title: string
  ) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-wiki-link";
    span.textContent = this.display;
    span.addEventListener("click", (e) => {
      e.preventDefault();
      if (navigateToNote) navigateToNote(this.title);
    });
    return span;
  }

  ignoreEvent() {
    return false;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const regex = /\[\[([^\]]+)\]\]/g;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos < to) {
      const line = doc.lineAt(pos);
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(line.text)) !== null) {
        const start = line.from + match.index;
        const end = start + match[0].length;
        const inner = match[1]!;

        // Parse: Title|Alias or Title#Heading
        let title = inner;
        let display = inner;
        const pipeIdx = inner.indexOf("|");
        const hashIdx = inner.indexOf("#");

        if (pipeIdx !== -1) {
          title = inner.substring(0, pipeIdx);
          display = inner.substring(pipeIdx + 1);
        } else if (hashIdx !== -1) {
          title = inner.substring(0, hashIdx);
          display = inner;
        }

        builder.add(
          start,
          end,
          Decoration.replace({ widget: new WikiLinkWidget(display, title) })
        );
      }
      pos = line.to + 1;
    }
  }

  return builder.finish();
}

export const wikiLinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// Autocomplete: triggered by [[
export function wikiLinkCompletion(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/\[\[\w*/);
  if (!before) return null;

  const notes = getNoteList ? getNoteList() : [];
  const query = before.text.slice(2).toLowerCase();

  return {
    from: before.from + 2,
    options: notes
      .filter((n) => n.title.toLowerCase().includes(query))
      .map((n) => ({
        label: n.title,
        apply: `${n.title}]]`,
      })),
  };
}
