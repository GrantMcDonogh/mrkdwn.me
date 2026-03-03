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
import { marked } from "marked";
import { preprocessForPDF } from "../../utils/exportNoteToPDF";
import type { Id } from "../../../convex/_generated/dataModel";

// Navigation callback — set externally by MarkdownEditor
let navigateToNote: ((title: string) => void) | null = null;
let getNoteList: (() => { _id: Id<"notes">; title: string }[]) | null = null;
let getNoteContent: ((title: string) => string | null) | null = null;

export function setWikiLinkNavigator(fn: (title: string) => void) {
  navigateToNote = fn;
}

export function setNoteListProvider(fn: () => { _id: Id<"notes">; title: string }[]) {
  getNoteList = fn;
}

export function setNoteContentProvider(fn: (title: string) => string | null) {
  getNoteContent = fn;
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
      dismissPopup();
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

// --- Hover preview popup (editor mode) ---
// Manages its own fixed-position DOM element on document.body,
// positioned at the mouse cursor with smart viewport edge detection.

let hoverPopup: HTMLElement | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function clearHoverTimer() {
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
}

function clearDismissTimer() {
  if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
}

function dismissPopup() {
  clearDismissTimer();
  if (hoverPopup) { hoverPopup.remove(); hoverPopup = null; }
}

export function positionPopup(
  el: HTMLElement,
  mouseX: number,
  mouseY: number,
) {
  const offset = 12;
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = el.getBoundingClientRect();

  let left = mouseX + offset;
  let top = mouseY + offset;

  if (left + rect.width > vw - margin) left = mouseX - rect.width - offset;
  if (left < margin) left = margin;
  if (top + rect.height > vh - margin) top = mouseY - rect.height - offset;
  if (top < margin) top = margin;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function showPopup(title: string, mouseX: number, mouseY: number) {
  dismissPopup();
  if (!getNoteContent) return;

  const content = getNoteContent(title);
  const container = document.createElement("div");
  container.className = "link-preview-popup";
  container.style.position = "fixed";
  container.style.zIndex = "9999";
  container.style.visibility = "hidden";

  if (content === null) {
    const el = document.createElement("div");
    el.className = "link-preview-empty";
    el.textContent = "Note not found";
    container.appendChild(el);
  } else if (content.trim() === "") {
    const el = document.createElement("div");
    el.className = "link-preview-empty";
    el.textContent = "Empty note";
    container.appendChild(el);
  } else {
    const truncated = content.length > 1500 ? content.slice(0, 1500) + "..." : content;
    const cleaned = preprocessForPDF(truncated);
    const html = marked.parse(cleaned, { async: false }) as string;
    const contentDiv = document.createElement("div");
    contentDiv.className = "link-preview-content markdown-preview";
    contentDiv.innerHTML = html;
    container.appendChild(contentDiv);
  }

  container.addEventListener("mouseenter", clearDismissTimer);
  container.addEventListener("mouseleave", () => {
    dismissTimer = setTimeout(dismissPopup, 200);
  });

  document.body.appendChild(container);
  hoverPopup = container;

  // Measure actual size then position with edge detection
  positionPopup(container, mouseX, mouseY);
  container.style.visibility = "";
}

function getTitleAtPos(view: EditorView, pos: number): string | null {
  const line = view.state.doc.lineAt(pos);
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = regex.exec(line.text)) !== null) {
    const start = line.from + match.index;
    const end = start + match[0].length;
    if (pos >= start && pos <= end) {
      const inner = match[1]!;
      let title = inner;
      const pipeIdx = inner.indexOf("|");
      const hashIdx = inner.indexOf("#");
      if (pipeIdx !== -1) title = inner.substring(0, pipeIdx);
      else if (hashIdx !== -1) title = inner.substring(0, hashIdx);
      return title;
    }
  }
  return null;
}

export const wikiLinkHoverPreview = ViewPlugin.fromClass(
  class {
    private lastTitle: string | null = null;

    constructor(private view: EditorView) {
      this.view.dom.addEventListener("mousemove", this.onMouseMove);
      this.view.dom.addEventListener("mouseleave", this.onMouseLeave);
    }

    private onMouseMove = (e: MouseEvent) => {
      if (hoverPopup?.contains(e.target as Node)) return;

      const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) { this.handleLeaveLink(); return; }

      const title = getTitleAtPos(this.view, pos);
      if (!title) { this.handleLeaveLink(); return; }

      if (title !== this.lastTitle) {
        clearHoverTimer();
        clearDismissTimer();
        dismissPopup();
        this.lastTitle = title;
        const mx = e.clientX, my = e.clientY;
        hoverTimer = setTimeout(() => showPopup(title, mx, my), 300);
      } else {
        clearDismissTimer();
      }
    };

    private onMouseLeave = () => {
      clearHoverTimer();
      this.lastTitle = null;
      dismissTimer = setTimeout(dismissPopup, 200);
    };

    private handleLeaveLink() {
      clearHoverTimer();
      if (this.lastTitle) {
        this.lastTitle = null;
        dismissTimer = setTimeout(dismissPopup, 200);
      }
    }

    update(_update: ViewUpdate) {}

    destroy() {
      this.view.dom.removeEventListener("mousemove", this.onMouseMove);
      this.view.dom.removeEventListener("mouseleave", this.onMouseLeave);
      clearHoverTimer();
      clearDismissTimer();
      dismissPopup();
    }
  }
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
